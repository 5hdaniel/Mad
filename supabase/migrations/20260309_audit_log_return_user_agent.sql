-- ============================================
-- AUDIT LOG: Return user_agent from admin_get_audit_logs
-- Migration: 20260309_audit_log_return_user_agent
-- Backlog: BACKLOG-917
-- SOC 2 Control: CC6.1 - Security event logging with source identification
--
-- Purpose: The user_agent column was added to admin_audit_logs and the
-- log_admin_action RPC captures it (20260307_audit_log_user_agent), but the
-- admin_get_audit_logs RPC omits it from its SELECT clause. This migration
-- redefines the function to include a.user_agent so auditors can see and
-- export the data.
--
-- Also drops the stale 7-param overload (with p_actor_id) that was causing
-- "could not choose the best candidate function" ambiguity errors.
-- ============================================

-- Drop stale overload with p_actor_id parameter (never used by admin portal)
DROP FUNCTION IF EXISTS public.admin_get_audit_logs(integer, integer, text, uuid, text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0,
  p_action text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logs jsonb;
  v_total bigint;
BEGIN
  -- Verify caller has internal role
  IF NOT EXISTS (
    SELECT 1 FROM public.internal_roles WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: internal role required';
  END IF;

  -- Count total matching rows
  SELECT count(*) INTO v_total
  FROM public.admin_audit_logs a
  WHERE (p_action IS NULL OR a.action = p_action)
    AND (p_target_id IS NULL OR a.target_id ILIKE '%' || p_target_id || '%')
    AND (p_date_from IS NULL OR a.created_at >= p_date_from)
    AND (p_date_to IS NULL OR a.created_at <= p_date_to);

  -- Get paginated logs with actor info
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_logs
  FROM (
    SELECT
      a.id,
      a.action,
      a.target_type,
      a.target_id,
      a.metadata,
      a.ip_address::text,
      a.user_agent,
      a.created_at,
      a.actor_id,
      u.email as actor_email,
      u.raw_user_meta_data->>'full_name' as actor_name
    FROM public.admin_audit_logs a
    LEFT JOIN auth.users u ON u.id = a.actor_id
    WHERE (p_action IS NULL OR a.action = p_action)
      AND (p_target_id IS NULL OR a.target_id ILIKE '%' || p_target_id || '%')
      AND (p_date_from IS NULL OR a.created_at >= p_date_from)
      AND (p_date_to IS NULL OR a.created_at <= p_date_to)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('logs', v_logs, 'total', v_total);
END;
$$;

-- Re-grant execute (same signature, just ensuring grant is in place)
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(int, int, text, text, timestamptz, timestamptz) TO authenticated;
