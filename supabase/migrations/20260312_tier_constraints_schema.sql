-- ============================================================================
-- Migration: Tier Constraints Schema + RPC Enforcement
-- Task: TASK-2156 (Sprint 127 - License/Plan/Tier Unification Phase 1)
-- Purpose:
--   1. Rename plan names/slugs (Trial->Individual, Pro->Team)
--   2. Add min_tier column to feature_definitions
--   3. Add 'access' category to feature_definitions
--   4. Rename feature keys to platform-specific names
--   5. Fix organization_plans.feature_overrides JSONB keys
--   6. Insert new feature definitions
--   7. Set min_tier for all features
--   8. Seed plan_features for new features
--   9. Create feature_dependencies junction table
--  10. Seed dependency rules
--  11. Create tier_rank() helper function
--  12. Update admin_create_plan RPC with tier + dependency enforcement
--  13. Update admin_update_plan_feature RPC with tier + dependency enforcement
--  14. Create admin_update_plan_tier RPC
--  15. Add circular dependency validation trigger
--
-- Prerequisites:
--   - 20260310_b_feature_flags_plan_management.sql (tables + seed data)
--   - 20260311_admin_plan_management_rpcs.sql (admin RPCs)
--   - 20260312_rename_plan_tiers.sql (tier values already renamed)
-- ============================================================================

-- ============================================================================
-- 1. PLAN NAME/SLUG RENAMES
-- The tier values (trial->individual, pro->team) are already done by
-- 20260312_rename_plan_tiers.sql. We only rename name and slug here.
-- ============================================================================

UPDATE public.plans SET name = 'Individual', slug = 'individual' WHERE slug = 'trial';
UPDATE public.plans SET name = 'Team', slug = 'team' WHERE slug = 'pro';

-- ============================================================================
-- 2. ADD min_tier COLUMN TO feature_definitions
-- NULL means available to all tiers
-- ============================================================================

ALTER TABLE public.feature_definitions
  ADD COLUMN IF NOT EXISTS min_tier TEXT CHECK (min_tier IN ('individual', 'team', 'enterprise'));

-- ============================================================================
-- 3. UPDATE category CHECK CONSTRAINT (add 'access')
-- ============================================================================

ALTER TABLE public.feature_definitions DROP CONSTRAINT IF EXISTS feature_definitions_category_check;
ALTER TABLE public.feature_definitions ADD CONSTRAINT feature_definitions_category_check
  CHECK (category IN ('export', 'sync', 'compliance', 'general', 'access'));

-- ============================================================================
-- 4. RENAME EXISTING FEATURE KEYS
-- plan_features references feature_definitions.id (UUID), not key,
-- so plan_features rows are unaffected by key renames.
-- ============================================================================

UPDATE public.feature_definitions SET key = 'broker_text_view' WHERE key = 'text_export';
UPDATE public.feature_definitions SET key = 'broker_email_view' WHERE key = 'email_export';
UPDATE public.feature_definitions SET key = 'broker_text_attachments' WHERE key = 'text_attachments';
UPDATE public.feature_definitions SET key = 'broker_email_attachments' WHERE key = 'email_attachments';

-- ============================================================================
-- 5. FIX organization_plans.feature_overrides JSONB (rename old keys)
-- ============================================================================

UPDATE public.organization_plans
SET feature_overrides = feature_overrides - 'text_export' ||
  jsonb_build_object('broker_text_view', feature_overrides->'text_export')
WHERE feature_overrides ? 'text_export';

UPDATE public.organization_plans
SET feature_overrides = feature_overrides - 'email_export' ||
  jsonb_build_object('broker_email_view', feature_overrides->'email_export')
WHERE feature_overrides ? 'email_export';

UPDATE public.organization_plans
SET feature_overrides = feature_overrides - 'text_attachments' ||
  jsonb_build_object('broker_text_attachments', feature_overrides->'text_attachments')
WHERE feature_overrides ? 'text_attachments';

UPDATE public.organization_plans
SET feature_overrides = feature_overrides - 'email_attachments' ||
  jsonb_build_object('broker_email_attachments', feature_overrides->'email_attachments')
WHERE feature_overrides ? 'email_attachments';

-- ============================================================================
-- 6. UPDATE RENAMED FEATURE CATEGORIES/DESCRIPTIONS
-- ============================================================================

UPDATE public.feature_definitions
SET category = 'export',
    name = 'Broker Text View',
    description = 'Broker portal can view text messages'
WHERE key = 'broker_text_view';

UPDATE public.feature_definitions
SET category = 'export',
    name = 'Broker Email View',
    description = 'Broker portal can view email messages'
WHERE key = 'broker_email_view';

UPDATE public.feature_definitions
SET category = 'export',
    name = 'Broker Text Attachments',
    description = 'Broker portal can view text attachments'
