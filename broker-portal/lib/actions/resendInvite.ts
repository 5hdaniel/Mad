'use server';

/**
 * Resend Invite Server Action
 *
 * Regenerates the invitation token, resets the expiry,
 * and resends the invite email for a pending organization member.
 */

import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';
import { blockWriteDuringImpersonation } from '@/lib/impersonation-guards';
import { sendInviteEmail } from '@/lib/email';

interface ResendInviteInput {
  memberId: string;
  organizationId: string;
}

interface ResendInviteResult {
  success: boolean;
  error?: string;
}

export async function resendInvite(input: ResendInviteInput): Promise<ResendInviteResult> {
  const blocked = await blockWriteDuringImpersonation();
  if (blocked) return { success: false, error: blocked.error };

  const supabase = await createClient();

  // Verify current user is admin/it_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!membership || !['admin', 'it_admin'].includes(membership.role)) {
    return { success: false, error: 'Not authorized' };
  }

  // Get the pending invite
  const { data: pendingMember } = await supabase
    .from('organization_members')
    .select('id, invited_email, role, organization_id, user_id')
    .eq('id', input.memberId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!pendingMember) {
    return { success: false, error: 'Invitation not found' };
  }

  if (pendingMember.user_id) {
    return { success: false, error: 'This user has already accepted the invitation' };
  }

  // Regenerate token and reset expiry
  const newToken = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: updateError } = await supabase
    .from('organization_members')
    .update({
      invitation_token: newToken,
      invitation_expires_at: expiresAt.toISOString(),
    })
    .eq('id', input.memberId);

  if (updateError) {
    console.error('Error updating invitation:', updateError);
    return { success: false, error: 'Failed to regenerate invitation' };
  }

  // Get inviter and org info for the email
  const { data: currentUserData } = await supabase
    .from('users')
    .select('email, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: organization } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', input.organizationId)
    .maybeSingle();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keeprcompliance.com';
  const inviteLink = `${baseUrl}/invite/${newToken}`;

  // Send the email
  try {
    const inviterName = currentUserData?.display_name || currentUserData?.email || 'Your administrator';
    const orgName = organization?.name || 'your organization';

    const emailResult = await sendInviteEmail({
      recipientEmail: pendingMember.invited_email!,
      organizationName: orgName,
      inviterName,
      role: pendingMember.role,
      inviteLink,
      expiresInDays: 7,
    });

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
      return { success: false, error: 'Invitation updated but email could not be sent' };
    }
  } catch (emailError) {
    console.error('Error sending invite email:', emailError);
    return { success: false, error: 'Invitation updated but email could not be sent' };
  }

  return { success: true };
}
