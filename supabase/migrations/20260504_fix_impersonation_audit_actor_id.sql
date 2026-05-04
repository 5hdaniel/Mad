-- Migration: Fix admin_validate_impersonation_token actor_id NOT NULL violation
--
-- Discovered 2026-05-04 while testing the supabase-security-perf RLS migrations.
-- The bug was pre-existing (not caused by RLS changes) but only surfaced because
-- nobody had previously completed a full broker-portal validation flow — past
-- impersonation sessions were always cancelled before validation.
--
-- ROOT CAUSE
--   admin_validate_impersonation_token (SECURITY DEFINER) calls log_admin_action,
--   which does INSERT INTO admin_audit_logs (actor_id, ...) VALUES (auth.uid(), ...).
--   The broker portal calls this RPC via service_role JWT, so auth.uid() returns
--   NULL. admin_audit_logs.actor_id is NOT NULL → INSERT fails → RPC errors →
--   broker redirects to /login?error=impersonation_validation_failed.
--
-- FIX
--   Replace the log_admin_action(...) call with a direct INSERT that uses
--   v_session.admin_user_id (already in scope) as actor_id. The admin who
--   started the impersonation session is the correct actor for the audit row.
--
-- BACKLOG-1686 tracks the broader audit: other RPCs callable from service_role
-- context may have the same bug. This migration fixes the one we hit.
--
-- This migration was applied to the live DB on 2026-05-04 via Supabase MCP
-- (apply_migration name=fix_impersonation_audit_actor_id_2026_05_04). The file
-- below brings the repo back in sync so future devs see the fix in git history
-- and any environment created from migrations applies it.

CREATE OR REPLACE FUNCTION public.admin_validate_impersonation_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  UPDATE public.impersonation_sessions
  SET status = 'validated'
  WHERE id = v_session.id
    AND status = 'active';

  -- Audit the validation. Direct INSERT (not log_admin_action) because this
  -- function runs via service_role from the broker portal, so auth.uid() is
  -- NULL. The admin who started the session is the correct actor.
  INSERT INTO public.admin_audit_logs (
    actor_id, action, target_type, target_id, metadata
  )
  VALUES (
    v_session.admin_user_id,
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
$function$;
