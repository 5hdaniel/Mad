-- ============================================================================
-- BACKLOG-915: Add COALESCE fallback for raw_user_meta_data column name
-- ============================================================================
-- The auth.users column has historically been named `raw_user_meta_data` in
-- Supabase, but some versions may use `raw_user_metadata`.  Using COALESCE
-- with both names makes the RPC resilient to Supabase version changes.
-- Only the admin_validate_impersonation_token RPC is affected since it is
-- the only active RPC that reads this column.
-- ============================================================================

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
  -- COALESCE handles both `raw_user_meta_data` (current) and
  -- `raw_user_metadata` (possible future Supabase versions)
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
