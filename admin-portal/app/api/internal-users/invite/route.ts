/**
 * API Route: Add Internal User (Overhaul)
 *
 * Handles ALL cases server-side:
 *   1. User exists in public.users -> call RPC directly
 *   2. User exists in auth.users but NOT public.users -> create public.users row, then RPC
 *   3. User exists in neither -> create auth user, create public.users row, then RPC
 *   4. User already has the role -> return graceful error
 *
 * BACKLOG-885: Fix broken flow where admin.createUser() fires trigger creating
 *              profiles but NOT public.users, causing RPC to fail.
 * BACKLOG-886: Validate roleSlug against admin_roles table.
 * BACKLOG-887: Rollback auth user creation if subsequent steps fail.
 *
 * POST /api/internal-users/invite
 * Body: { email: string, role: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';

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

  // ── 3. Admin client setup ─────────────────────────────────────────
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('[invite-internal-user] SUPABASE_SERVICE_ROLE_KEY is not configured');
    return NextResponse.json(
      { error: 'Server configuration missing — contact an administrator' },
      { status: 503 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 4. Validate roleSlug against admin_roles table (BACKLOG-886) ──
  // Use the authenticated user's client (not adminClient) because admin_roles
  // has RLS policies that require has_internal_role(auth.uid()).
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

  // ── 5. Check if user exists in public.users ───────────────────────
  const { data: existingUser, error: userLookupError } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (userLookupError) {
    console.error('[invite-internal-user] users lookup error:', userLookupError.message);
    return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
  }

  // Track whether we created an auth user (for BACKLOG-887 rollback)
  let createdAuthUserId: string | null = null;

  try {
    if (existingUser) {
      // ── Case A: User exists in public.users -> call RPC directly ──
      return await callRpcAndRespond(adminClient, email, roleSlug);
    }

    // ── User NOT in public.users — check auth.users ─────────────────
    const { data: allAuthUsers, error: listError } =
      await adminClient.auth.admin.listUsers({ perPage: 1000 });

    if (listError) {
      console.error('[invite-internal-user] listUsers error:', listError.message);
      return NextResponse.json({ error: 'Failed to check auth users' }, { status: 500 });
    }

    const matchingAuthUser = allAuthUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (matchingAuthUser) {
      // ── Case B: In auth.users but NOT public.users ────────────────
      const insertError = await createPublicUsersRecord(adminClient, matchingAuthUser.id, email);
      if (insertError) {
        return NextResponse.json(
          { error: `Failed to create user record: ${insertError}` },
          { status: 500 }
        );
      }

      return await callRpcAndRespond(adminClient, email, roleSlug);
    }

    // ── Case C: User exists in neither — create from scratch ────────
    const { data: createData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { created_as_internal_user: true },
      });

    if (createError) {
      console.error('[invite-internal-user] createUser error:', createError.message);
      return NextResponse.json(
        { error: createError.message || 'Failed to create auth user' },
        { status: 500 }
      );
    }

    createdAuthUserId = createData.user?.id ?? null;
    if (!createdAuthUserId) {
      return NextResponse.json(
        { error: 'Auth user created but no ID returned' },
        { status: 500 }
      );
    }

    // Create the public.users record
    const insertError = await createPublicUsersRecord(adminClient, createdAuthUserId, email);
    if (insertError) {
      // BACKLOG-887: Rollback — delete the auth user we just created
      await rollbackAuthUser(adminClient, createdAuthUserId);
      return NextResponse.json(
        { error: `Failed to create user record: ${insertError}` },
        { status: 500 }
      );
    }

    // Assign the internal role
    const rpcResult = await callRpc(adminClient, email, roleSlug);
    if (rpcResult.error) {
      // BACKLOG-887: Rollback — delete both public.users and auth user
      await adminClient.from('users').delete().eq('id', createdAuthUserId);
      await rollbackAuthUser(adminClient, createdAuthUserId);
      return NextResponse.json(
        { error: `Role assignment failed: ${rpcResult.error}` },
        { status: rpcResult.status }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: rpcResult.userId ?? createdAuthUserId,
      role: rpcResult.role ?? roleSlug,
      created: true,
    });
  } catch (err) {
    // BACKLOG-887: If anything unexpected fails, try to clean up
    if (createdAuthUserId) {
      await adminClient.from('users').delete().eq('id', createdAuthUserId);
      await rollbackAuthUser(adminClient, createdAuthUserId);
    }
    console.error('[invite-internal-user] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

type AdminSupabaseClient = SupabaseClient;

/**
 * Insert a row into public.users for a user that exists in auth.users
 * but not yet in public.users.
 */
async function createPublicUsersRecord(
  client: AdminSupabaseClient,
  userId: string,
  email: string
): Promise<string | null> {
  const { error } = await client.from('users').insert({
    id: userId,
    email,
    // The CHECK constraint on the live DB allows 'azure' (used by SCIM + JIT).
    // We use 'azure' as a placeholder; it will be updated on first SSO login.
    oauth_provider: 'azure',
    oauth_id: userId, // Placeholder — updated on first SSO login
    status: 'active',
    is_active: true,
  });

  if (error) {
    console.error('[invite-internal-user] public.users insert error:', error.message);
    return error.message;
  }
  return null;
}

/**
 * Call admin_add_internal_user RPC and return a NextResponse.
 */
async function callRpcAndRespond(
  client: AdminSupabaseClient,
  email: string,
  roleSlug: string
): Promise<NextResponse> {
  const result = await callRpc(client, email, roleSlug);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    success: true,
    user_id: result.userId,
    role: result.role ?? roleSlug,
  });
}

/**
 * Call admin_add_internal_user RPC, returning a structured result.
 */
async function callRpc(
  client: AdminSupabaseClient,
  email: string,
  roleSlug: string
): Promise<{
  error: string | null;
  status: number;
  userId: string | null;
  role: string | null;
}> {
  const { data, error } = await client.rpc('admin_add_internal_user', {
    p_email: email,
    p_role: roleSlug,
  });

  if (error) {
    console.error('[invite-internal-user] RPC error:', error.message);

    // Handle "already has role" gracefully
    if (error.message?.includes('already has') || error.message?.includes('already an internal')) {
      return {
        error: `${email} already has an internal role assigned.`,
        status: 409,
        userId: null,
        role: null,
      };
    }

    return {
      error: error.message || 'Failed to assign role',
      status: 500,
      userId: null,
      role: null,
    };
  }

  const result = data as { success: boolean; user_id: string; role: string } | null;
  return {
    error: null,
    status: 200,
    userId: result?.user_id ?? null,
    role: result?.role ?? null,
  };
}

/**
 * BACKLOG-887: Rollback — delete an auth user we created.
 */
async function rollbackAuthUser(
  client: AdminSupabaseClient,
  userId: string
): Promise<void> {
  try {
    await client.auth.admin.deleteUser(userId);
  } catch (err) {
    console.error('[invite-internal-user] Rollback failed for auth user:', userId, err);
  }
}
