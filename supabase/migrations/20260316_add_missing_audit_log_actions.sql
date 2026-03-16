-- ============================================================================
-- Migration: Add Missing Audit Log Actions
-- Task: TASK-2190 / BACKLOG-863 (SPRINT-134)
-- Purpose: Convert admin RPCs from direct INSERT INTO admin_audit_logs to use
--          the centralized log_admin_action() RPC. This centralizes all audit
--          logging through a single function for consistency and maintainability.
--
-- RPCs updated (8 direct-INSERT -> log_admin_action):
--   1. admin_assign_org_plan
--   2. admin_create_plan
--   3. admin_delete_plan
--   4. admin_end_impersonation
--   5. admin_start_impersonation
--   6. admin_toggle_plan_active
--   7. admin_update_plan_feature
--   8. admin_update_plan_tier
--
-- RPCs with NEW audit logging (1):
--   9. admin_validate_impersonation_token  (had NO audit logging)
--
-- NOTE: This migration preserves ALL existing business logic. The ONLY change
-- in each function is replacing the direct INSERT INTO admin_audit_logs with
-- PERFORM log_admin_action(...). No parameters, validation, or return values
-- are altered.
-- ============================================================================


-- ============================================================================
-- 1. admin_assign_org_plan
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
  v_admin_id  UUID;
  v_has_perm  BOOLEAN;
  v_plan_tier TEXT;
  v_result    RECORD;
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

  -- Block Individual-tier plans from org assignment (BACKLOG-936)
  SELECT tier INTO v_plan_tier FROM public.plans WHERE id = p_plan_id AND is_active = true;
  IF v_plan_tier = 'individual' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'individual_plan_cannot_be_assigned_to_org',
      'message', 'Individual plans cannot be assigned to organizations. Use Team, Enterprise, or Custom plans.'
    );
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

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
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


-- ============================================================================
-- 2. admin_create_plan
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

  IF p_tier NOT IN ('individual', 'team', 'enterprise', 'custom') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  INSERT INTO public.plans (name, slug, tier, description)
  VALUES (p_name, p_slug, p_tier, p_description)
  RETURNING id INTO v_plan_id;

  INSERT INTO public.plan_features (plan_id, feature_id, enabled)
  SELECT v_plan_id, fd.id, false
  FROM public.feature_definitions fd
  ON CONFLICT (plan_id, feature_id) DO NOTHING;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
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
-- 3. admin_delete_plan
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_plan(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id  UUID;
  v_has_perm  BOOLEAN;
  v_plan_name TEXT;
  v_org_count INTEGER;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Get plan name
  SELECT name INTO v_plan_name FROM public.plans WHERE id = p_plan_id;
  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Check if any orgs are assigned to this plan
  SELECT COUNT(*) INTO v_org_count
  FROM public.organization_plans
  WHERE plan_id = p_plan_id;

  IF v_org_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'plan_has_organizations',
      'org_count', v_org_count,
      'message', format('Cannot delete plan "%s": %s organization(s) are assigned to it. Reassign them first.', v_plan_name, v_org_count)
    );
  END IF;

  -- Delete plan features first (FK constraint)
  DELETE FROM public.plan_features WHERE plan_id = p_plan_id;

  -- Delete the plan
  DELETE FROM public.plans WHERE id = p_plan_id;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
    'plan.deleted',
    'plan',
    p_plan_id::text,
    jsonb_build_object('name', v_plan_name)
  );

  RETURN jsonb_build_object('success', true, 'name', v_plan_name);
END;
$$;


-- ============================================================================
-- 4. admin_end_impersonation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_end_impersonation(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_session  RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Find the session (must belong to this admin, active or validated)
  SELECT * INTO v_session
  FROM public.impersonation_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id AND status IN ('active', 'validated');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  -- End the session
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE id = p_session_id;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
    'user.impersonate.end',
    'user',
    v_session.target_user_id::text,
    jsonb_build_object(
      'session_id', p_session_id,
      'target_user_id', v_session.target_user_id,
      'duration_seconds', EXTRACT(EPOCH FROM (now() - v_session.started_at))::int
    )
  );

  RETURN jsonb_build_object('success', true, 'session_id', p_session_id);
END;
$$;