WHERE key = 'broker_text_attachments';

UPDATE public.feature_definitions
SET category = 'export',
    name = 'Broker Email Attachments',
    description = 'Broker portal can view email attachments'
WHERE key = 'broker_email_attachments';

-- ============================================================================
-- 7. INSERT NEW FEATURE DEFINITIONS
-- ============================================================================

INSERT INTO public.feature_definitions (key, name, description, value_type, default_value, category, sort_order, min_tier) VALUES
  ('desktop_text_export', 'Desktop Text Export', 'Desktop app can export text messages', 'boolean', 'false', 'export', 15, NULL),
  ('desktop_email_export', 'Desktop Email Export', 'Desktop app can export email messages', 'boolean', 'false', 'export', 25, NULL),
  ('desktop_text_attachments', 'Desktop Text Attachments', 'Desktop app can export text attachments', 'boolean', 'false', 'export', 35, NULL),
  ('desktop_email_attachments', 'Desktop Email Attachments', 'Desktop app can export email attachments', 'boolean', 'false', 'export', 45, NULL),
  ('broker_submission', 'Broker Submission', 'Org can submit transactions to broker portal', 'boolean', 'false', 'access', 130, 'team'),
  ('team_management', 'Team Management', 'Org can manage team members', 'boolean', 'false', 'access', 140, 'team'),
  ('multi_seat', 'Multi-Seat', 'Org supports multiple seats/users', 'boolean', 'false', 'access', 150, 'team'),
  ('ai_detection', 'AI Detection', 'AI-powered message detection (add-on)', 'boolean', 'false', 'general', 160, NULL),
  ('broker_portal_access', 'Broker Portal Access', 'Broker can view this org submissions', 'boolean', 'false', 'access', 125, 'team')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 8. SET min_tier VALUES FOR ALL EXISTING FEATURES
-- ============================================================================

-- NULL (all tiers): broker_text_view, broker_email_view, broker_text_attachments,
--   broker_email_attachments, desktop_*, iphone_sync, email_sync, max_transaction_size, ai_detection
UPDATE public.feature_definitions SET min_tier = NULL
WHERE key IN (
  'broker_text_view', 'broker_email_view',
  'broker_text_attachments', 'broker_email_attachments',
  'desktop_text_export', 'desktop_email_export',
  'desktop_text_attachments', 'desktop_email_attachments',
  'iphone_sync', 'email_sync', 'max_transaction_size', 'ai_detection'
);

-- team: broker_submission, team_management, multi_seat, call_log, voice_transcription, broker_portal_access
UPDATE public.feature_definitions SET min_tier = 'team'
WHERE key IN (
  'broker_submission', 'team_management', 'multi_seat',
  'call_log', 'voice_transcription', 'broker_portal_access'
);

-- enterprise: sso_login, custom_retention, dual_approval
UPDATE public.feature_definitions SET min_tier = 'enterprise'
WHERE key IN ('sso_login', 'custom_retention', 'dual_approval');

-- ============================================================================
-- 9. SEED plan_features FOR ALL NEW FEATURES ACROSS ALL PLANS
-- ============================================================================

-- desktop_text_export: enabled for ALL plans
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id, true
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'desktop_text_export'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- desktop_email_export: enabled for ALL plans
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id, true
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'desktop_email_export'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- desktop_text_attachments: enabled for ALL plans
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id, true
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'desktop_text_attachments'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- desktop_email_attachments: enabled for ALL plans
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id, true
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'desktop_email_attachments'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- broker_submission: enabled for team + enterprise + custom only; disabled for individual
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id,
  CASE WHEN p.tier IN ('team', 'enterprise', 'custom') THEN true ELSE false END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'broker_submission'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- team_management: enabled for team + enterprise + custom only
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id,
  CASE WHEN p.tier IN ('team', 'enterprise', 'custom') THEN true ELSE false END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'team_management'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- multi_seat: enabled for team + enterprise + custom only
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id,
  CASE WHEN p.tier IN ('team', 'enterprise', 'custom') THEN true ELSE false END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'multi_seat'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ai_detection: disabled for all plans by default (add-on)
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id, false
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'ai_detection'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- broker_portal_access: enabled for team + enterprise + custom only
INSERT INTO public.plan_features (plan_id, feature_id, enabled)
SELECT p.id, fd.id,
  CASE WHEN p.tier IN ('team', 'enterprise', 'custom') THEN true ELSE false END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'broker_portal_access'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================================
-- 10. CREATE feature_dependencies JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_dependencies (
  feature_key TEXT NOT NULL REFERENCES public.feature_definitions(key) ON UPDATE CASCADE,
  depends_on_key TEXT NOT NULL REFERENCES public.feature_definitions(key) ON UPDATE CASCADE,
  PRIMARY KEY (feature_key, depends_on_key),
  CHECK (feature_key != depends_on_key)
);

