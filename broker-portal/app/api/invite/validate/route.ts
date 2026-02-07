/**
 * Invite Validation API Route
 *
 * Validates an invitation token and returns invite details.
 * Does NOT require authentication — the token itself is the auth.
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agent',
  broker: 'Broker',
  admin: 'Admin',
  it_admin: 'IT Admin',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'No token provided' });
  }

  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from('organization_members')
    .select('id, invited_email, role, organization_id, invitation_expires_at, user_id, organizations(name)')
    .eq('invitation_token', token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ valid: false, error: 'Invitation not found' });
  }

  // Already claimed
  if (invite.user_id) {
    return NextResponse.json({ valid: false, error: 'This invitation has already been accepted' });
  }

  // Check expiry
  if (invite.invitation_expires_at) {
    const expiresAt = new Date(invite.invitation_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'This invitation has expired' });
    }
  }

  const org = invite.organizations as { name: string } | null;

  return NextResponse.json({
    valid: true,
    email: invite.invited_email,
    orgName: org?.name || 'Unknown Organization',
    role: ROLE_LABELS[invite.role] || invite.role,
  });
}
