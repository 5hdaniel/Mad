-- ============================================
-- Fix get_org_features and check_feature_access RPCs
-- ============================================
-- Ref: SPRINT-126 TASK-2153 (fixes C4, I2 from SR review of PR #1124)
-- Note: Original migration 20260310_b_feature_flags_plan_management is deployed
-- but has bugs. This migration replaces the functions with corrected logic.
--
-- C4: get_org_features used `IF v_org_plan IS NOT NULL` which is always true
--     for a RECORD type (even when SELECT INTO returns no rows). Fixed to use
--     a `v_has_plan BOOLEAN` flag set via `v_has_plan := FOUND` after SELECT INTO.
--
-- I2: get_org_features error response returned '[]'::jsonb (array) but success
--     path returns a JSONB object. Fixed to return consistent object format.
--
-- check_feature_access: Made consistent with get_org_features by using the
--     same FOUND flag pattern instead of `IF NOT FOUND THEN`.
-- ============================================

-- ============================================
-- RPC: get_org_features (corrected)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_org_features(
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_org_plan RECORD;
  v_has_plan BOOLEAN := false;
  v_result JSONB := '{}';
  v_feature RECORD;
  v_plan_feature RECORD;
  v_override JSONB;
  v_enabled BOOLEAN;
  v_value TEXT;
  v_source TEXT;
BEGIN
  -- Verify caller is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    -- I2 fix: return consistent object format (not '[]'::jsonb)
    RETURN jsonb_build_object(
      'org_id', p_org_id,
      'plan_name', 'none',
      'plan_tier', 'none',
      'features', '{}'::jsonb,
      'error', 'not_authorized'
    );
  END IF;

  -- Get org's plan
  SELECT op.*, p.name as plan_name, p.tier as plan_tier INTO v_org_plan
  FROM public.organization_plans op
  JOIN public.plans p ON p.id = op.plan_id
  WHERE op.organization_id = p_org_id;

  -- C4 fix: use FOUND flag instead of checking record for NULL
  v_has_plan := FOUND;

  -- Iterate all features
  FOR v_feature IN SELECT * FROM public.feature_definitions ORDER BY sort_order, key
  LOOP
    v_enabled := v_feature.default_value = 'true';
    v_value := v_feature.default_value;
    v_source := 'default';

    IF v_has_plan THEN
      -- Check per-org override first
      v_override := v_org_plan.feature_overrides -> v_feature.key;
      IF v_override IS NOT NULL THEN
        v_enabled := COALESCE((v_override ->> 'enabled')::boolean, true);
        v_value := COALESCE(v_override ->> 'value', v_feature.default_value);
        v_source := 'override';
      ELSE
        -- Check plan-level feature
        SELECT * INTO v_plan_feature
        FROM public.plan_features pf
        WHERE pf.plan_id = v_org_plan.plan_id
          AND pf.feature_id = v_feature.id;

        IF FOUND THEN
          v_enabled := v_plan_feature.enabled;
          v_value := COALESCE(v_plan_feature.value, v_feature.default_value);
          v_source := 'plan';
        END IF;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_object(
      v_feature.key, jsonb_build_object(
        'enabled', v_enabled,
        'value', v_value,
        'value_type', v_feature.value_type,
        'name', v_feature.name,
        'source', v_source
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'plan_name', COALESCE(v_org_plan.plan_name, 'none'),
    'plan_tier', COALESCE(v_org_plan.plan_tier, 'none'),
    'features', v_result
  );
END;
$$;

-- ============================================
-- RPC: check_feature_access (consistency fix)
-- Uses FOUND flag pattern consistent with get_org_features
-- ============================================

CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_org_id UUID,
  p_feature_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_feature RECORD;
  v_plan_feature RECORD;
  v_org_plan RECORD;
  v_has_plan BOOLEAN := false;
  v_override JSONB;
  v_result_enabled BOOLEAN;
  v_result_value TEXT;
BEGIN
  -- 0. Verify caller is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'not_authorized');
  END IF;

  -- 1. Get the feature definition
  SELECT * INTO v_feature
  FROM public.feature_definitions
  WHERE key = p_feature_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'unknown_feature', 'feature_key', p_feature_key);
  END IF;

  -- 2. Get the org's plan
  SELECT op.*, p.tier INTO v_org_plan
  FROM public.organization_plans op
  JOIN public.plans p ON p.id = op.plan_id
  WHERE op.organization_id = p_org_id;

  v_has_plan := FOUND;

  IF NOT v_has_plan THEN
    -- No plan assigned: use feature default
    RETURN jsonb_build_object(
      'allowed', v_feature.default_value = 'true',
      'value', v_feature.default_value,
      'source', 'default'
    );
  END IF;

  -- 3. Check for per-org override
  v_override := v_org_plan.feature_overrides -> p_feature_key;
  IF v_override IS NOT NULL THEN
    v_result_enabled := COALESCE((v_override ->> 'enabled')::boolean, true);
    v_result_value := COALESCE(v_override ->> 'value', v_feature.default_value);
    RETURN jsonb_build_object(
      'allowed', v_result_enabled,
      'value', v_result_value,
      'source', 'override'
    );
  END IF;

  -- 4. Check plan-level feature
  SELECT * INTO v_plan_feature
  FROM public.plan_features pf
  WHERE pf.plan_id = v_org_plan.plan_id
    AND pf.feature_id = v_feature.id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', v_plan_feature.enabled,
      'value', COALESCE(v_plan_feature.value, v_feature.default_value),
      'source', 'plan'
    );
  END IF;

  -- 5. Feature not explicitly in plan: use default
  RETURN jsonb_build_object(
    'allowed', v_feature.default_value = 'true',
    'value', v_feature.default_value,
    'source', 'default'
  );
END;
$$;