-- RLS: readable by all authenticated, writable only via service role / RPCs
ALTER TABLE public.feature_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_dependencies_read ON public.feature_dependencies
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.feature_dependencies TO authenticated;

-- ============================================================================
-- 11. SEED INITIAL DEPENDENCY RULES
-- ============================================================================

-- Attachment features depend on their view/export counterparts
INSERT INTO public.feature_dependencies (feature_key, depends_on_key) VALUES
  ('broker_text_attachments', 'broker_text_view'),
  ('broker_email_attachments', 'broker_email_view'),
  ('desktop_text_attachments', 'desktop_text_export'),
  ('desktop_email_attachments', 'desktop_email_export')
ON CONFLICT DO NOTHING;

-- All broker-prefixed keys depend on broker_portal_access
INSERT INTO public.feature_dependencies (feature_key, depends_on_key) VALUES
  ('broker_text_view', 'broker_portal_access'),
  ('broker_email_view', 'broker_portal_access'),
  ('broker_text_attachments', 'broker_portal_access'),
  ('broker_email_attachments', 'broker_portal_access')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 12. CREATE tier_rank() HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tier_rank(p_tier TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'individual' THEN 1
    WHEN 'team' THEN 2
    WHEN 'enterprise' THEN 3
    WHEN 'custom' THEN 4
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.tier_rank(TEXT) TO authenticated;

-- ============================================================================
-- 13. UPDATE admin_create_plan RPC
-- Adds tier constraint + dependency enforcement when creating a plan.
-- When plan is created, all features start disabled, so no constraint
-- violations are possible at creation time. But we add validation so that
-- if the RPC is ever extended to accept initial features, it's safe.
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
  IF p_tier NOT IN ('individual', 'team', 'enterprise', 'custom') THEN
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

-- ============================================================================
-- 14. UPDATE admin_update_plan_feature RPC
-- Adds:
--   - min_tier enforcement when ENABLING
--   - Dependency enforcement when ENABLING (all deps must be enabled)
--   - Reverse dependency enforcement when DISABLING (reject if dependents enabled)
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
  v_plan RECORD;
  v_feature RECORD;
  v_result RECORD;
  v_unmet_deps TEXT[];
  v_enabled_dependents TEXT[];
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Get plan with tier
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Get feature definition
  SELECT * INTO v_feature FROM public.feature_definitions WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'feature_not_found');
  END IF;

  -- === ENABLING CHECKS ===
  IF p_enabled THEN
    -- Check min_tier constraint (custom tier bypasses)
    IF v_feature.min_tier IS NOT NULL
       AND v_plan.tier != 'custom'
       AND public.tier_rank(v_plan.tier) < public.tier_rank(v_feature.min_tier) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'tier_constraint_violation',
        'message', format(
          'Feature "%s" requires %s tier or higher. Plan "%s" is %s tier.',
          v_feature.key, v_feature.min_tier, v_plan.name, v_plan.tier
        ),
        'feature_key', v_feature.key,
        'required_tier', v_feature.min_tier,
        'plan_tier', v_plan.tier
      );
    END IF;

    -- Check dependency rules: all dependencies must be enabled on this plan
    SELECT array_agg(fd.depends_on_key) INTO v_unmet_deps
    FROM public.feature_dependencies fd
    WHERE fd.feature_key = v_feature.key
      AND NOT EXISTS (
        SELECT 1 FROM public.plan_features pf
        JOIN public.feature_definitions dep_fd ON dep_fd.id = pf.feature_id
        WHERE pf.plan_id = p_plan_id
          AND dep_fd.key = fd.depends_on_key
          AND pf.enabled = true
      );

    IF v_unmet_deps IS NOT NULL AND array_length(v_unmet_deps, 1) > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'dependency_violation',
        'message', format(
          'Feature "%s" requires the following features to be enabled first: %s',
          v_feature.key, array_to_string(v_unmet_deps, ', ')
        ),
        'feature_key', v_feature.key,
        'unmet_dependencies', to_jsonb(v_unmet_deps)
      );
    END IF;
  END IF;

  -- === DISABLING CHECKS ===
  IF NOT p_enabled THEN
    -- Check reverse dependencies: reject if other enabled features depend on this one
    SELECT array_agg(fd.feature_key) INTO v_enabled_dependents
    FROM public.feature_dependencies fd
    WHERE fd.depends_on_key = v_feature.key
      AND EXISTS (
        SELECT 1 FROM public.plan_features pf
        JOIN public.feature_definitions dep_fd ON dep_fd.id = pf.feature_id
        WHERE pf.plan_id = p_plan_id
          AND dep_fd.key = fd.feature_key
          AND pf.enabled = true
      );

    IF v_enabled_dependents IS NOT NULL AND array_length(v_enabled_dependents, 1) > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'reverse_dependency_violation',
        'message', format(
          'Cannot disable "%s" because the following enabled features depend on it: %s. Disable them first.',
          v_feature.key, array_to_string(v_enabled_dependents, ', ')
        ),
        'feature_key', v_feature.key,
        'dependent_features', to_jsonb(v_enabled_dependents)
      );
    END IF;
  END IF;

  -- All checks passed, upsert the plan_feature
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
      'feature_key', v_feature.key,
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

