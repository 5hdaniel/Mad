'use server';

/**
 * User Management Server Actions - Shared Utilities
 *
 * Reusable server actions and utilities for user management.
 * Used by invite, update, deactivate, and remove actions.
 *
 * TASK-1814: Initial utilities
 */

import { createClient } from '@/lib/supabase/server';
import type { Role, OrganizationMember } from '@/lib/types/users';

// ============================================================================
// Types
// ============================================================================

interface MembershipResult {
  error: string | null;
  membership: Pick<OrganizationMember, 'id' | 'organization_id' | 'user_id' | 'role' | 'license_status'> | null;
  userId?: string;
}

// ============================================================================
// Authentication & Authorization
// ============================================================================

/**
 * Get the current user's membership and verify they have admin access
 *
 * @param organizationId - Optional org ID to filter by (uses user's org if not provided)
 * @returns Membership result with error status
 */
export async function getCurrentUserMembership(
  organizationId?: string
): Promise<MembershipResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated', membership: null };
  }

  const query = supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, license_status')
    .eq('user_id', user.id);

  if (organizationId) {
    query.eq('organization_id', organizationId);
  }

  const { data: membership, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching membership:', error);
    return { error: 'Failed to fetch membership', membership: null };
  }

  if (!membership) {
    return { error: 'Membership not found', membership: null };
  }

  return { error: null, membership, userId: user.id };
}

/**
 * Check if the current user can manage members (has admin or it_admin role)
 *
 * @param organizationId - The organization to check permissions for
 * @returns True if user can manage members
 */
export async function canManageMembers(organizationId: string): Promise<boolean> {
  const result = await getCurrentUserMembership(organizationId);
  if (result.error || !result.membership) {
    return false;
  }
  return ['admin', 'it_admin'].includes(result.membership.role);
}

/**
 * Check if the current user has a specific role or higher
 *
 * @param requiredRole - The minimum role required
 * @param organizationId - The organization to check permissions for
 * @returns True if user meets the role requirement
 */
export async function hasMinimumRole(
  requiredRole: Role,
  organizationId: string
): Promise<boolean> {
  const result = await getCurrentUserMembership(organizationId);
  if (result.error || !result.membership) {
    return false;
  }

  const roleHierarchy: Record<Role, number> = {
    agent: 1,
    broker: 2,
    admin: 3,
    it_admin: 4,
  };

  const userRoleLevel = roleHierarchy[result.membership.role as Role];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  return userRoleLevel >= requiredRoleLevel;
}

// ============================================================================
// Role Management Utilities
// ============================================================================

/**
 * Get roles that can be assigned by the current user based on their role
 *
 * @param currentUserRole - The role of the user making the assignment
 * @returns Array of roles that can be assigned
 */
export function getAssignableRoles(currentUserRole: Role): Role[] {
  if (currentUserRole === 'it_admin') {
    return ['agent', 'broker', 'admin', 'it_admin'];
  }
  if (currentUserRole === 'admin') {
    return ['agent', 'broker', 'admin'];
  }
  return [];
}

/**
 * Check if a user can assign a specific role
 *
 * @param assignerRole - Role of the user making the assignment
 * @param targetRole - Role being assigned
 * @returns True if assignment is allowed
 */
export function canAssignRole(assignerRole: Role, targetRole: Role): boolean {
  const assignableRoles = getAssignableRoles(assignerRole);
  return assignableRoles.includes(targetRole);
}

// ============================================================================
// Safety Checks
// ============================================================================

/**
 * Check if removing/demoting a member would leave no admins in the organization
 *
 * @param memberId - The member being affected
 * @param organizationId - The organization to check
 * @param action - The type of action being performed
 * @returns True if this would remove the last admin
 */
