/**
 * API Route: Resend User Invite
 *
 * Re-sends the invitation email for a pending org-member or individual invitation.
 * Regenerates the token + extends expiration by 7 days.
 *
 * POST /api/users/resend-invite
 * Body: { membershipId: string, type: 'org' | 'individual' }
 *
 * BACKLOG-1581: Add resend invite button for pending invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission check — same as inviteUser server action
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'users.edit',
  });
  if (!hasPerm) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Parse body
  let membershipId: string;
  let type: 'org' | 'individual';
  try {
    const body = await request.json();
    membershipId = typeof body.membershipId === 'string' ? body.membershipId.trim() : '';
    type = body.type === 'individual' ? 'individual' : 'org';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!membershipId) {
    return NextResponse.json({ error: 'Missing membershipId' }, { status: 400 });
  }

  // Generate new token and expiry
  const newToken = generateToken();
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (type === 'org') {
    return handleOrgResend(supabase, membershipId, newToken, newExpiry, user);
  } else {
    return handleIndividualResend(supabase, membershipId, newToken, newExpiry, user);
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function handleOrgResend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membershipId: string,
  newToken: string,
  newExpiry: string,
  user: { id: string; email?: string; user_metadata?: Record<string, string> }
) {
  // Look up the pending invitation
  const { data: membership, error: lookupError } = await supabase
    .from('organization_members')
    .select('id, invited_email, role, organization_id, user_id, organizations(name)')
    .eq('id', membershipId)
    .maybeSingle();

  if (lookupError) {
    console.error('[resend-invite] Org lookup error:', lookupError.message);
    return NextResponse.json({ error: 'Failed to look up invitation' }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  // Must be a pending invitation (user_id is null, invited_email is set)
  if (membership.user_id || !membership.invited_email) {
    return NextResponse.json({ error: 'This is not a pending invitation' }, { status: 400 });
  }

  // Update token + expiry + last_invited_at
  const { error: updateError } = await supabase
    .from('organization_members')
    .update({
      invitation_token: newToken,
      invitation_expires_at: newExpiry,
      last_invited_at: new Date().toISOString(),
    })
    .eq('id', membershipId);

  if (updateError) {
    console.error('[resend-invite] Org update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
  }

  // Extract org name from join
  const orgData = membership.organizations as unknown as { name: string } | null;
  const orgName = orgData?.name ?? 'Keepr';

  // Send email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keeprcompliance.com';
  const inviteLink = `${baseUrl}/invite/${newToken}`;
  const inviterName = getInviterName(user);

  const emailSent = await sendInviteEmail({
    recipientEmail: membership.invited_email,
    organizationName: orgName,
    inviterName,
    role: membership.role,
    inviteLink,
  });

  return NextResponse.json({ success: true, emailSent });
}

async function handleIndividualResend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invitationId: string,
  newToken: string,
  newExpiry: string,
  user: { id: string; email?: string; user_metadata?: Record<string, string> }
) {
  // Look up the pending individual invitation
  const { data: invitation, error: lookupError } = await supabase
    .from('individual_invitations')
    .select('id, invited_email, accepted_at')
    .eq('id', invitationId)
    .maybeSingle();

  if (lookupError) {
    console.error('[resend-invite] Individual lookup error:', lookupError.message);
    return NextResponse.json({ error: 'Failed to look up invitation' }, { status: 500 });
  }

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  // Must not be accepted
  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'This invitation has already been accepted' }, { status: 400 });
  }

  // Update token + expiry
  const { error: updateError } = await supabase
    .from('individual_invitations')
    .update({
      invitation_token: newToken,
      invitation_expires_at: newExpiry,
    })
    .eq('id', invitationId);

  if (updateError) {
    console.error('[resend-invite] Individual update error:', updateError.message);
    return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
  }

  // Send email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keeprcompliance.com';
  const inviteLink = `${baseUrl}/invite/${newToken}`;
  const inviterName = getInviterName(user);

  const emailSent = await sendInviteEmail({
    recipientEmail: invitation.invited_email,
    organizationName: 'Keepr',
    inviterName,
    role: null,
    inviteLink,
  });

  return NextResponse.json({ success: true, emailSent });
}

function getInviterName(user: { email?: string; user_metadata?: Record<string, string> }): string {
  return (
    [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') ||
    user.email ||
    'Keepr Support'
  );
}

async function sendInviteEmail(params: {
  recipientEmail: string;
  organizationName: string;
  inviterName: string;
  role: string | null;
  inviteLink: string;
}): Promise<boolean> {
  const brokerPortalUrl = process.env.BROKER_PORTAL_URL;
  const apiSecret = process.env.INTERNAL_API_SECRET;

  if (!brokerPortalUrl || !apiSecret) {
    console.warn('[resend-invite] Email skipped: BROKER_PORTAL_URL or INTERNAL_API_SECRET not configured');
    return false;
  }

  try {
    const response = await fetch(`${brokerPortalUrl}/api/email/send-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify({
        recipientEmail: params.recipientEmail.toLowerCase().trim(),
        organizationName: params.organizationName,
        inviterName: params.inviterName,
        role: params.role,
        inviteLink: params.inviteLink,
        expiresInDays: 7,
      }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (err) {
    console.error('[resend-invite] Failed to send invite email:', err);
    return false;
  }
}
