-- Migration: Single-Use Impersonation Token
-- Task: TASK-2132 (Sprint 118 - Phase 1)
-- Purpose: Make impersonation tokens single-use by transitioning status from
--          'active' to 'validated' on first use. Also fixes token column type
--          (UUID -> TEXT) and adds session_expires_at column to separate token
--          expiry from session expiry.
-- Dependencies: 20260307_impersonation_sessions.sql (TASK-2122)

-- ============================================================================
-- 1. Fix token column type: UUID -> TEXT with 32-byte hex default
-- ============================================================================
-- The route handler validates 64-char hex tokens, and the RPC generates hex
-- tokens via encode(gen_random_bytes(32), 'hex'). The column type must match.

ALTER TABLE public.impersonation_sessions
  ALTER COLUMN token TYPE text USING token::text;

ALTER TABLE public.impersonation_sessions
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex')::text;

-- ============================================================================
-- 2. Add session_expires_at column (separate from token expires_at)
-- ============================================================================
-- expires_at = token expiry (TASK-2135 will shorten to 60s)
-- session_expires_at = session expiry (always 30 minutes)

ALTER TABLE public.impersonation_sessions
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

-- Backfill existing rows: set session_expires_at = expires_at for any existing sessions
UPDATE public.impersonation_sessions
  SET session_expires_at = expires_at
  WHERE session_expires_at IS NULL;

-- Make session_expires_at NOT NULL going forward
ALTER TABLE public.impersonation_sessions
  ALTER COLUMN session_expires_at SET NOT NULL;

-- ============================================================================
-- 3. Add 'validated' to status CHECK constraint
-- ============================================================================

ALTER TABLE public.impersonation_sessions
  DROP CONSTRAINT IF EXISTS impersonation_sessions_status_check;

ALTER TABLE public.impersonation_sessions
  ADD CONSTRAINT impersonation_sessions_status_check
  CHECK (status IN ('active', 'validated', 'ended', 'expired'));

-- ============================================================================
-- 4. Update admin_start_impersonation to set session_expires_at
-- ============================================================================
-- Preserves existing function signature (p_target_user_id only).
-- Admin identity comes from auth.uid() (SECURITY DEFINER).

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

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- End any existing active or validated sessions for this admin
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE admin_user_id = v_admin_id AND status IN ('active', 'validated');

  -- Create new session
  -- expires_at = token expiry (30 min now, TASK-2135 will shorten to 60s)
  -- session_expires_at = session expiry (always 30 minutes)
  v_expires_at := now() + interval '30 minutes';
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

-- ============================================================================
-- 5. Update admin_validate_impersonation_token to consume token (single-use)
-- ============================================================================
-- Changes:
-- a) Parameter type from UUID to TEXT (matches new column type)
-- b) After successful SELECT, UPDATE status to 'validated' (single-use)
-- c) Returns session_expires_at in response
-- d) Second call with same token fails because status is no longer 'active'

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
  -- Find active (unconsumed), non-expired session by token
  SELECT s.*, u.email as target_email, u.raw_user_meta_data->>'full_name' as target_name
  INTO v_session
  FROM public.impersonation_sessions s
  JOIN auth.users u ON u.id = s.target_user_id
  WHERE s.token = p_token
    AND s.status = 'active'
    AND s.expires_at > now();

  IF NOT FOUND THEN
    -- Check if token exists but is expired
    IF EXISTS (
      SELECT 1 FROM public.impersonation_sessions
      WHERE token = p_token AND status = 'active' AND expires_at <= now()
    ) THEN
      -- Auto-expire it
      UPDATE public.impersonation_sessions
      SET status = 'expired'
      WHERE token = p_token AND status = 'active';
      RETURN jsonb_build_object('valid', false, 'error', 'session_expired');
    END IF;

    -- Check if token was already validated (replay attempt)
    IF EXISTS (
      SELECT 1 FROM public.impersonation_sessions
      WHERE token = p_token AND status = 'validated'
    ) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'token_already_used');
    END IF;

    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  -- Consume the token: transition status from 'active' to 'validated'
  -- This makes the token single-use. Second call will not find status='active'.
  UPDATE public.impersonation_sessions
  SET status = 'validated'
  WHERE id = v_session.id
    AND status = 'active';

  -- Return session data including session_expires_at for cookie creation
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

-- ============================================================================
-- 6. Update admin_end_impersonation to handle 'validated' status
-- ============================================================================
-- After token validation, status transitions from 'active' to 'validated'.
-- admin_end_impersonation must find sessions in either state, otherwise ending
-- a session after validation silently fails (session_not_found).

CREATE OR REPLACE FUNCTION public.admin_end_impersonation(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_session RECORD;
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

  -- Audit log
  INSERT INTO public.admin_audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_admin_id,
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
-- 7. Grants (re-apply for updated function signatures)
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.admin_start_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_end_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_impersonation_token(TEXT) TO authenticated;
