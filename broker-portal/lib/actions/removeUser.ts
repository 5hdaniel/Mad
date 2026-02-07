'use server';

/**
 * Remove User Server Action
 *
 * Handles removing an organization member completely.
 * Deletes the organization_members record (does not delete user account).
 *
 * TASK-1812: Deactivate/Remove user flow
 */

import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/types/users';

// ============================================================================
// Types
// ============================================================================

interface RemoveInput {
  memberId: string;
}

interface RemoveResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Main Action
// ============================================================================

/**
 * Remove a member from the organization by deleting their membership record
 *
 * @param input - Member ID to remove
 * @returns Result with success or error
 */
export async function removeUser(input: RemoveInput): Promise<RemoveResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get target member details
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('id, user_id, role, organization_id')
    .eq('id', input.memberId)
    .single();

  if (!targetMember) {
    return { success: false, error: 'Member not found' };
  }

  // Get current user's membership
  const { data: currentMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', targetMember.organization_id)
    .single();

  if (!currentMembership) {
    return { success: false, error: 'Not authorized' };
  }

  // Permission checks
  const currentUserRole = currentMembership.role as Role;

  // Only admin/it_admin can remove users
  if (!['admin', 'it_admin'].includes(currentUserRole)) {
    return { success: false, error: 'Not authorized to remove users' };
  }

  // Cannot remove yourself
  if (targetMember.user_id === user.id) {
    return { success: false, error: 'Cannot remove yourself' };
  }

  // Admin-tier users cannot remove other admin-tier users
  if (['admin', 'it_admin'].includes(targetMember.role as string)) {
    return { success: false, error: 'Cannot remove other administrators' };
  }

  // Check last admin protection (only for actual users, not pending invites)
  if (targetMember.user_id && ['admin', 'it_admin'].includes(targetMember.role)) {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', targetMember.organization_id)
      .in('role', ['admin', 'it_admin'])
      .not('user_id', 'is', null) // Only count actual users, not pending invites
      .neq('id', input.memberId);

    if (count === 0) {
      return { success: false, error: 'Cannot remove the last admin' };
    }
  }

  // Delete the membership record
  const { error: deleteError } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', input.memberId);

  if (deleteError) {
    console.error('Error removing user:', deleteError);
    return { success: false, error: 'Failed to remove user' };
  }

  return { success: true };
}
