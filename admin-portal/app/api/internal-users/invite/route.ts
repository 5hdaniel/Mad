/**
 * API Route: Create & Add Internal User
 *
 * Handles the case where an email address is not yet registered in public.users.
 * Uses the Supabase service role key to:
 *   1. Verify the caller has internal_users.manage permission
 *   2. Create the auth user (they'll log in via SSO — no password needed)
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
    console.error('[create-internal-user] SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json(
      { error: 'Server configuration missing — contact an administrator' },
      { status: 503 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // 4. Use admin client to create the user (no password — they log in via SSO)
  //    The handle_new_user trigger will automatically create the public.users record.
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { created_as_internal_user: true },
  });

  if (createError) {
    console.error('[create-internal-user] createUser error:', createError.message);
    return NextResponse.json(
      { error: createError.message || 'Failed to create user' },
      { status: 500 }
    );
  }

  const createdUserId = createData.user?.id;
  if (!createdUserId) {
    return NextResponse.json({ error: 'User created but no user ID returned' }, { status: 500 });
  }

  // 5. Assign the internal role via the existing RPC.
  //    The trigger already created the public.users record so admin_add_internal_user
  //    should now find the user by email.
  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_add_internal_user', {
    p_email: email,
    p_role: roleSlug,
  });

  if (rpcError) {
    console.error('[create-internal-user] admin_add_internal_user error:', rpcError.message);
    return NextResponse.json(
      {
        error: `User created but role assignment failed: ${rpcError.message}`,
        user_id: createdUserId,
      },
      { status: 500 }
    );
  }

  const result = rpcData as { success: boolean; user_id: string; role: string } | null;

  return NextResponse.json({
    success: true,
    user_id: result?.user_id ?? createdUserId,
    role: result?.role ?? roleSlug,
  });
}
