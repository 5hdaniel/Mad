/**
 * Admin Queries - Helper functions for admin RPC calls
 *
 * Uses the browser Supabase client for client-side data fetching.
 */

import { createClient } from '@/lib/supabase/client';

export interface AdminSearchUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  org_name: string | null;
  org_slug: string | null;
  role: string | null;
  status: string | null;
  last_sign_in_at: string | null;
}

/**
 * Search users across all organizations via admin_search_users RPC.
 *
 * @param searchQuery - Search term (name, email, org, or user ID)
 * @returns Array of matching users
 */
export async function searchUsers(
  searchQuery: string
): Promise<{ data: AdminSearchUser[] | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_search_users', {
    search_query: searchQuery,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as AdminSearchUser[], error: null };
}
