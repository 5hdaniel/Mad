/**
 * Clear corrupted Supabase auth data from localStorage.
 *
 * BACKLOG-1632: The Supabase SDK may store session data in localStorage
 * that becomes corrupted (invalid UTF-8 sequences). When the SDK tries to
 * load/refresh the session, it throws unhandled "Invalid UTF-8 sequence"
 * errors that flood the console and trigger unhandled promise rejections.
 *
 * This function iterates all localStorage keys, identifies Supabase-related
 * entries (prefixed with "supabase" or "sb-"), and removes any that cannot
 * be parsed as valid JSON.
 *
 * Pattern borrowed from broker-portal/lib/supabase/client.ts (BACKLOG-1486).
 */

/**
 * Clear corrupted Supabase auth data from localStorage.
 * Called before any Supabase SDK initialization to prevent UTF-8 parse errors.
 *
 * @returns Array of corrupted key names that were removed (empty if none)
 */
export function clearCorruptedSession(): string[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }

  const removedKeys: string[] = [];

  try {
    // Collect keys first to avoid mutation during iteration
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase") || key.includes("sb-"))) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          JSON.parse(value); // Test if parseable
        }
      } catch {
        // Corrupted entry -- remove it
        localStorage.removeItem(key);
        removedKeys.push(key);
      }
    }

    if (removedKeys.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[BACKLOG-1632] Cleared ${removedKeys.length} corrupted Supabase session entry(ies) from localStorage`
      );
    }
  } catch {
    // localStorage itself is unavailable -- nothing to do
  }

  return removedKeys;
}
