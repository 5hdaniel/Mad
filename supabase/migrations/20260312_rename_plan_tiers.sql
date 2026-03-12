-- Rename plan tiers: trial → individual, pro → team
-- Aligns with industry-standard licensing model: individual, team, enterprise, custom

-- 1. Drop old constraint
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_tier_check;

-- 2. Update existing data
UPDATE plans SET tier = 'individual' WHERE tier = 'trial';
UPDATE plans SET tier = 'team' WHERE tier = 'pro';

-- 3. Add new constraint
ALTER TABLE plans ADD CONSTRAINT plans_tier_check
  CHECK (tier = ANY (ARRAY['individual', 'team', 'enterprise', 'custom']));

-- 4. Update admin_create_plan RPC tier validation
CREATE OR REPLACE FUNCTION public.admin_create_plan(
  p_name TEXT,
  p_slug TEXT,
  p_tier TEXT,
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

-- 5. Add admin_delete_plan RPC with org-count protection
CREATE OR REPLACE FUNCTION public.admin_delete_plan(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
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

  SELECT name INTO v_plan_name FROM public.plans WHERE id = p_plan_id;
  IF v_plan_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

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

  DELETE FROM public.plan_features WHERE plan_id = p_plan_id;
  DELETE FROM public.plans WHERE id = p_plan_id;

  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
    'plan.deleted',
    'plan',
    p_plan_id::text,
    jsonb_build_object('name', v_plan_name)
  );

  RETURN jsonb_build_object('success', true, 'name', v_plan_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_plan(UUID) TO authenticated;
