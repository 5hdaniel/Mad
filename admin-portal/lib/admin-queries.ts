/**
 * Admin Queries - Helper functions for admin RPC calls
 *
 * Uses the browser Supabase client for client-side data fetching.
 */

import { createClient } from '@/lib/supabase/client';

export interface AdminSearchUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  org_name: string | null;
  org_slug: string | null;
  org_role: string | null;
  status: string | null;
  last_login_at: string | null;
}

/** Build a display name from available fields */
export function getUserDisplayName(user: AdminSearchUser): string {
  if (user.display_name) return user.display_name;
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  }
  return 'Unnamed User';
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
