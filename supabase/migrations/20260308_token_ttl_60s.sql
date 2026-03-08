-- Migration: Shorten impersonation token TTL to 60 seconds
-- TASK-2135 / BACKLOG-895
-- Sprint 118 - Phase 3
--
-- The impersonation token only needs to survive the redirect from admin portal
-- to broker portal (~2-3 seconds). Shortening from 30 minutes to 60 seconds
-- drastically reduces the replay attack window.
--
-- NOTE: session_expires_at remains at 30 minutes (unchanged).
--       The session cookie maxAge is also unchanged (30 minutes).
--       Only the token's expires_at is shortened.
-- Dependencies: 20260308_impersonation_phase1_hardening.sql

CREATE OR REPLACE FUNCTION public.admin_start_impersonation(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_has_perm BOOLEAN;
  v_target_status TEXT;
  v_session_id UUID;
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
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

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
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
