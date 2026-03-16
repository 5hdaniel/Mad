-- ============================================
-- Migration: Standardize Audit Log Before/After Payloads
-- Task: TASK-2189 / BACKLOG-862
-- Sprint: SPRINT-134
--
-- Purpose: Standardize all existing audit log entries in admin RPCs
-- to include structured 'before' and 'after' payloads for complete
-- change tracking. Follows the admin_update_license gold standard.
--
-- This migration uses CREATE OR REPLACE FUNCTION to update RPCs in
-- place. It does NOT modify the log_admin_action function itself or
-- the admin_audit_logs table schema.
-- ============================================

-- ============================================
-- 1. admin_update_role
--    Before: {name: new_name}
--    After:  {before: {name, description}, after: {name, description}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_update_role(
  p_role_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role RECORD;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'roles.manage') THEN
    RAISE EXCEPTION 'Unauthorized: requires roles.manage permission';
  END IF;

  SELECT * INTO v_role FROM public.admin_roles WHERE id = p_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'Cannot modify system role'; END IF;

  UPDATE public.admin_roles
  SET name = COALESCE(p_name, name),
      description = COALESCE(p_description, description),
      updated_at = NOW()
  WHERE id = p_role_id;

  PERFORM public.log_admin_action(
    'role.update',
    'admin_role',
    p_role_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', v_role.name,
        'description', v_role.description
      ),
      'after', jsonb_build_object(
        'name', COALESCE(p_name, v_role.name),
        'description', COALESCE(p_description, v_role.description)
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'role_id', p_role_id);
END;
$$;

-- ============================================
-- 2. admin_update_role_permissions
--    Before: {name, permissions: new_perms}
--    After:  {before: {name, permissions}, after: {name, permissions}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_update_role_permissions(
  p_role_id UUID,
  p_permission_keys TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role RECORD;
  v_old_permissions TEXT[];
BEGIN
  IF NOT public.has_permission(auth.uid(), 'roles.manage') THEN
    RAISE EXCEPTION 'Unauthorized: requires roles.manage permission';
  END IF;

  SELECT * INTO v_role FROM public.admin_roles WHERE id = p_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'Cannot modify permissions for system role'; END IF;

  -- Capture old permissions BEFORE the delete
  SELECT array_agg(ap.key ORDER BY ap.key) INTO v_old_permissions
  FROM public.admin_role_permissions arp
  JOIN public.admin_permissions ap ON ap.id = arp.permission_id
  WHERE arp.role_id = p_role_id;

  DELETE FROM public.admin_role_permissions WHERE role_id = p_role_id;

  INSERT INTO public.admin_role_permissions (role_id, permission_id)
  SELECT p_role_id, ap.id
  FROM public.admin_permissions ap
  WHERE ap.key = ANY(p_permission_keys);

  UPDATE public.admin_roles SET updated_at = NOW() WHERE id = p_role_id;

  PERFORM public.log_admin_action(
    'role.update_permissions',
    'admin_role',
    p_role_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', v_role.name,
        'permissions', COALESCE(to_jsonb(v_old_permissions), '[]'::jsonb)
      ),
      'after', jsonb_build_object(
        'name', v_role.name,
        'permissions', to_jsonb(p_permission_keys)
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'role_id', p_role_id);
END;
$$;

-- ============================================
-- 3. admin_delete_role
--    Before: {name}
--    After:  {before: {name, slug, description, is_system}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_delete_role(p_role_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role RECORD;
  v_assigned_users INT;
  v_permissions TEXT[];
BEGIN
  IF NOT public.has_permission(auth.uid(), 'roles.manage') THEN
    RAISE EXCEPTION 'Unauthorized: requires roles.manage permission';
  END IF;

  SELECT * INTO v_role FROM public.admin_roles WHERE id = p_role_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'Cannot delete system role'; END IF;

  SELECT COUNT(*) INTO v_assigned_users FROM public.internal_roles WHERE role_id = p_role_id;
  IF v_assigned_users > 0 THEN
    RAISE EXCEPTION 'Cannot delete role: % user(s) are still assigned to it. Reassign them first.', v_assigned_users;
  END IF;

  -- Capture permissions before deletion
  SELECT array_agg(ap.key ORDER BY ap.key) INTO v_permissions
  FROM public.admin_role_permissions arp
  JOIN public.admin_permissions ap ON ap.id = arp.permission_id
  WHERE arp.role_id = p_role_id;

  DELETE FROM public.admin_roles WHERE id = p_role_id;

  PERFORM public.log_admin_action(
    'role.delete',
    'admin_role',
    p_role_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', v_role.name,
        'slug', v_role.slug,
        'description', v_role.description,
        'permissions', COALESCE(to_jsonb(v_permissions), '[]'::jsonb)
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'role_id', p_role_id);
END;
$$;

-- ============================================
-- 4. admin_add_internal_user
--    Before: {email, role}
--    After:  {after: {email, role, user_id}} (create action, no before)
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_add_internal_user(p_email TEXT, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_user_id UUID;
  v_role_id UUID;
  v_existing RECORD;
BEGIN
  IF NOT public.has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_role_id FROM public.admin_roles WHERE slug = REPLACE(p_role, '_', '-');
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  SELECT id INTO v_target_user_id FROM public.users WHERE email = p_email;
  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email: %', p_email;
  END IF;

  SELECT * INTO v_existing FROM public.internal_roles WHERE user_id = v_target_user_id;
  IF FOUND THEN
    RAISE EXCEPTION 'User already has an internal role';
  END IF;

  INSERT INTO public.internal_roles (user_id, role_id, created_by)
  VALUES (v_target_user_id, v_role_id, auth.uid());

  PERFORM public.log_admin_action(
    'internal_user.add',
    'internal_role',
    v_target_user_id::TEXT,
    jsonb_build_object(
      'after', jsonb_build_object(
        'email', p_email,
        'role', p_role,
        'user_id', v_target_user_id
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id, 'role', p_role);
END;
$$;

-- ============================================
-- 5. admin_remove_internal_user
--    Before: {email, role}
--    After:  {before: {email, role, user_id}} (delete action, no after)
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_remove_internal_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_name TEXT;
  v_email TEXT;
BEGIN
  IF NOT public.has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove your own admin access';
  END IF;

  SELECT ar.name, u.email INTO v_role_name, v_email
  FROM public.internal_roles ir
  JOIN public.admin_roles ar ON ar.id = ir.role_id
  JOIN public.users u ON u.id = ir.user_id
  WHERE ir.user_id = p_user_id;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'User does not have an internal role';
  END IF;

  DELETE FROM public.internal_roles WHERE user_id = p_user_id;

  PERFORM public.log_admin_action(
    'internal_user.remove',
    'internal_role',
    p_user_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'email', COALESCE(v_email, ''),
        'role', v_role_name,
        'user_id', p_user_id
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- ============================================
-- 6. admin_update_internal_user_role
--    Before: {email, old_role, new_role}
--    After:  {before: {email, role}, after: {email, role}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_update_internal_user_role(p_user_id UUID, p_role_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_id UUID;
  v_old_role TEXT;
  v_email TEXT;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'internal_users.manage') THEN
    RAISE EXCEPTION 'Unauthorized: requires internal_users.manage permission';
  END IF;

  SELECT id INTO v_role_id FROM public.admin_roles WHERE slug = p_role_slug;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'Invalid role: %', p_role_slug; END IF;

  SELECT ar.name, u.email INTO v_old_role, v_email
  FROM public.internal_roles ir
  JOIN public.admin_roles ar ON ar.id = ir.role_id
  JOIN public.users u ON u.id = ir.user_id
  WHERE ir.user_id = p_user_id;

  IF v_old_role IS NULL THEN RAISE EXCEPTION 'User does not have an internal role'; END IF;

  UPDATE public.internal_roles SET role_id = v_role_id, updated_at = NOW()
  WHERE user_id = p_user_id;

  PERFORM public.log_admin_action(
    'internal_user.role_change',
    'internal_role',
    p_user_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'email', COALESCE(v_email, ''),
        'role', v_old_role
      ),
      'after', jsonb_build_object(
        'email', COALESCE(v_email, ''),
        'role', p_role_slug
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_role', p_role_slug);
END;
$$;

-- ============================================
-- 7. admin_suspend_user
--    Before: {previous_status, reason, licenses_suspended}
--    After:  {before: {status, email}, after: {status, reason, licenses_suspended}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status TEXT;
  v_email TEXT;
  v_licenses_suspended INT;
BEGIN
  IF NOT public.has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.internal_roles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot suspend an internal user. Remove their internal role first.';
  END IF;

  SELECT status, email INTO v_current_status, v_email
  FROM public.users WHERE id = p_user_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF v_current_status = 'suspended' THEN
    RAISE EXCEPTION 'User is already suspended';
  END IF;

  -- Suspend the user
  UPDATE public.users
  SET status = 'suspended',
      suspended_at = NOW(),
      suspension_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Also suspend all active licenses so broker app blocks access
  UPDATE public.licenses
  SET status = 'suspended',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND status = 'active';
  GET DIAGNOSTICS v_licenses_suspended = ROW_COUNT;

  PERFORM public.log_admin_action(
    'user.suspend',
    'user',
    p_user_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'status', v_current_status,
        'email', COALESCE(v_email, '')
      ),
      'after', jsonb_build_object(
        'status', 'suspended',
        'reason', COALESCE(p_reason, ''),
        'licenses_suspended', v_licenses_suspended
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'previous_status', v_current_status, 'licenses_suspended', v_licenses_suspended);
END;
$$;

-- ============================================
-- 8. admin_unsuspend_user
--    Before: {previous_status, licenses_restored}
--    After:  {before: {status, email}, after: {status, licenses_restored}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status TEXT;
  v_email TEXT;
  v_licenses_restored INT;
BEGIN
  IF NOT public.has_internal_role(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT status, email INTO v_current_status, v_email
  FROM public.users WHERE id = p_user_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF v_current_status != 'suspended' THEN
    RAISE EXCEPTION 'User is not suspended (current status: %)', v_current_status;
  END IF;

  -- Unsuspend the user
  UPDATE public.users
  SET status = 'active',
      suspended_at = NULL,
      suspension_reason = NULL,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Restore suspended licenses back to active
  UPDATE public.licenses
  SET status = 'active',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND status = 'suspended';
  GET DIAGNOSTICS v_licenses_restored = ROW_COUNT;

  PERFORM public.log_admin_action(
    'user.unsuspend',
    'user',
    p_user_id::TEXT,
    jsonb_build_object(
      'before', jsonb_build_object(
        'status', v_current_status,
        'email', COALESCE(v_email, '')
      ),
      'after', jsonb_build_object(
        'status', 'active',
        'licenses_restored', v_licenses_restored
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'previous_status', v_current_status, 'licenses_restored', v_licenses_restored);
END;
$$;

-- ============================================
-- 9. admin_toggle_plan_active
--    Before: {name, is_active}
--    After:  {before: {name, is_active}, after: {name, is_active}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_toggle_plan_active(
  p_plan_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_plan_name TEXT;
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

  SELECT name, is_active INTO v_plan_name, v_previous_is_active
  FROM public.plans WHERE id = p_plan_id;

  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  UPDATE public.plans SET is_active = p_is_active, updated_at = now()
  WHERE id = p_plan_id;

  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'plan.toggled',
    'plan',
    p_plan_id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', v_plan_name,
        'is_active', v_previous_is_active
      ),
      'after', jsonb_build_object(
        'name', v_plan_name,
        'is_active', p_is_active
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'previous_is_active', v_previous_is_active);
END;
$$;

-- ============================================
-- 10. admin_delete_plan
--     Before: {name}
--     After:  {before: {name, slug, tier, description, is_active}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_delete_plan(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_plan RECORD;
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

  -- Get full plan details for audit snapshot
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
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
      'message', format('Cannot delete plan "%s": %s organization(s) are assigned to it. Reassign them first.', v_plan.name, v_org_count)
    );
  END IF;

  -- Delete plan features first (FK constraint)
  DELETE FROM public.plan_features WHERE plan_id = p_plan_id;

  -- Delete the plan
  DELETE FROM public.plans WHERE id = p_plan_id;

  -- Audit log with full before snapshot
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'plan.deleted',
    'plan',
    p_plan_id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', v_plan.name,
        'slug', v_plan.slug,
        'tier', v_plan.tier,
        'description', v_plan.description,
        'is_active', v_plan.is_active
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'name', v_plan.name);
END;
$$;

-- ============================================
-- 11. admin_assign_org_plan
--     Before: {organization_id, plan_id, record_id}
--     After:  {before: {plan_id, plan_name} | null, after: {plan_id, plan_name, organization_id}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_assign_org_plan(p_org_id UUID, p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id  UUID;
  v_has_perm  BOOLEAN;
  v_plan_tier TEXT;
  v_new_plan_name TEXT;
  v_old_plan_id UUID;
  v_old_plan_name TEXT;
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
  SELECT tier, name INTO v_plan_tier, v_new_plan_name
  FROM public.plans WHERE id = p_plan_id AND is_active = true;
  IF v_plan_tier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Block Individual-tier plans from org assignment (BACKLOG-936)
  IF v_plan_tier = 'individual' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'individual_plan_cannot_be_assigned_to_org',
      'message', 'Individual plans cannot be assigned to organizations. Use Team, Enterprise, or Custom plans.'
    );
  END IF;

  -- Capture old plan assignment BEFORE the upsert
  SELECT op.plan_id, p.name INTO v_old_plan_id, v_old_plan_name
  FROM public.organization_plans op
  JOIN public.plans p ON p.id = op.plan_id
  WHERE op.organization_id = p_org_id;

  INSERT INTO public.organization_plans (organization_id, plan_id, assigned_by, assigned_at)
  VALUES (p_org_id, p_plan_id, v_admin_id, now())
  ON CONFLICT (organization_id)
  DO UPDATE SET
    plan_id     = EXCLUDED.plan_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at,
    updated_at  = now()
  RETURNING id, organization_id, plan_id, assigned_by, assigned_at INTO v_result;

  -- Audit log with before/after
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'org_plan.assigned',
    'organization',
    p_org_id::text,
    jsonb_build_object(
      'before', CASE
        WHEN v_old_plan_id IS NOT NULL THEN jsonb_build_object(
          'plan_id', v_old_plan_id,
          'plan_name', v_old_plan_name
        )
        ELSE NULL
      END,
      'after', jsonb_build_object(
        'plan_id', p_plan_id,
        'plan_name', v_new_plan_name,
        'organization_id', p_org_id
      )
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

-- ============================================
-- 12. admin_update_plan_feature
--     Before: {plan_id, feature_id, feature_key, enabled, value}
--     After:  {before: {enabled, value, feature_key}, after: {enabled, value, feature_key}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_update_plan_feature(
  p_plan_id UUID,
  p_feature_id UUID,
  p_enabled BOOLEAN,
  p_value TEXT DEFAULT NULL
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
  v_old_enabled BOOLEAN;
  v_old_value TEXT;
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

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  SELECT * INTO v_feature FROM public.feature_definitions WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'feature_not_found');
  END IF;

  -- Capture old values BEFORE the upsert
  SELECT pf.enabled, pf.value INTO v_old_enabled, v_old_value
  FROM public.plan_features pf
  WHERE pf.plan_id = p_plan_id AND pf.feature_id = p_feature_id;

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

  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id, 'plan_feature.updated', 'plan_feature', v_result.id::text,
    jsonb_build_object(
      'plan_id', p_plan_id,
      'feature_id', p_feature_id,
      'before', jsonb_build_object(
        'feature_key', v_feature.key,
        'enabled', v_old_enabled,
        'value', v_old_value
      ),
      'after', jsonb_build_object(
        'feature_key', v_feature.key,
        'enabled', p_enabled,
        'value', p_value
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'id', v_result.id, 'plan_id', v_result.plan_id,
    'feature_id', v_result.feature_id, 'enabled', v_result.enabled, 'value', v_result.value);
END;
$$;

-- ============================================
-- 13. admin_update_plan_tier
--     Before: {plan_name, old_tier, new_tier}
--     After:  {before: {plan_name, tier}, after: {plan_name, tier}}
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_update_plan_tier(p_plan_id UUID, p_new_tier TEXT)
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
        'success', false, 'error', 'tier_downgrade_constraint_violation',
        'message', format('Cannot downgrade plan "%s" from %s to %s. The following enabled features require a higher tier: %s. Disable them first.',
          v_plan.name, v_old_tier, p_new_tier, array_to_string(v_conflicting_features, ', ')),
        'conflicting_features', to_jsonb(v_conflicting_features),
        'current_tier', v_old_tier, 'requested_tier', p_new_tier
      );
    END IF;
  END IF;

  UPDATE public.plans SET tier = p_new_tier, updated_at = now() WHERE id = p_plan_id;

  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id, 'plan.tier_changed', 'plan', p_plan_id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'plan_name', v_plan.name,
        'tier', v_old_tier
      ),
      'after', jsonb_build_object(
        'plan_name', v_plan.name,
        'tier', p_new_tier
      )
    )
  );

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id, 'old_tier', v_old_tier, 'new_tier', p_new_tier);
END;
$$;
