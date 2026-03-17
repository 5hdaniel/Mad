/**
 * Supabase Client - Server Component / Server Actions
 *
 * Use this in server components and server actions
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch {
            // Handle invalid UTF-8 sequences in cookie values
            return undefined;
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `delete` method was called from a Server Component.
          }
        },
      },
    }
  );
}

/**
 * Safely get the authenticated user. Catches errors from corrupted cookies
 * (e.g. invalid UTF-8 in @supabase/ssr's internal base64url decoder).
 * Returns { supabase, user } where user is null if anything fails.
 */
export async function getAuthenticatedUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
}> {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
  } catch {
    // Corrupted session cookie — treat as unauthenticated
    return { supabase, user: null };
  }
}
