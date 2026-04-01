'use server';

/**
 * Invite User Server Action - Admin Portal
 *
 * Allows admin portal support agents (with users.edit permission) to invite
 * users to any organization. Unlike broker-portal's version, this does NOT
 * check org membership (admin agents aren't org members).
 *
 * Auth: has_permission(user_id, 'users.edit')
 *
 * BACKLOG-1492: Admin invite users
 */

import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import { sendInviteEmail } from '@/lib/email';

// ============================================================================
// Types
// ============================================================================

interface InviteUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: 'agent' | 'broker' | 'admin';
  organizationId: string;
}

interface InviteUserResult {
  success: boolean;
  inviteLink?: string;
  emailSent?: boolean;
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
 * Create an invitation for a new organization member.
 *
 * Admin portal version: auth is via internal RBAC (users.edit permission),
 * not org membership. Admin agents can invite to any organization.
 *
 * @param input - Email, name, role, and organization ID
 * @returns Result with invite link or error
 */
export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const supabase = await createClient();

  // Validate required fields
  if (!input.email?.trim()) {
    return { success: false, error: 'Email is required' };
  }
  if (!input.firstName?.trim()) {
    return { success: false, error: 'First name is required' };
  }
  if (!input.lastName?.trim()) {
    return { success: false, error: 'Last name is required' };
  }
  if (!input.organizationId) {
    return { success: false, error: 'Organization is required' };
  }

  // Validate email format
  if (!isValidEmail(input.email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Normalize email
  const normalizedEmail = input.email.toLowerCase().trim();

  // Verify current user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify users.edit permission via internal RBAC
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'users.edit',
  });
  if (!hasPerm) {
    return { success: false, error: 'Not authorized to invite users' };
  }

  // Check for existing pending invitation with this email in this org
  const { data: existingInvite } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('invited_email', normalizedEmail)
    .maybeSingle();

  if (existingInvite) {
    return { success: false, error: 'This email already has a pending invitation for this organization' };
  }

  // Check if a user with this email is already a member
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

  // Get organization details (name + seat check)
  const { data: organization } = await supabase
    .from('organizations')
    .select('name, max_seats')
    .eq('id', input.organizationId)
    .maybeSingle();

  if (!organization) {
    return { success: false, error: 'Organization not found' };
  }

  // Check seat limits if configured
  if (organization.max_seats) {
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
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

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

  // Generate invite link pointing to broker-portal (where /invite/[token] lives)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keeprcompliance.com';
  const inviteLink = `${baseUrl}/invite/${invitationToken}`;

  // Send invite email (non-blocking -- invite is created regardless of email success)
  let emailSent = false;
  try {
    const inviterName = `${input.firstName} ${input.lastName}`.trim() || 'Keepr Support';

    const emailResult = await sendInviteEmail({
      recipientEmail: normalizedEmail,
      organizationName: organization.name,
      inviterName,
      role: input.role,
      inviteLink,
      expiresInDays: 7,
    });

    emailSent = emailResult.success;
    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
    }
  } catch (emailError) {
    console.error('Error sending invite email:', emailError);
  }

  return {
    success: true,
    inviteLink,
    emailSent,
  };
}
