-- ============================================================================
-- Migration: admin_create_organization RPC
-- Task: BACKLOG-1509
--
-- Creates an organization with name, slug (derived from name), and max_seats.
-- Does NOT set the legacy `plan` column — plan assignment is a separate step
-- via admin_assign_org_plan.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_organization(
  p_name      TEXT,
  p_max_seats INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_role BOOLEAN;
  v_has_perm BOOLEAN;
  v_slug     TEXT;
  v_org_id   UUID;
BEGIN
  -- Auth check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Internal role check
  SELECT public.has_internal_role(v_admin_id) INTO v_has_role;
  IF NOT v_has_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_internal_user');
  END IF;

  -- Permission check
  SELECT public.has_permission(v_admin_id, 'organizations.edit') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Validate name
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  -- Derive slug from name
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  -- Strip leading/trailing hyphens
  v_slug := trim(both '-' from v_slug);

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'duplicate_slug',
      'message', format('An organization with slug "%s" already exists. Please choose a different name.', v_slug)
    );
  END IF;

  -- Insert the organization (do NOT set the legacy `plan` column)
  INSERT INTO public.organizations (name, slug, max_seats)
  VALUES (trim(p_name), v_slug, p_max_seats)
  RETURNING id INTO v_org_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'organization.created',
    'organization',
    v_org_id::text,
    jsonb_build_object(
      'name',      trim(p_name),
      'slug',      v_slug,
      'max_seats', p_max_seats
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id',      v_org_id,
    'slug',    v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_organization(TEXT, INTEGER) TO authenticated;
