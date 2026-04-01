/**
 * Invite Validation API Route
 *
 * Validates an invitation token and returns invite details.
 * Does NOT require authentication — the token itself is the auth.
 *
 * Uses the public_validate_invitation_token RPC (SECURITY DEFINER)
 * to bypass RLS on organization_members, since unauthenticated users
 * clicking invite links have no auth.uid() and all SELECT policies
 * require it. See BACKLOG-1536.
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

  const { data, error } = await supabase.rpc('public_validate_invitation_token', {
    p_token: token,
  });

  if (error) {
    console.error('[invite/validate] RPC error:', error.message);
    return NextResponse.json({ valid: false, error: 'Invitation not found' });
  }

  // The RPC returns JSONB with { valid, error?, email?, org_name?, role? }
  const result = data as {
    valid: boolean;
    error?: string;
    email?: string;
    org_name?: string;
    role?: string;
  };

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error });
  }

  return NextResponse.json({
    valid: true,
    email: result.email,
    orgName: result.org_name,
    role: ROLE_LABELS[result.role ?? ''] || result.role,
  });
}
