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

// ---------------------------------------------------------------------------
// Write Operations (Suspend / Unsuspend / License Edit)
// ---------------------------------------------------------------------------

interface RpcResult<T = Record<string, unknown>> {
  data: T | null;
  error: Error | null;
}

/**
 * Suspend a user via admin_suspend_user RPC.
 *
 * @param userId - The target user's UUID
 * @param reason - Optional reason for suspension
 */
export async function suspendUser(
  userId: string,
  reason?: string
): Promise<RpcResult<{ success: boolean; previous_status: string }>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_suspend_user', {
    p_user_id: userId,
    ...(reason ? { p_reason: reason } : {}),
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as { success: boolean; previous_status: string }, error: null };
}

/**
 * Unsuspend a user via admin_unsuspend_user RPC.
 *
 * @param userId - The target user's UUID
 */
export async function unsuspendUser(
  userId: string
): Promise<RpcResult<{ success: boolean; previous_status: string }>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_unsuspend_user', {
    p_user_id: userId,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as { success: boolean; previous_status: string }, error: null };
}

/**
 * Update a license via admin_update_license RPC.
 *
 * @param licenseId - The license UUID
 * @param changes - Object of fields to update (status, expires_at, license_type, transaction_limit)
 */
export async function updateLicense(
  licenseId: string,
  changes: Record<string, unknown>
): Promise<
  RpcResult<{ success: boolean; old_values: Record<string, unknown>; new_values: Record<string, unknown> }>
> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_update_license', {
    p_license_id: licenseId,
    p_changes: changes,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: data as {
      success: boolean;
      old_values: Record<string, unknown>;
      new_values: Record<string, unknown>;
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Impersonation
// ---------------------------------------------------------------------------

interface ImpersonationResult {
  success: boolean;
  token: string;
  session_id: string;
  expires_at: string;
  error?: string;
}

/**
 * Start an impersonation session via admin_start_impersonation RPC.
 *
 * @param targetUserId - The target user's UUID to impersonate
 */
export async function startImpersonation(
  targetUserId: string
): Promise<RpcResult<ImpersonationResult>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_start_impersonation', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as ImpersonationResult, error: null };
}
