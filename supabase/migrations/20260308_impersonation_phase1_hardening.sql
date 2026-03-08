-- Migration: Impersonation Phase 1 Security Hardening
-- Sprint 118 - Phase 1 Batch
-- Purpose: Four security fixes from SR code review
--   BACKLOG-901: Block impersonation of suspended users
--   BACKLOG-902: Prevent concurrent impersonation of same target user
--   BACKLOG-910: Revoke validate_token RPC from authenticated role (service_role only)
-- Dependencies: 20260307_single_use_impersonation_token.sql (TASK-2132)

-- ============================================================================
-- 1. BACKLOG-901 + BACKLOG-902: Update admin_start_impersonation
--    - Add suspended-user check (raw_app_meta_data->>'status')
--    - End existing active/validated sessions for target user (not just admin)
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
-- 2. BACKLOG-910: Revoke validate_token RPC from authenticated role
--    The function is called server-side via service_role only (from route.ts).
--    Revoking authenticated prevents any logged-in user from calling it directly.
-- ============================================================================

-- Revoke for both the old UUID signature and the current TEXT signature
REVOKE EXECUTE ON FUNCTION public.admin_validate_impersonation_token(TEXT) FROM authenticated;
-- The UUID signature may not exist after the migration that changed it to TEXT,
-- but we use IF EXISTS pattern via DO block to be safe
DO $$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admin_validate_impersonation_token(UUID) FROM authenticated';
EXCEPTION
  WHEN undefined_function THEN
    -- UUID signature no longer exists after column type migration, safe to ignore
    NULL;
END;
$$;

-- ============================================================================
-- 3. Re-grant other RPCs (no change, just explicit for completeness)
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.admin_start_impersonation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_end_impersonation(UUID) TO authenticated;
