/**
 * Supabase Client - Browser/Client Component
 *
 * Use this in client components (with "use client" directive)
 *
 * BACKLOG-1632: Clears corrupted Supabase session data from both
 * localStorage and cookies on module load, before the SDK initializes.
 * This prevents "Invalid UTF-8 sequence" crashes in the SDK's internal
 * base64url decoder.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Clear corrupted Supabase auth data from localStorage.
 */
function clearCorruptedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        try {
          const value = localStorage.getItem(key);
          if (value) JSON.parse(value);
        } catch {
          console.warn(`[Supabase] Removed corrupted localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // localStorage unavailable
  }
}

/**
 * Clear corrupted Supabase auth cookies.
 * If ANY chunk of a multi-part token is corrupted, expire ALL chunks.
 * Uses the SDK's own decode path to test validity.
 */
function clearCorruptedCookies(): void {
  if (typeof document === 'undefined') return;
  try {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const corruptedPrefixes = new Set<string>();

    // First pass: find corrupted cookie chunks
    for (const cookie of cookies) {
      const eqIndex = cookie.indexOf('=');
      if (eqIndex === -1) continue;
      const name = cookie.substring(0, eqIndex);
      const value = cookie.substring(eqIndex + 1);

      if ((name.includes('supabase') || name.startsWith('sb-')) && value.startsWith('base64-')) {
        try {
          const encoded = decodeURIComponent(value.substring(7));
          // Replicate the SDK's full decode path: base64url -> bytes -> UTF-8
          const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          const prefix = name.replace(/\.\d+$/, '');
          corruptedPrefixes.add(prefix);
        }
      }
    }

    // Second pass: expire ALL chunks of corrupted tokens
    if (corruptedPrefixes.size > 0) {
      for (const cookie of cookies) {
        const name = cookie.split('=')[0];
        const prefix = name.replace(/\.\d+$/, '');
        if (corruptedPrefixes.has(prefix) || corruptedPrefixes.has(name)) {
          console.warn(`[Supabase] Clearing corrupted cookie: ${name}`);
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      }
    }
  } catch {
    // document.cookie unavailable
  }
}

// Run once on module load
clearCorruptedSession();
clearCorruptedCookies();

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
