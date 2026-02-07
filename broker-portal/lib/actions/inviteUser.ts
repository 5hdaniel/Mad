'use server';

/**
 * Invite User Server Action
 *
 * Handles creating invitation records for new organization members.
 * Validates email, checks for duplicates, and generates secure tokens.
 *
 * TASK-1810: Invite user modal and server action
 */

import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface InviteUserInput {
  email: string;
  role: 'agent' | 'broker' | 'admin';
  organizationId: string;
}

interface InviteUserResult {
  success: boolean;
  inviteLink?: string;
  error?: string;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Basic email format validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// Main Action
// ============================================================================

/**
 * Create an invitation for a new organization member
 *
 * @param input - Email, role, and organization ID
 * @returns Result with invite link or error
 */
export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const supabase = await createClient();

  // Validate email format
  if (!isValidEmail(input.email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Normalize email
  const normalizedEmail = input.email.toLowerCase().trim();

  // Verify current user is admin/it_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Check user cannot invite themselves
  const { data: currentUserData } = await supabase
    .from('users')
    .select('email')
    .eq('id', user.id)
    .maybeSingle();

  if (currentUserData?.email?.toLowerCase() === normalizedEmail) {
    return { success: false, error: 'You cannot invite yourself' };
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!membership || !['admin', 'it_admin'].includes(membership.role)) {
    return { success: false, error: 'Not authorized to invite users' };
  }

  // Check for pending invitation with this email (separate query - no string interpolation)
  const { data: existingInvite } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('invited_email', normalizedEmail)
    .maybeSingle();

  if (existingInvite) {
    return { success: false, error: 'This email already has a pending invitation' };
  }

  // Check if a user with this email is already a member (separate queries)
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    if (existingMember) {
      return { success: false, error: 'This user is already a member of the organization' };
    }
  }

  // Check organization seat limits and get provider info
  const { data: organization } = await supabase
    .from('organizations')
    .select('max_seats, microsoft_tenant_id, google_domain')
    .eq('id', input.organizationId)
    .maybeSingle();

  if (organization?.max_seats) {
    // Count current members (active + pending)
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', input.organizationId)
      .in('license_status', ['active', 'pending']);

    if (memberCount && memberCount >= organization.max_seats) {
      return { success: false, error: 'Organization has reached maximum seats' };
    }
  }

  // Generate secure invitation token
  const invitationToken = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

  // Create invitation record
  const { error: insertError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: input.organizationId,
      invited_email: normalizedEmail,
      role: input.role,
      license_status: 'pending',
      invitation_token: invitationToken,
      invitation_expires_at: expiresAt.toISOString(),
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      provisioned_by: 'invite',
    });

  if (insertError) {
    console.error('Error creating invitation:', insertError);
    return { success: false, error: 'Failed to create invitation' };
  }

  // Generate invite link with provider hint
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.magicaudit.com';
  const hasMicrosoft = !!organization?.microsoft_tenant_id;
  const hasGoogle = !!organization?.google_domain;
  const provider = hasMicrosoft && !hasGoogle ? 'microsoft' : hasGoogle && !hasMicrosoft ? 'google' : '';
  const providerParam = provider ? `?provider=${provider}` : '';
  const inviteLink = `${baseUrl}/invite/${invitationToken}${providerParam}`;

  return {
    success: true,
    inviteLink,
  };
}
