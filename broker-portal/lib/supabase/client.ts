/**
 * Supabase Client - Browser/Client Component
 *
 * Use this in client components (with "use client" directive)
 *
 * BACKLOG-1486: Clears corrupted Supabase session data on initialization
 * to prevent "Invalid UTF-8 sequence" crashes.
 *
 * BACKLOG-1632: Wraps the Supabase SDK's cookie-based storage adapter with
 * safe getAll/setAll methods that catch UTF-8 decode errors thrown inside
 * the SDK's own base64url decoding (stringFromUTF8). The previous fix only
 * cleaned localStorage, but createBrowserClient uses document.cookie by
 * default. Corrupted cookie values caused "Invalid UTF-8 sequence" errors
 * in _recoverAndRefresh, __loadSession, etc.
 */

import { createBrowserClient } from '@supabase/ssr';
import { parse, serialize } from 'cookie';

/**
 * Clear corrupted Supabase auth data from localStorage.
 * Called before creating the client to prevent UTF-8 parse errors.
 */
function clearCorruptedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    // Try to read and parse each Supabase auth key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        try {
          const value = localStorage.getItem(key);
          if (value) JSON.parse(value); // Test if parseable
        } catch {
          // Corrupted — remove it
          console.warn(
            `[Supabase] Removed corrupted localStorage key: ${key}`
          );
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // localStorage itself is unavailable — nothing to do
  }
}

/**
 * Validate that a base64url-encoded cookie value can be decoded to valid UTF-8.
 * The Supabase SDK stores session cookies with a "base64-" prefix and decodes
 * them using a custom base64url-to-UTF-8 decoder (stringFromBase64URL). If the
 * underlying bytes form an invalid UTF-8 sequence, the SDK throws.
 *
 * We replicate the decode here: base64url -> bytes -> UTF-8 validation.
 */
function isValidBase64UrlUtf8(encoded: string): boolean {
  try {
    // Convert base64url to standard base64
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    // Convert to byte array and validate as UTF-8
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // TextDecoder with fatal:true throws on invalid UTF-8
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear corrupted Supabase auth cookies from document.cookie.
 * Removes any sb-* or supabase-* cookies whose base64url values decode
 * to invalid UTF-8 sequences — the exact condition that crashes the SDK.
 */
function clearCorruptedCookies(): void {
  if (typeof document === 'undefined') return;
  try {
    const parsed = parse(document.cookie);
    const cookieNames = Object.keys(parsed);
    const corruptedTokenPrefixes = new Set<string>();

    // First pass: find corrupted cookies and identify their token prefix
    for (const name of cookieNames) {
      if (name.includes('supabase') || name.startsWith('sb-')) {
        const value = parsed[name];
        if (value && value.startsWith('base64-')) {
          if (!isValidBase64UrlUtf8(value.substring(7))) {
            // Extract the token prefix (e.g., "sb-xxx-auth-token" from "sb-xxx-auth-token.0")
            const prefix = name.replace(/\.\d+$/, '');
            corruptedTokenPrefixes.add(prefix);
          }
        }
      }
    }

    // Second pass: expire ALL chunks of any corrupted token
    if (corruptedTokenPrefixes.size > 0) {
      for (const name of cookieNames) {
        const prefix = name.replace(/\.\d+$/, '');
        if (corruptedTokenPrefixes.has(prefix) || corruptedTokenPrefixes.has(name)) {
          console.warn(`[Supabase] Clearing corrupted cookie: ${name}`);
          document.cookie = serialize(name, '', { maxAge: 0, path: '/' });
        }
      }
    }
  } catch {
    // document.cookie is unavailable — nothing to do
  }
}

// Run once on module load (client-side only)
clearCorruptedSession();
clearCorruptedCookies();

/**
 * Safe cookie helpers that wrap document.cookie access.
 * If any Supabase cookie value contains corrupted base64url data, it is
 * deleted and excluded from the result set. This forces the SDK to treat
 * the session as missing (triggers re-auth) instead of crashing in
 * stringFromBase64URL -> stringFromUTF8.
 */
function safeGetAllCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined') return [];
  try {
    const parsed = parse(document.cookie);
    const cookieNames = Object.keys(parsed);
    const corruptedTokenPrefixes = new Set<string>();

    // First pass: identify corrupted token prefixes
    for (const name of cookieNames) {
      const isSupabaseCookie =
        name.includes('supabase') || name.startsWith('sb-');
      if (isSupabaseCookie) {
        const value = parsed[name];
        if (value && value.startsWith('base64-')) {
          if (!isValidBase64UrlUtf8(value.substring(7))) {
            const prefix = name.replace(/\.\d+$/, '');
            corruptedTokenPrefixes.add(prefix);
          }
        }
      }
    }

    // Second pass: filter out ALL chunks of corrupted tokens, expire them
    if (corruptedTokenPrefixes.size > 0) {
      for (const name of cookieNames) {
        const prefix = name.replace(/\.\d+$/, '');
        if (corruptedTokenPrefixes.has(prefix) || corruptedTokenPrefixes.has(name)) {
          console.warn(`[Supabase] Filtering corrupted cookie from getAll: ${name}`);
          document.cookie = serialize(name, '', { maxAge: 0, path: '/' });
        }
      }
    }

    // Return only non-corrupted cookies
    const results: { name: string; value: string }[] = [];
    for (const name of cookieNames) {
      const prefix = name.replace(/\.\d+$/, '');
      if (corruptedTokenPrefixes.has(prefix) || corruptedTokenPrefixes.has(name)) {
        continue;
      }
      results.push({ name, value: parsed[name] });
    }
    return results;
  } catch {
    return [];
  }
}

function safeSetAllCookies(
  cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]
): void {
  if (typeof document === 'undefined') return;
  for (const { name, value, options } of cookiesToSet) {
    try {
      document.cookie = serialize(name, value, options as Parameters<typeof serialize>[2]);
    } catch (error) {
      console.warn(
        `[Supabase] Failed to set cookie "${name}":`,
        error
      );
    }
  }
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: safeGetAllCookies,
        setAll: safeSetAllCookies,
      },
    }
  );
}
// Trigger deploy 1776382733
