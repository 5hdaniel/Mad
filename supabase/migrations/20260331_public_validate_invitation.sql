-- ============================================================================
-- Migration: public_validate_invitation_token RPC
-- Task: BACKLOG-1536
--
-- The broker portal invite validation endpoint (/api/invite/validate) queries
-- organization_members to look up an invitation by token. But ALL SELECT
-- policies on organization_members require auth.uid() to be non-null.
-- Users clicking an invite link are NOT authenticated yet, so the query
-- returns nothing and the invite page shows "Invitation not found".
--
-- This SECURITY DEFINER RPC bypasses RLS to validate tokens safely.
-- It only returns the minimal fields needed for the invite acceptance UI:
-- email, org name, and role. No sensitive data is exposed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.public_validate_invitation_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_org_name TEXT;
BEGIN
  -- 1. Validate input
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No token provided');
  END IF;

  -- 2. Look up the invitation by token
  SELECT
    om.id,
    om.invited_email,
    om.role,
    om.organization_id,
    om.invitation_expires_at,
    om.user_id
  INTO v_invite
  FROM organization_members om
  WHERE om.invitation_token = p_token;

  -- 3. Not found
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  -- 4. Already accepted (user_id is set when invite is claimed)
  IF v_invite.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been accepted');
  END IF;

  -- 5. Expired
  IF v_invite.invitation_expires_at IS NOT NULL
     AND v_invite.invitation_expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  -- 6. Get organization name
  SELECT name INTO v_org_name
  FROM organizations
  WHERE id = v_invite.organization_id;

  -- 7. Return validated invite details
  RETURN jsonb_build_object(
    'valid',    true,
    'email',    v_invite.invited_email,
    'org_name', COALESCE(v_org_name, 'Unknown Organization'),
    'role',     v_invite.role
  );
END;
$$;

-- Grant to BOTH authenticated and anon roles.
-- Anon is critical: users clicking invite links are not yet authenticated.
GRANT EXECUTE ON FUNCTION public.public_validate_invitation_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_validate_invitation_token(TEXT) TO anon;
