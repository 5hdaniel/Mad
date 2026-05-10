-- Migration: Fix RLS policies (BACKLOG-497 + BACKLOG-410)
--
-- BACKLOG-497: organization_members RLS infinite recursion
--   FINDING: Already mitigated. The helper functions is_org_admin() and
--   get_user_org_ids() are both SECURITY DEFINER, which bypasses RLS when
--   they query organization_members internally. No recursion risk exists.
--   This migration adds explicit comments documenting this design decision.
--
-- BACKLOG-410: Always-true RLS policies on audit_logs, error_logs, email_delivery_log
--   Five policies flagged by Supabase security advisor. Analysis and fixes below.
--

-- ============================================================================
-- BACKLOG-497: Document recursion-safe design on organization_members helpers
-- ============================================================================

-- is_org_admin: SECURITY DEFINER bypasses RLS on organization_members
-- Used by: admins_can_manage_members policy on organization_members
COMMENT ON FUNCTION public.is_org_admin(uuid, uuid) IS
  'SECURITY DEFINER: Checks if user has admin/it_admin role in organization. '
  'Bypasses RLS on organization_members to prevent infinite recursion. '
  'Referenced by organization_members RLS policy admins_can_manage_members. '
  'See BACKLOG-497.';

-- get_user_org_ids: SECURITY DEFINER bypasses RLS on organization_members
-- Used by: members_can_read_org_members policy on organization_members
COMMENT ON FUNCTION public.get_user_org_ids(uuid) IS
  'SECURITY DEFINER: Returns organization IDs for a given user. '
  'Bypasses RLS on organization_members to prevent infinite recursion. '
  'Referenced by organization_members RLS policy members_can_read_org_members. '
  'See BACKLOG-497.';


-- ============================================================================
-- BACKLOG-410: Fix always-true RLS policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. audit_logs: anon INSERT — KEEP (intentionally permissive)
--
-- JUSTIFICATION: Anonymous audit logging is required for pre-authentication
-- events: failed login attempts, signup flows, password reset requests.
-- The anon role has no auth.uid() to constrain against. Tightening this
-- would break security audit trail for unauthenticated actions.
-- ---------------------------------------------------------------------------
COMMENT ON POLICY anon_can_insert_audit_logs ON public.audit_logs IS
  'Intentionally permissive: allows anonymous audit logging for pre-auth events '
  '(failed logins, signup attempts, password resets). No user_id constraint '
  'possible for anon role. Reviewed BACKLOG-410.';


-- ---------------------------------------------------------------------------
-- 2. audit_logs: authenticated INSERT — TIGHTEN
--
-- Authenticated users should only insert audit logs for their own user_id.
-- This prevents one user from creating fake audit entries for another user.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_can_insert_audit_logs ON public.audit_logs;

CREATE POLICY users_can_insert_audit_logs ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY users_can_insert_audit_logs ON public.audit_logs IS
  'Tightened: authenticated users can only insert audit logs for their own '
  'user_id. Prevents spoofing audit entries for other users. See BACKLOG-410.';


-- ---------------------------------------------------------------------------
-- 3. email_delivery_log: "Service role can insert logs" — REPLACE
--
-- The original policy targets {public} (all roles) with WITH CHECK (true).
-- Email delivery logs should ONLY be inserted by service_role (edge functions
-- that send emails). No end-user (anon or authenticated) should be able to
-- insert delivery log entries directly.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can insert logs" ON public.email_delivery_log;

CREATE POLICY "Service role can insert logs" ON public.email_delivery_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON POLICY "Service role can insert logs" ON public.email_delivery_log IS
  'Restricted to service_role only (was previously open to all roles). '
  'Email delivery logs are inserted by edge functions using service_role key. '
  'End users must not insert delivery log entries directly. See BACKLOG-410.';


-- ---------------------------------------------------------------------------
-- 4. error_logs: anon INSERT — KEEP (intentionally permissive)
--
-- JUSTIFICATION: Error reporting must work before authentication completes.
-- Desktop app error reporting can fire before a user is authenticated (e.g.,
-- database initialization failures, network errors during login). The anon
-- role has no reliable auth.uid() to constrain against.
-- ---------------------------------------------------------------------------
COMMENT ON POLICY anon_can_insert_error_logs ON public.error_logs IS
  'Intentionally permissive: allows anonymous error reporting for pre-auth '
  'errors (DB init failures, network errors during login). No user_id '
  'constraint possible for anon role. Reviewed BACKLOG-410.';


-- ---------------------------------------------------------------------------
-- 5. error_logs: authenticated INSERT — TIGHTEN
--
-- Authenticated users should only insert error logs where user_id matches
-- their own auth.uid(), OR where user_id is NULL (for errors where user
-- context is unavailable even though the session is authenticated).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS authenticated_can_insert_error_logs ON public.error_logs;

CREATE POLICY authenticated_can_insert_error_logs ON public.error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

COMMENT ON POLICY authenticated_can_insert_error_logs ON public.error_logs IS
  'Tightened: authenticated users can only insert error logs for their own '
  'user_id or with NULL user_id (for errors where user context is unavailable). '
  'Prevents spoofing error reports for other users. See BACKLOG-410.';
