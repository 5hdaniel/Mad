-- ============================================================================
-- Migration: admin_invite_user RPC
-- Task: BACKLOG-1534
--
-- The admin portal invite action does a direct INSERT into organization_members,
-- which is silently blocked by RLS (admin portal users are internal support
-- agents, not org members). This SECURITY DEFINER RPC handles all validation
-- and insertion, bypassing RLS safely with proper auth checks.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_invite_user(
  p_organization_id UUID,
  p_email           TEXT,
  p_role            TEXT,
  p_invited_by      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id         UUID;
  v_has_role         BOOLEAN;
  v_has_perm         BOOLEAN;
  v_normalized_email TEXT;
  v_existing_user_id UUID;
  v_org_name         TEXT;
  v_max_seats        INTEGER;
  v_member_count     INTEGER;
  v_invitation_token TEXT;
  v_expires_at       TIMESTAMPTZ;
BEGIN
  -- 1. Auth check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Internal role check
  SELECT public.has_internal_role(v_admin_id) INTO v_has_role;
  IF NOT v_has_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_internal_user');
  END IF;

  -- 3. Permission check
  SELECT public.has_permission(v_admin_id, 'users.edit') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- 4. Validate email format
  v_normalized_email := lower(trim(p_email));
  IF v_normalized_email IS NULL OR v_normalized_email = '' OR
     v_normalized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  -- 5. Validate role
  IF p_role NOT IN ('agent', 'broker', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_role');
  END IF;

  -- 6. Check for existing pending invitation (same email + org)
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND invited_email = v_normalized_email
      AND user_id IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_invitation');
  END IF;

  -- 7. Check if user already a member of this org
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE email = v_normalized_email;

  IF v_existing_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = p_organization_id
        AND user_id = v_existing_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_member');
    END IF;
  END IF;

  -- 8. Get organization details and check seat limit
  SELECT name, max_seats INTO v_org_name, v_max_seats
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_org_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'organization_not_found');
  END IF;

  IF v_max_seats IS NOT NULL THEN
    SELECT count(*) INTO v_member_count
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND license_status IN ('active', 'pending');

    IF v_member_count >= v_max_seats THEN
      RETURN jsonb_build_object('success', false, 'error', 'seat_limit_reached');
    END IF;
  END IF;

  -- 9. Generate invitation token and expiry
  v_invitation_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '7 days';

  -- 10. Insert the invitation record
  INSERT INTO public.organization_members (
    organization_id,
    invited_email,
    role,
    license_status,
    invitation_token,
    invitation_expires_at,
    invited_by,
    invited_at,
    provisioned_by
  ) VALUES (
    p_organization_id,
    v_normalized_email,
    p_role,
    'pending',
    v_invitation_token,
    v_expires_at,
    p_invited_by,
    now(),
    'invite'
  );

  -- 11. Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'member.invited',
    'organization_member',
    p_organization_id::text,
    jsonb_build_object(
      'invited_email', v_normalized_email,
      'role',          p_role,
      'org_name',      v_org_name
    )
  );

  -- 12. Return success with token and org name
  RETURN jsonb_build_object(
    'success',          true,
    'invitation_token', v_invitation_token,
    'org_name',         v_org_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_invite_user(UUID, TEXT, TEXT, UUID) TO authenticated;
