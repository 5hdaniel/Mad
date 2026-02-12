'use server';

/**
 * Bulk Update Role Server Action
 *
 * Updates the role for multiple organization members at once.
 */

import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/types/users';

interface BulkUpdateRoleInput {
  memberIds: string[];
  newRole: Role;
}

interface BulkUpdateRoleResult {
  success: boolean;
  updatedCount?: number;
  error?: string;
}

export async function bulkUpdateRole(
  input: BulkUpdateRoleInput
): Promise<BulkUpdateRoleResult> {
  const supabase = await createClient();

  // Verify current user is admin/it_admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['admin', 'it_admin'].includes(membership.role)) {
    return { success: false, error: 'Not authorized to update roles' };
  }

  // Validate role assignment permissions
  const allowedRoles: Role[] =
    membership.role === 'it_admin'
      ? ['agent', 'broker', 'admin', 'it_admin']
      : ['agent', 'broker', 'admin'];

  if (!allowedRoles.includes(input.newRole)) {
    return { success: false, error: 'Cannot assign this role' };
  }

  // Note: Current user exclusion is handled by .neq('user_id', user.id) in the
  // Supabase query below, so no client-side filtering is needed here.
  const memberIdsToUpdate = input.memberIds;

  if (memberIdsToUpdate.length === 0) {
    return { success: false, error: 'No users to update' };
  }

  // Update all members in the same organization
  const { data, error } = await supabase
    .from('organization_members')
    .update({ role: input.newRole, updated_at: new Date().toISOString() })
    .eq('organization_id', membership.organization_id)
    .in('id', memberIdsToUpdate)
    .neq('user_id', user.id) // Don't update own role
    .select('id');

  if (error) {
    console.error('Error bulk updating roles:', error);
    return { success: false, error: 'Failed to update roles' };
  }

  return {
    success: true,
    updatedCount: data?.length || 0,
  };
}