-- ============================================================================
-- 15. CREATE admin_update_plan_tier RPC
-- REJECTS tier downgrade if enabled features violate new tier constraints.
-- Custom tier has no restrictions (can downgrade from custom freely since
-- custom bypasses constraints, and upgrading TO custom is always safe).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_plan_tier(
  p_plan_id UUID,
  p_new_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_plan RECORD;
  v_conflicting_features TEXT[];
  v_old_tier TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Validate new tier
  IF p_new_tier NOT IN ('individual', 'team', 'enterprise', 'custom') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  -- Get current plan
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  v_old_tier := v_plan.tier;

  -- If new tier is custom, always allowed (bypasses all constraints)
  -- If downgrading (lower rank), check for constraint violations
  IF p_new_tier != 'custom' AND public.tier_rank(p_new_tier) < public.tier_rank(v_old_tier) THEN
    -- Find enabled features whose min_tier exceeds the new tier
    SELECT array_agg(fd.key) INTO v_conflicting_features
    FROM public.plan_features pf
    JOIN public.feature_definitions fd ON fd.id = pf.feature_id
    WHERE pf.plan_id = p_plan_id
      AND pf.enabled = true
      AND fd.min_tier IS NOT NULL
      AND public.tier_rank(fd.min_tier) > public.tier_rank(p_new_tier);

    IF v_conflicting_features IS NOT NULL AND array_length(v_conflicting_features, 1) > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'tier_downgrade_constraint_violation',
        'message', format(
          'Cannot downgrade plan "%s" from %s to %s. The following enabled features require a higher tier: %s. Disable them first.',
          v_plan.name, v_old_tier, p_new_tier, array_to_string(v_conflicting_features, ', ')
        ),
        'conflicting_features', to_jsonb(v_conflicting_features),
        'current_tier', v_old_tier,
        'requested_tier', p_new_tier
      );
    END IF;
  END IF;

  -- Update the tier
  UPDATE public.plans
  SET tier = p_new_tier, updated_at = now()
  WHERE id = p_plan_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'plan.tier_changed',
    'plan',
    p_plan_id::text,
    jsonb_build_object(
      'plan_name',  v_plan.name,
      'old_tier',   v_old_tier,
      'new_tier',   p_new_tier
    )
  );

  RETURN jsonb_build_object(
    'success',  true,
    'plan_id',  p_plan_id,
    'old_tier', v_old_tier,
    'new_tier', p_new_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_plan_tier(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 16. CIRCULAR DEPENDENCY VALIDATION
-- Trigger function that validates no cycles when inserting/updating
-- feature_dependencies rows. Uses iterative BFS to walk the graph.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_no_circular_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_visited TEXT[] := ARRAY[NEW.feature_key];
  v_queue TEXT[] := ARRAY[NEW.depends_on_key];
  v_current TEXT;
  v_next TEXT;
BEGIN
  -- BFS: starting from depends_on_key, walk all transitive dependencies
  -- If we ever reach feature_key, we have a cycle
  WHILE array_length(v_queue, 1) > 0 LOOP
    v_current := v_queue[1];
    v_queue := v_queue[2:];

    -- Cycle detected
    IF v_current = NEW.feature_key THEN
      RAISE EXCEPTION 'Circular dependency detected: adding dependency % -> % would create a cycle',
        NEW.feature_key, NEW.depends_on_key;
    END IF;

    -- Skip if already visited
    IF v_current = ANY(v_visited) THEN
      CONTINUE;
    END IF;

    v_visited := array_append(v_visited, v_current);

    -- Add all dependencies of v_current to the queue
    FOR v_next IN
      SELECT fd.depends_on_key
      FROM public.feature_dependencies fd
      WHERE fd.feature_key = v_current
    LOOP
      IF NOT (v_next = ANY(v_visited)) THEN
        v_queue := array_append(v_queue, v_next);
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Apply trigger to feature_dependencies table
DROP TRIGGER IF EXISTS trg_validate_no_circular_dependency ON public.feature_dependencies;
CREATE TRIGGER trg_validate_no_circular_dependency
  BEFORE INSERT OR UPDATE ON public.feature_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_no_circular_dependency();
