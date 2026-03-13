-- Prevent Individual-tier plans from being assigned to organizations.
-- BACKLOG-936: Individual plans are for solo users, not organizations.
--
-- Uses CREATE OR REPLACE to add a tier check to admin_assign_org_plan.
-- The full function body is required (PostgreSQL cannot partially alter functions).

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
