-- Migration: Impersonation Sessions Schema & RPCs
-- Task: TASK-2122 (Sprint 116 - Phase 1)
-- Purpose: Create impersonation_sessions table and RPCs for time-limited,
--          permission-gated, audit-logged admin impersonation sessions.
-- Dependencies: has_permission() function, admin_audit_logs table, admin_permissions table

-- ============================================================================
-- 1. Table: impersonation_sessions
-- ============================================================================

CREATE TABLE public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for token lookups (broker portal will look up by token)
CREATE INDEX idx_impersonation_sessions_token ON public.impersonation_sessions(token) WHERE status = 'active';

-- Index for admin user lookups
CREATE INDEX idx_impersonation_sessions_admin ON public.impersonation_sessions(admin_user_id) WHERE status = 'active';

-- ============================================================================
-- 2. RLS Policies
-- ============================================================================

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Admin can read their own sessions
CREATE POLICY impersonation_sessions_admin_read ON public.impersonation_sessions
  FOR SELECT USING (admin_user_id = auth.uid());

-- No direct insert/update/delete -- all through RPCs (SECURITY DEFINER)

-- ============================================================================
-- 3. RPC: admin_start_impersonation
-- ============================================================================

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
  v_token UUID;
  v_expires_at TIMESTAMPTZ;
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

  -- End any existing active sessions for this admin
  UPDATE public.impersonation_sessions
  SET status = 'ended', ended_at = now()
  WHERE admin_user_id = v_admin_id AND status = 'active';

  -- Create new session (30 min TTL)
  v_expires_at := now() + interval '30 minutes';

  INSERT INTO public.impersonation_sessions (admin_user_id, target_user_id, expires_at)
  VALUES (v_admin_id, p_target_user_id, v_expires_at)
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
      'expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'token', v_token,
    'expires_at', v_expires_at,
    'target_user_id', p_target_user_id
  );
END;
$$;

-- ============================================================================
-- 4. RPC: admin_end_impersonation
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
  v_session RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Find the session (must belong to this admin)
  SELECT * INTO v_session
  FROM public.impersonation_sessions
  WHERE id = p_session_id AND admin_user_id = v_admin_id AND status = 'active';

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
-- 5. RPC: admin_validate_impersonation_token
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_validate_impersonation_token(
  p_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find active, non-expired session by token
  SELECT s.*, u.email as target_email, u.raw_user_meta_data->>'full_name' as target_name
  INTO v_session
  FROM public.impersonation_sessions s
  JOIN auth.users u ON u.id = s.target_user_id
  WHERE s.token = p_token
    AND s.status = 'active'
    AND s.expires_at > now();

  IF NOT FOUND THEN
    -- Check if token exists but is expired
    IF EXISTS (SELECT 1 FROM public.impersonation_sessions WHERE token = p_token AND status = 'active' AND expires_at <= now()) THEN
      -- Auto-expire it
      UPDATE public.impersonation_sessions SET status = 'expired' WHERE token = p_token AND status = 'active';
      RETURN jsonb_build_object('valid', false, 'error', 'session_expired');
    END IF;
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'session_id', v_session.id,
    'admin_user_id', v_session.admin_user_id,
    'target_user_id', v_session.target_user_id,
    'target_email', v_session.target_email,
    'target_name', v_session.target_name,
    'expires_at', v_session.expires_at,
    'started_at', v_session.started_at
  );
END;
$$;

-- ============================================================================
-- 6. Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.admin_start_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_end_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_impersonation_token(UUID) TO authenticated;
