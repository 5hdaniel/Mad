'use server';

/**
 * Invite User Server Action - Admin Portal
 *
 * Allows admin portal support agents (with users.edit permission) to invite
 * users to any organization. Uses the admin_invite_user RPC (SECURITY DEFINER)
 * to bypass RLS on organization_members -- admin agents aren't org members,
 * so direct INSERTs are silently blocked by RLS.
 *
 * Auth: has_internal_role + has_permission(user_id, 'users.edit') -- enforced in RPC
 *
 * BACKLOG-1492: Admin invite users
 * BACKLOG-1534: Fix RLS-blocked INSERT via SECURITY DEFINER RPC
 */

import { createClient } from '@/lib/supabase/server';

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
// Error Mapping
// ============================================================================

/** Map RPC error codes to user-friendly messages */
const RPC_ERROR_MAP: Record<string, string> = {
  not_authenticated: 'Not authenticated',
  not_internal_user: 'Not authorized to invite users',
  insufficient_permissions: 'Not authorized to invite users',
  invalid_email: 'Invalid email format',
  invalid_role: 'Invalid role',
  duplicate_invitation: 'This email already has a pending invitation for this organization',
  already_member: 'This user is already a member of the organization',
  organization_not_found: 'Organization not found',
  seat_limit_reached: 'Organization has reached maximum seats',
};

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
 * Admin portal version: all auth and validation is handled by the
 * admin_invite_user SECURITY DEFINER RPC. The server action handles
 * input validation, calling the RPC, and sending the invite email.
 *
 * @param input - Email, name, role, and organization ID
 * @returns Result with invite link or error
 */
export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const supabase = await createClient();

  // --- Client-side input validation (fast-fail before RPC) ---

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
  if (!isValidEmail(input.email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // --- Call the SECURITY DEFINER RPC ---
  // The RPC handles: auth, permission check, duplicate detection,
  // seat limits, token generation, and the INSERT (bypassing RLS).

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('admin_invite_user', {
    p_organization_id: input.organizationId,
    p_email: input.email,
    p_role: input.role,
    p_invited_by: user.id,
  });

  if (rpcError) {
    console.error('admin_invite_user RPC error:', rpcError);
    return { success: false, error: 'Failed to create invitation' };
  }

  // The RPC returns JSONB: { success, error?, invitation_token?, org_name? }
  if (!rpcResult?.success) {
    const errorCode = rpcResult?.error as string;
    const friendlyMessage = RPC_ERROR_MAP[errorCode] || 'Failed to create invitation';
    return { success: false, error: friendlyMessage };
  }

  const invitationToken = rpcResult.invitation_token as string;
  const orgName = rpcResult.org_name as string;

  // --- Generate invite link ---
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keeprcompliance.com';
  const inviteLink = `${baseUrl}/invite/${invitationToken}`;

  // --- Send invite email via broker portal proxy (non-blocking) ---
  // The broker portal owns the Azure Graph email service; we proxy through it
  // using the shared INTERNAL_API_SECRET, same pattern as support ticket emails.
  // BACKLOG-1535: Proxy invite email through broker portal
  let emailSent = false;
  try {
    const brokerPortalUrl = process.env.BROKER_PORTAL_URL;
    const apiSecret = process.env.INTERNAL_API_SECRET;

    if (!brokerPortalUrl || !apiSecret) {
      console.warn(
        '[inviteUser] Email skipped: missing env vars --',
        `BROKER_PORTAL_URL=${brokerPortalUrl ? 'set' : 'MISSING'}`,
        `INTERNAL_API_SECRET=${apiSecret ? 'set' : 'MISSING'}`
      );
    } else {
      // Use the admin's name (from auth metadata), not the invited user's name
      const inviterName = [user.user_metadata?.first_name, user.user_metadata?.last_name]
        .filter(Boolean).join(' ') || user.email || 'Keepr Support';

      const response = await fetch(`${brokerPortalUrl}/api/email/send-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': apiSecret,
        },
        body: JSON.stringify({
          recipientEmail: input.email.toLowerCase().trim(),
          organizationName: orgName,
          inviterName,
          role: input.role,
          inviteLink,
          expiresInDays: 7,
        }),
      });

      const result = await response.json();
      emailSent = result.success === true;

      if (!emailSent) {
        console.error('Failed to send invite email via broker portal:', result.error);
      }
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
