-- ============================================
-- AUDIT LOG USER AGENT CAPTURE
-- Migration: 20260307_audit_log_user_agent
-- Task: TASK-2142 / BACKLOG-860
-- SOC 2 Control: CC6.1 - Security event logging with source identification
--
-- Purpose: Add user_agent column to admin_audit_logs and update the
-- log_admin_action RPC to accept a p_user_agent parameter.
-- Builds on top of 20260307_audit_log_ip_capture which created the RPC.
-- ============================================

-- 1. Add user_agent column (idempotent)
ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 2. Update log_admin_action RPC to accept user_agent parameter
-- Must DROP the old function signature first since we're adding a parameter
DROP FUNCTION IF EXISTS public.log_admin_action(TEXT, TEXT, TEXT, JSONB, INET);

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
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
    ip_address,
    user_agent
  )
  VALUES (
    auth.uid(),
    p_action,
    p_target_type,
    p_target_id,
    p_metadata,
    p_ip_address,
    p_user_agent
  );
END;
$$;

-- 3. Grant execute on the new signature
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB, INET, TEXT) TO authenticated;
