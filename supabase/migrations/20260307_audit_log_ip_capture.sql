-- ============================================
-- AUDIT LOG IP CAPTURE
-- Migration: 20260307_audit_log_ip_capture
-- Task: TASK-2137 / BACKLOG-855
-- SOC 2 Control: CC6.1 - Security event logging with source identification
--
-- Purpose: Create log_admin_action RPC that accepts p_ip_address parameter
-- so the admin portal API route can pass the client IP when logging actions.
--
-- The ip_address column already exists in admin_audit_logs (INET type).
-- This RPC provides a clean interface for inserting audit log entries
-- with IP address capture.
-- ============================================

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata,
    ip_address
  )
  VALUES (
    auth.uid(),
    p_action,
    p_target_type,
    p_target_id,
    p_metadata,
    p_ip_address
  );
END;
$$;

-- Grant execute to authenticated users (admin portal users are authenticated)
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB, INET) TO authenticated;
