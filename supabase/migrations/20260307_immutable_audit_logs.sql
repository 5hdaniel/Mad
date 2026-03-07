-- ============================================
-- IMMUTABLE AUDIT LOGS
-- Migration: 20260307_immutable_audit_logs
-- Task: TASK-2139 / BACKLOG-857
-- SOC 2 Control: A1.2 - Log integrity / tamper protection
-- Purpose: Prevent DELETE and UPDATE on admin_audit_logs
-- Exception: postgres role allowed for schema migrations and emergency maintenance
-- ============================================

-- Create trigger function that blocks modifications
-- Uses CREATE OR REPLACE for idempotency
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow postgres role for schema migrations and emergency maintenance
  IF current_user = 'postgres' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'Audit logs are immutable. % operations are not permitted on admin_audit_logs.',
    TG_OP
    USING HINT = 'SOC 2 Control A1.2 requires log integrity. Contact a database administrator if you need to perform maintenance.';
END;
$$;

-- Drop existing triggers if any (idempotent)
DROP TRIGGER IF EXISTS prevent_audit_log_update ON public.admin_audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_log_delete ON public.admin_audit_logs;

-- Block UPDATE operations
CREATE TRIGGER prevent_audit_log_update
  BEFORE UPDATE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Block DELETE operations
CREATE TRIGGER prevent_audit_log_delete
  BEFORE DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();
