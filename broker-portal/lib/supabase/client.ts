/**
 * Supabase Client - Browser/Client Component
 *
 * Use this in client components (with "use client" directive)
 *
 * BACKLOG-1486: Clears corrupted Supabase session data on initialization
 * to prevent "Invalid UTF-8 sequence" crashes.
 */

import { createBrowserClient } from '@supabase/ssr';

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
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // localStorage itself is unavailable — nothing to do
  }
}

// Run once on module load (client-side only)
clearCorruptedSession();

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
