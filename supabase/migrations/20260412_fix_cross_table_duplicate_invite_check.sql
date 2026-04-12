-- Fix cross-table duplicate invite detection in admin_invite_user RPC
--
-- Bug: The org path only checked organization_members for duplicates,
-- and the individual path only checked individual_invitations.
-- Neither path checked the OTHER table, allowing the same email to be
-- invited as both an individual and an org member simultaneously.
--
-- Also: The org path only checked for duplicates within the SAME org,
-- allowing the same email to be invited to multiple different orgs.
--
-- Fix: Add cross-table checks in both paths, and cross-org check in org path.

CREATE OR REPLACE FUNCTION public.admin_invite_user(
  p_organization_id uuid DEFAULT NULL::uuid,
  p_email text DEFAULT NULL::text,
  p_role text DEFAULT NULL::text,
  p_invited_by uuid DEFAULT NULL::uuid,
  p_license_status text DEFAULT 'trial'::text,
  p_plan_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_token text;
  v_expires_at timestamptz;
  v_org_name text;
  v_existing_invite uuid;
  v_existing_user_id uuid;
  v_existing_member uuid;
  v_max_seats integer;
  v_member_count bigint;
BEGIN
  -- Auth checks
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF NOT has_internal_role(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_internal_user');
  END IF;

  IF NOT has_permission(v_caller_id, 'users.edit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Validate email
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_required');
  END IF;

  -- Validate license_status
  IF p_license_status IS NOT NULL AND p_license_status NOT IN ('trial', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_license_status');
  END IF;

  -- Normalize email
  p_email := lower(trim(p_email));

  -- Generate token and expiry
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '7 days';

  -- ORG PATH
  IF p_organization_id IS NOT NULL THEN
    SELECT name, max_seats INTO v_org_name, v_max_seats
    FROM organizations WHERE id = p_organization_id;

    IF v_org_name IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'organization_not_found');
    END IF;

    -- Check duplicate within same org (existing check)
    SELECT id INTO v_existing_invite
    FROM organization_members
    WHERE organization_id = p_organization_id AND invited_email = p_email;

    IF v_existing_invite IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_invitation');
    END IF;

    -- NEW: Check duplicate across OTHER orgs (pending invites only)
    SELECT id INTO v_existing_invite
    FROM organization_members
    WHERE invited_email = p_email AND license_status = 'pending';

    IF v_existing_invite IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_invitation');
    END IF;

    -- NEW: Cross-table check — also check individual_invitations for pending invite
    SELECT id INTO v_existing_invite
    FROM individual_invitations
    WHERE invited_email = p_email AND accepted_at IS NULL;

    IF v_existing_invite IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_invitation');
    END IF;

    SELECT id INTO v_existing_user_id FROM users WHERE email = p_email;
    IF v_existing_user_id IS NOT NULL THEN
      SELECT id INTO v_existing_member
      FROM organization_members
      WHERE organization_id = p_organization_id AND user_id = v_existing_user_id;

      IF v_existing_member IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_member');
      END IF;
    END IF;

    IF v_max_seats IS NOT NULL THEN
      SELECT count(*) INTO v_member_count
      FROM organization_members
      WHERE organization_id = p_organization_id
        AND license_status IN ('active', 'pending');

      IF v_member_count >= v_max_seats THEN
        RETURN jsonb_build_object('success', false, 'error', 'seat_limit_reached');
      END IF;
    END IF;

    INSERT INTO organization_members (
      organization_id, invited_email, role, license_status,
      invitation_token, invitation_expires_at, invited_by, invited_at,
      provisioned_by, provisioning_metadata
    ) VALUES (
      p_organization_id, p_email, COALESCE(p_role, 'agent'), 'pending',
      v_token, v_expires_at, p_invited_by, now(),
      'invite', jsonb_build_object('intended_license_status', p_license_status, 'plan_id', p_plan_id)
    );

    INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, metadata)
    VALUES (v_caller_id, 'invite_user', 'organization_member', p_organization_id,
      jsonb_build_object('email', p_email, 'role', p_role, 'org_name', v_org_name));

    RETURN jsonb_build_object('success', true, 'invitation_token', v_token, 'org_name', v_org_name);

  -- INDIVIDUAL PATH
  ELSE
    -- Check duplicate in individual_invitations (existing check)
    SELECT id INTO v_existing_invite
    FROM individual_invitations WHERE invited_email = p_email AND accepted_at IS NULL;

    IF v_existing_invite IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_invitation');
    END IF;

    -- NEW: Cross-table check — also check organization_members for pending invite
    SELECT id INTO v_existing_invite
    FROM organization_members
    WHERE invited_email = p_email AND license_status = 'pending';

    IF v_existing_invite IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'duplicate_invitation');
    END IF;

    INSERT INTO individual_invitations (
      invited_email, invitation_token, invitation_expires_at, invited_by,
      invited_at, license_status, plan_id
    ) VALUES (
      p_email, v_token, v_expires_at, p_invited_by,
      now(), COALESCE(p_license_status, 'trial'), p_plan_id
    );

    INSERT INTO admin_audit_logs (actor_id, action, target_type, target_id, metadata)
    VALUES (v_caller_id, 'invite_individual_user', 'user', v_caller_id,
      jsonb_build_object('email', p_email, 'license_status', p_license_status));

    RETURN jsonb_build_object('success', true, 'invitation_token', v_token, 'org_name', NULL);
  END IF;
END;
$function$;
