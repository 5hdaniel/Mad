/**
 * API Route: Invite Internal User
 *
 * Handles the case where an email address is not yet registered in public.users.
 * Uses the Supabase service role key to:
 *   1. Verify the caller has an internal role (via anon client + session cookie)
 *   2. Invite the user by email (creates auth.users entry + sends invite email)
 *   3. Call admin_add_internal_user RPC to assign the internal role
 *
 * POST /api/internal-users/invite
 * Body: { email: string, role: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // 1. Verify the caller is authenticated and has an internal role
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: role } = await supabase
    .from('internal_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .single();

  if (!role) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1b. Verify the caller has internal_users.manage permission
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    check_user_id: user.id,
    required_permission: 'internal_users.manage',
  });
  if (!hasPerm) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // 2. Parse and validate request body
  let email: string;
  let roleSlug: string;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim() : '';
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

  // 3. Require the service role key (server-side only)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('[invite] SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json(
      { error: 'Server misconfiguration: invite feature is not enabled' },
      { status: 503 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // 4. Use admin client to invite the user by email
  //    This creates an auth.users entry and sends the invite email.
  //    The handle_new_user trigger will automatically create the public.users record.
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { data: { invited_as_internal_user: true } }
  );

  if (inviteError) {
    console.error('[invite] inviteUserByEmail error:', inviteError.message);
    return NextResponse.json(
      { error: inviteError.message || 'Failed to invite user' },
      { status: 500 }
    );
  }

  const invitedUserId = inviteData.user?.id;
  if (!invitedUserId) {
    return NextResponse.json({ error: 'Invite succeeded but no user ID returned' }, { status: 500 });
  }

  // 5. Assign the internal role via the existing RPC.
  //    The trigger already created the public.users record so admin_add_internal_user
  //    should now find the user by email.
  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_internal_user', {
    p_email: email,
    p_role: roleSlug,
  });

  if (rpcError) {
    console.error('[invite] admin_add_internal_user error:', rpcError.message);
    // The invite was sent but role assignment failed — surface this clearly
    return NextResponse.json(
      {
        error: `User invited but role assignment failed: ${rpcError.message}`,
        invited: true,
        user_id: invitedUserId,
      },
      { status: 500 }
    );
  }

  const result = rpcData as { success: boolean; user_id: string; role: string } | null;

  return NextResponse.json({
    success: true,
    invited: true,
    user_id: result?.user_id ?? invitedUserId,
    role: result?.role ?? roleSlug,
  });
}
