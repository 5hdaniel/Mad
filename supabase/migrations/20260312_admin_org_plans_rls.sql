-- Allow admin portal users with plans.view permission to read organization_plans
-- Without this policy, PostgREST nested selects into organization_plans return empty
-- for admin users who are not members of the target organization.
-- Ref: BACKLOG-934 (admin cross-links)

CREATE POLICY org_plans_admin_read ON public.organization_plans
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'plans.view')
  );