-- ============================================================================
-- 5. admin_start_impersonation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_start_impersonation(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id           UUID;
  v_has_perm           BOOLEAN;
  v_target_status      TEXT;
  v_session_id         UUID;
  v_token              TEXT;
  v_expires_at         TIMESTAMPTZ;
  v_session_expires_at TIMESTAMPTZ;
BEGIN
  -- Get calling user
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Verify users.impersonate permission
  SELECT public.has_permission(v_admin_id, 'users.impersonate') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  -- Prevent self-impersonation
  IF v_admin_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_impersonate_self');
  END IF;

  -- Verify target user exists AND is not suspended (BACKLOG-901)
  SELECT raw_app_meta_data->>'status'
  INTO v_target_status
  FROM auth.users
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF v_target_status = 'suspended' OR v_target_status = 'banned' THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_suspended');
  END IF;

  -- End any existing active or validated sessions for this admin
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE admin_user_id = v_admin_id AND status IN ('active', 'validated');

  -- BACKLOG-902: End any existing active or validated sessions for target user
  -- Prevents two admins from impersonating the same user simultaneously
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE target_user_id = p_target_user_id AND status IN ('active', 'validated');

  -- Create new session
  -- expires_at = token expiry (60 seconds - only needs to survive the redirect)
  -- session_expires_at = session expiry (always 30 minutes)
  v_expires_at := now() + interval '60 seconds';
  v_session_expires_at := now() + interval '30 minutes';

  INSERT INTO public.impersonation_sessions (
    admin_user_id, target_user_id, token, expires_at, session_expires_at
  )
  VALUES (
    v_admin_id, p_target_user_id,
    encode(gen_random_bytes(32), 'hex'),
    v_expires_at, v_session_expires_at
  )
  RETURNING id, token INTO v_session_id, v_token;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
    'user.impersonate.start',
    'user',
    p_target_user_id::text,
    jsonb_build_object(
      'session_id', v_session_id,
      'target_user_id', p_target_user_id,
      'expires_at', v_expires_at,
      'session_expires_at', v_session_expires_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'token', v_token,
    'expires_at', v_expires_at,
    'session_expires_at', v_session_expires_at,
    'target_user_id', p_target_user_id
  );
END;
$$;


-- ============================================================================
-- 6. admin_toggle_plan_active
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_toggle_plan_active(
  p_plan_id   UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id          UUID;
  v_has_perm          BOOLEAN;
  v_plan_name         TEXT;
  v_previous_is_active BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  SELECT name, is_active INTO v_plan_name, v_previous_is_active FROM public.plans WHERE id = p_plan_id;
  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  UPDATE public.plans SET is_active = p_is_active, updated_at = now() WHERE id = p_plan_id;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
    'plan.toggled',
    'plan',
    p_plan_id::text,
    jsonb_build_object('name', v_plan_name, 'previous_is_active', v_previous_is_active, 'new_is_active', p_is_active)
  );

  RETURN jsonb_build_object('success', true, 'previous_is_active', v_previous_is_active);
END;
$$;


-- ============================================================================
-- 7. admin_update_plan_feature
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
  v_admin_id           UUID;
  v_has_perm           BOOLEAN;
  v_plan               RECORD;
  v_feature            RECORD;
  v_result             RECORD;
  v_unmet_deps         TEXT[];
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

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  SELECT * INTO v_feature FROM public.feature_definitions WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'feature_not_found');
  END IF;

  -- ENABLING CHECKS
  IF p_enabled THEN
    -- Check min_tier (custom bypasses)
    IF v_feature.min_tier IS NOT NULL
       AND v_plan.tier != 'custom'
       AND public.tier_rank(v_plan.tier) < public.tier_rank(v_feature.min_tier) THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'tier_constraint_violation',
        'message', format('Feature "%s" requires %s tier or higher. Plan "%s" is %s tier.',
          v_feature.key, v_feature.min_tier, v_plan.name, v_plan.tier),
        'feature_key', v_feature.key, 'required_tier', v_feature.min_tier, 'plan_tier', v_plan.tier
      );
    END IF;

    -- Check dependencies
    SELECT array_agg(fd.depends_on_key) INTO v_unmet_deps
    FROM public.feature_dependencies fd
    WHERE fd.feature_key = v_feature.key
      AND NOT EXISTS (
        SELECT 1 FROM public.plan_features pf
        JOIN public.feature_definitions dep_fd ON dep_fd.id = pf.feature_id
        WHERE pf.plan_id = p_plan_id AND dep_fd.key = fd.depends_on_key AND pf.enabled = true
      );

    IF v_unmet_deps IS NOT NULL AND array_length(v_unmet_deps, 1) > 0 THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'dependency_violation',
        'message', format('Feature "%s" requires the following features to be enabled first: %s',
          v_feature.key, array_to_string(v_unmet_deps, ', ')),
        'feature_key', v_feature.key, 'unmet_dependencies', to_jsonb(v_unmet_deps)
      );
    END IF;
  END IF;

  -- DISABLING CHECKS
  IF NOT p_enabled THEN
    SELECT array_agg(fd.feature_key) INTO v_enabled_dependents
    FROM public.feature_dependencies fd
    WHERE fd.depends_on_key = v_feature.key
      AND EXISTS (
        SELECT 1 FROM public.plan_features pf
        JOIN public.feature_definitions dep_fd ON dep_fd.id = pf.feature_id
        WHERE pf.plan_id = p_plan_id AND dep_fd.key = fd.feature_key AND pf.enabled = true
      );

    IF v_enabled_dependents IS NOT NULL AND array_length(v_enabled_dependents, 1) > 0 THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'reverse_dependency_violation',
        'message', format('Cannot disable "%s" because the following enabled features depend on it: %s. Disable them first.',
          v_feature.key, array_to_string(v_enabled_dependents, ', ')),
        'feature_key', v_feature.key, 'dependent_features', to_jsonb(v_enabled_dependents)
      );
    END IF;
  END IF;

  -- Upsert
  INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
  VALUES (p_plan_id, p_feature_id, p_enabled, p_value)
  ON CONFLICT (plan_id, feature_id) DO UPDATE SET enabled = EXCLUDED.enabled, value = EXCLUDED.value
  RETURNING id, plan_id, feature_id, enabled, value INTO v_result;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
    'plan_feature.updated',
    'plan_feature',
    v_result.id::text,
    jsonb_build_object(
      'plan_id',     p_plan_id,
      'feature_id',  p_feature_id,
      'feature_key', v_feature.key,
      'enabled',     p_enabled,
      'value',       p_value
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
-- 8. admin_update_plan_tier
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_plan_tier(
  p_plan_id  UUID,
  p_new_tier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id             UUID;
  v_has_perm             BOOLEAN;
  v_plan                 RECORD;
  v_conflicting_features TEXT[];
  v_old_tier             TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT public.has_permission(v_admin_id, 'plans.manage') INTO v_has_perm;
  IF NOT v_has_perm THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_permissions');
  END IF;

  IF p_new_tier NOT IN ('individual', 'team', 'enterprise', 'custom') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  v_old_tier := v_plan.tier;

  IF p_new_tier != 'custom' AND public.tier_rank(p_new_tier) < public.tier_rank(v_old_tier) THEN
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

  UPDATE public.plans SET tier = p_new_tier, updated_at = now() WHERE id = p_plan_id;

  -- Audit log (TASK-2190: migrated from direct INSERT to log_admin_action)
  PERFORM public.log_admin_action(
    'plan.tier_changed',
    'plan',
    p_plan_id::text,
    jsonb_build_object(
      'plan_name', v_plan.name,
      'old_tier',  v_old_tier,
      'new_tier',  p_new_tier
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


-- ============================================================================
-- 9. admin_validate_impersonation_token (NEW audit logging)
--    Previously had NO audit logging. Token validation is a security event
--    that should be tracked for SOC 2 compliance.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_validate_impersonation_token(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.*,
         u.email as target_email,
         COALESCE(
           u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'name',
           u.email
         ) as target_name
  INTO v_session
  FROM public.impersonation_sessions s
  JOIN auth.users u ON u.id = s.target_user_id
  WHERE s.token = p_token
    AND s.status = 'active'
    AND s.expires_at > now();

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.impersonation_sessions
      WHERE token = p_token AND status = 'active' AND expires_at <= now()
    ) THEN
      UPDATE public.impersonation_sessions
      SET status = 'expired'
      WHERE token = p_token AND status = 'active';
      RETURN jsonb_build_object('valid', false, 'error', 'session_expired');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.impersonation_sessions
      WHERE token = p_token AND status = 'validated'
    ) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'token_already_used');
    END IF;

    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  -- Consume the token: transition status from 'active' to 'validated'
  UPDATE public.impersonation_sessions
  SET status = 'validated'
  WHERE id = v_session.id
    AND status = 'active';

  -- Audit log (TASK-2190: NEW - token validation was previously untracked)
  PERFORM public.log_admin_action(
    'user.impersonate.validate',
    'impersonation_session',
    v_session.id::text,
    jsonb_build_object(
      'admin_user_id', v_session.admin_user_id,
      'target_user_id', v_session.target_user_id,
      'session_id', v_session.id
    )
  );

  RETURN jsonb_build_object(
    'valid', true,
    'session_id', v_session.id,
    'admin_user_id', v_session.admin_user_id,
    'target_user_id', v_session.target_user_id,
    'target_email', v_session.target_email,
    'target_name', v_session.target_name,
    'expires_at', v_session.expires_at,
    'session_expires_at', v_session.session_expires_at,
    'started_at', v_session.started_at
  );
END;
$$;
