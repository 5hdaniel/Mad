-- TASK-1925: Create jit_join_organization RPC
-- Allows authenticated Azure AD users from KNOWN tenants to auto-join their organization
-- with the org's default_member_role (fallback: 'agent')
--
-- This replaces the previous behavior where ALL Azure users were auto-provisioned
-- as IT admins in potentially new duplicate organizations.
--
-- Pattern: Follows auto_provision_it_admin RPC (SECURITY DEFINER, same email fallback chain)

CREATE OR REPLACE FUNCTION public.jit_join_organization(p_tenant_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_oauth_id TEXT;
  v_org_id UUID;
  v_org_role TEXT;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Defense-in-depth: Block consumer tenant (personal Microsoft accounts)
  -- Consumer tenant ID is for Outlook.com, Hotmail, etc. - never a valid org
  IF p_tenant_id = '9188040d-6c67-4c5b-b112-36a304b66dad' THEN
    RETURN jsonb_build_object('success', false, 'error', 'consumer_tenant');
  END IF;

  -- Look up organization by microsoft_tenant_id
  SELECT id, COALESCE(default_member_role, 'agent')
  INTO v_org_id, v_org_role
  FROM organizations
  WHERE microsoft_tenant_id = p_tenant_id;

  -- If org not found, return error (caller should redirect to error page)
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'org_not_found');
  END IF;

  -- Get user email with fallback chain (same as auto_provision_it_admin)
  -- Microsoft may not populate auth.users.email for external tenants
  SELECT
    COALESCE(
      email,
      raw_user_meta_data->>'email',
      raw_user_meta_data->>'mail',
      raw_user_meta_data->>'preferred_username'
    ),
    raw_user_meta_data->>'provider_id'
  INTO v_user_email, v_oauth_id
  FROM auth.users
  WHERE id = v_user_id;

  -- Use user_id as fallback for oauth_id if not found
  IF v_oauth_id IS NULL THEN
    v_oauth_id := v_user_id::text;
  END IF;

  -- Ensure user exists in public.users table
  INSERT INTO users (id, email, oauth_provider, oauth_id, provisioning_source, jit_provisioned, jit_provisioned_at)
  VALUES (v_user_id, v_user_email, 'azure', v_oauth_id, 'jit', true, NOW())
  ON CONFLICT (id) DO UPDATE SET
    provisioning_source = CASE
      WHEN users.provisioning_source = 'manual' THEN 'jit'
      ELSE users.provisioning_source
    END,
    jit_provisioned = true,
    jit_provisioned_at = COALESCE(users.jit_provisioned_at, NOW());

  -- Check if membership already exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = v_user_id AND organization_id = v_org_id
  ) THEN
    -- Already a member, return success with existing role
    RETURN jsonb_build_object(
      'success', true,
      'organization_id', v_org_id,
      'role', (SELECT role FROM organization_members WHERE user_id = v_user_id AND organization_id = v_org_id),
      'already_member', true
    );
  END IF;

  -- Create membership with org's default role
  INSERT INTO organization_members (
    organization_id, user_id, role, joined_at,
    license_status, provisioned_by, provisioned_at
  )
  VALUES (
    v_org_id, v_user_id, v_org_role, NOW(),
    'active', 'jit', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'role', v_org_role,
    'already_member', false
  );
END;
$$;
