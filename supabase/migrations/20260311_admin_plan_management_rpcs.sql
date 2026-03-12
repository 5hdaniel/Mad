-- ============================================================================
-- Migration: Admin Plan Management RPCs
-- Task: TASK-2127 (Sprint 124 - Plan Admin UI)
-- Purpose: Create SECURITY DEFINER RPCs for plan management write operations.
--          The plans, plan_features, and organization_plans tables have SELECT-only
--          RLS — all writes must go through these permission-gated RPCs.
-- Dependencies: has_permission(), admin_audit_logs, admin_permissions,
--               admin_role_permissions, plans, plan_features, organization_plans,
--               feature_definitions tables
-- ============================================================================

-- ============================================================================
-- 1. Seed admin permissions for plan management
--    Uses ON CONFLICT DO NOTHING — permissions may already exist from manual SQL.
-- ============================================================================

INSERT INTO public.admin_permissions (key, label, description, category)
VALUES
  ('plans.view', 'View Plans', 'View plans and feature definitions', 'plans'),
  ('plans.manage', 'Manage Plans', 'Create, edit, and manage plans and feature assignments', 'plans')
ON CONFLICT (key) DO NOTHING;

-- Grant to super_admin and admin roles
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT ar.id, ap.id
FROM public.admin_roles ar
CROSS JOIN public.admin_permissions ap
WHERE ar.slug IN ('super_admin', 'admin')
  AND ap.key IN ('plans.view', 'plans.manage')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. RPC: admin_update_plan_feature
--    Upserts a single plan_features row (enabled + optional value override).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_plan_feature(
  p_plan_id    UUID,
  p_feature_id UUID,
  p_enabled    BOOLEAN,
  p_value      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_result   RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Verify plan exists
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = p_plan_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Verify feature exists
  IF NOT EXISTS (SELECT 1 FROM public.feature_definitions WHERE id = p_feature_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'feature_not_found');
  END IF;

  INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
  VALUES (p_plan_id, p_feature_id, p_enabled, p_value)
  ON CONFLICT (plan_id, feature_id)
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    value   = EXCLUDED.value
  RETURNING id, plan_id, feature_id, enabled, value INTO v_result;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'plan_feature.updated',
    'plan_feature',
    v_result.id::text,
    jsonb_build_object(
      'plan_id',    p_plan_id,
      'feature_id', p_feature_id,
      'enabled',    p_enabled,
      'value',      p_value
    )
  );

  RETURN jsonb_build_object(
    'success',    true,
    'id',         v_result.id,
    'plan_id',    v_result.plan_id,
    'feature_id', v_result.feature_id,
    'enabled',    v_result.enabled,
    'value',      v_result.value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_plan_feature(UUID, UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================================
-- 3. RPC: admin_create_plan
--    Inserts a new plan and seeds default plan_features rows (enabled=false).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_plan(
  p_name        TEXT,
  p_slug        TEXT,
  p_tier        TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_plan_id  UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Validate tier
  IF p_tier NOT IN ('trial', 'pro', 'enterprise', 'custom') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  -- Insert the new plan
  INSERT INTO public.plans (name, slug, tier, description)
  VALUES (p_name, p_slug, p_tier, p_description)
  RETURNING id INTO v_plan_id;

  -- Seed default plan_features for all feature_definitions (disabled by default)
  INSERT INTO public.plan_features (plan_id, feature_id, enabled)
  SELECT v_plan_id, fd.id, false
  FROM public.feature_definitions fd
  ON CONFLICT (plan_id, feature_id) DO NOTHING;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'plan.created',
    'plan',
    v_plan_id::text,
    jsonb_build_object(
      'name',        p_name,
      'slug',        p_slug,
      'tier',        p_tier,
      'description', p_description
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id',      v_plan_id,
    'name',    p_name,
    'slug',    p_slug,
    'tier',    p_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_plan(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 4. RPC: admin_assign_org_plan
--    Upserts organization_plans so changing plans just updates the row.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_assign_org_plan(
  p_org_id  UUID,
  p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_result   RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Verify org exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'organization_not_found');
  END IF;

  -- Verify plan exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = p_plan_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  INSERT INTO public.organization_plans (organization_id, plan_id, assigned_by, assigned_at)
  VALUES (p_org_id, p_plan_id, v_admin_id, now())
  ON CONFLICT (organization_id)
  DO UPDATE SET
    plan_id     = EXCLUDED.plan_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at,
    updated_at  = now()
  RETURNING id, organization_id, plan_id, assigned_by, assigned_at INTO v_result;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'org_plan.assigned',
    'organization',
    p_org_id::text,
    jsonb_build_object(
      'organization_id', p_org_id,
      'plan_id',         p_plan_id,
      'record_id',       v_result.id
    )
  );

  RETURN jsonb_build_object(
    'success',         true,
    'id',              v_result.id,
    'organization_id', v_result.organization_id,
    'plan_id',         v_result.plan_id,
    'assigned_by',     v_result.assigned_by,
    'assigned_at',     v_result.assigned_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_org_plan(UUID, UUID) TO authenticated;
