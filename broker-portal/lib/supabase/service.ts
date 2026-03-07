/**
 * Supabase Service Role Client - Server Only
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * NEVER import this in client components or expose the key to the browser.
 *
 * Used for:
 * - Impersonation token validation (RPC requires authenticated role)
 * - Loading target user data during impersonation (bypasses RLS)
 * - Ending impersonation sessions (admin auth.uid() not available in broker portal)
 */

import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
