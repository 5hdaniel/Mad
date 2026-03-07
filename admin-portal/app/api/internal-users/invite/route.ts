/**
 * API Route: Add Internal User
 *
 * Handles two cases:
 *   1. User exists in public.users -> call RPC to assign role directly
 *   2. User NOT in public.users -> create a pending invitation
 *      (role is auto-assigned on first SSO login via /auth/callback)
 *
 * POST /api/internal-users/invite
 * Body: { email: string, role: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // ── 1. Auth check ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 1b. Permission check ──────────────────────────────────────────
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'internal_users.manage',
  });
  if (!hasPerm) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // ── 2. Parse & validate request body ──────────────────────────────
  let email: string;
  let roleSlug: string;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    roleSlug = typeof body.role === 'string' ? body.role.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Missing or invalid email' }, { status: 400 });
  }
  if (!roleSlug) {
    return NextResponse.json({ error: 'Missing role' }, { status: 400 });
  }

  // ── 3. Validate roleSlug against admin_roles table ────────────────
  const { data: roleRow, error: roleError } = await supabase
    .from('admin_roles')
    .select('id, slug')
    .eq('slug', roleSlug)
    .maybeSingle();

  if (roleError) {
    console.error('[invite-internal-user] admin_roles lookup error:', roleError.message);
    return NextResponse.json({ error: 'Failed to validate role' }, { status: 500 });
  }
  if (!roleRow) {
    return NextResponse.json(
      { error: `Unknown role: "${roleSlug}". Please select a valid role.` },
      { status: 400 }
    );
  }

  // ── 4. Check if user exists in public.users ───────────────────────
  const { data: existingUser, error: userLookupError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (userLookupError) {
    console.error('[invite-internal-user] users lookup error:', userLookupError.message);
    return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
  }

  if (existingUser) {
    // ── Case A: User exists → assign role directly via RPC ────────
    const { data, error } = await supabase.rpc('admin_add_internal_user', {
      p_email: email,
      p_role: roleSlug,
    });

    if (error) {
      console.error('[invite-internal-user] RPC error:', error.message);

      if (error.message?.includes('already has') || error.message?.includes('already an internal')) {
        return NextResponse.json(
          { error: `${email} already has an internal role assigned.` },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'Failed to assign role' },
        { status: 500 }
      );
    }

    const result = data as { success: boolean; user_id: string; role: string } | null;
    return NextResponse.json({
      success: true,
      user_id: result?.user_id,
      role: result?.role ?? roleSlug,
    });
  }

  // ── Case B: User not in system → create pending invitation ──────
  // Check if already invited
  const { data: existingInvite } = await supabase
    .from('pending_internal_invitations')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existingInvite) {
    return NextResponse.json(
      { error: `${email} already has a pending invitation.` },
      { status: 409 }
    );
  }

  const { error: inviteError } = await supabase
    .from('pending_internal_invitations')
    .insert({
      email,
      role_id: roleRow.id,
      invited_by: user.id,
    });

  if (inviteError) {
    console.error('[invite-internal-user] invitation insert error:', inviteError.message);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }

  const roleName = roleRow.slug;
  return NextResponse.json({
    success: true,
    pending: true,
    message: `Invitation created for ${email} as ${roleName}. Role will be assigned on first login.`,
  });
}