export async function wouldRemoveLastAdmin(
  memberId: string,
  organizationId: string,
  _action: 'demote' | 'remove' | 'deactivate'
): Promise<boolean> {
  const supabase = await createClient();

  // Get the target member's current role
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('role, license_status')
    .eq('id', memberId)
    .single();

  if (!targetMember) {
    return false; // Member doesn't exist, not our problem
  }

  // Only check if target is currently an admin
  if (!['admin', 'it_admin'].includes(targetMember.role)) {
    return false;
  }

  // Count remaining active admins (excluding target)
  const { count } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('role', ['admin', 'it_admin'])
    .eq('license_status', 'active')
    .neq('id', memberId);

  return (count || 0) === 0;
}

/**
 * Check if a user can perform an action on a target member
 *
 * @param actorMemberId - The member performing the action
 * @param targetMemberId - The member being acted upon
 * @param action - The action being performed
 * @returns Object with allowed status and optional error message
 */
export async function canPerformMemberAction(
  actorMemberId: string,
  targetMemberId: string,
  _action: 'update_role' | 'deactivate' | 'remove'
): Promise<{ allowed: boolean; error?: string }> {
  const supabase = await createClient();

  // Get both members
  const { data: members } = await supabase
    .from('organization_members')
    .select('id, role, license_status, organization_id')
    .in('id', [actorMemberId, targetMemberId]);

  if (!members || members.length !== 2) {
    return { allowed: false, error: 'Invalid member IDs' };
  }

  const actor = members.find((m) => m.id === actorMemberId);
  const target = members.find((m) => m.id === targetMemberId);

  if (!actor || !target) {
    return { allowed: false, error: 'Member not found' };
  }

  // Must be in the same organization
  if (actor.organization_id !== target.organization_id) {
    return { allowed: false, error: 'Members must be in the same organization' };
  }

  // Cannot modify yourself
  if (actorMemberId === targetMemberId) {
    return { allowed: false, error: 'Cannot modify your own membership' };
  }

  // Must have admin privileges
  if (!['admin', 'it_admin'].includes(actor.role)) {
    return { allowed: false, error: 'Insufficient permissions' };
  }

  // Admin cannot modify it_admin
  if (actor.role === 'admin' && target.role === 'it_admin') {
    return { allowed: false, error: 'Admins cannot modify IT Admin users' };
  }

  return { allowed: true };
}

// ============================================================================
// Display Utilities
// ============================================================================

/**
 * Format a user's display name from various fields
 *
 * @param user - User object with name fields (can be partial or null)
 * @param fallbackEmail - Email to use if no name available
 * @returns Formatted display name
 */
export function formatUserDisplayName(
  user: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null,
  fallbackEmail?: string | null
): string {
  if (user?.display_name) {
    return user.display_name;
  }

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (fullName) {
    return fullName;
  }

  return fallbackEmail || 'Unknown User';
}

/**
 * Get initials from a user's name for avatar display
 *
 * @param user - User object with name fields
 * @param fallbackEmail - Email to use if no name available
 * @returns 1-2 character initials string
 */
export function getUserInitials(
  user: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null,
  fallbackEmail?: string | null
): string {
  // Try display_name first
  if (user?.display_name) {
    const parts = user.display_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  // Try first_name + last_name
  if (user?.first_name && user?.last_name) {
    return (user.first_name[0] + user.last_name[0]).toUpperCase();
  }

  // Try first_name only
  if (user?.first_name) {
    return user.first_name.substring(0, 2).toUpperCase();
  }

  // Fallback to email
  if (fallbackEmail) {
    return fallbackEmail.substring(0, 2).toUpperCase();
  }

  return '??';
}

/**
 * Get a human-readable provisioning source description
 *
 * @param source - The provisioning source
 * @returns Human-readable description
 */
export function getProvisioningDescription(
  source: string | null
): string {
  switch (source) {
    case 'manual':
      return 'Added manually';
    case 'scim':
      return 'Provisioned via SCIM';
    case 'jit':
      return 'Just-in-time provisioned';
    case 'invite':
      return 'Joined via invitation';
    default:
      return 'Unknown';
  }
}
