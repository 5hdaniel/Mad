-- ============================================
-- AUDIT LOG RETENTION POLICY METADATA
-- Migration: 20260307_audit_log_retention_policy
-- Task: TASK-2141 / BACKLOG-859
-- SOC 2 Control: CC7.3 - Log retention and availability
-- Purpose: Document retention policy on the admin_audit_logs table
--          and ensure efficient date-range query support
-- ============================================

-- Document retention policy as a table comment
-- This serves as machine-readable and human-readable metadata
-- directly on the table, visible to any DBA or auditor.
COMMENT ON TABLE public.admin_audit_logs IS
  'SOC 2 audit trail. '
  'Retention: 7 years minimum from created_at (per docs/soc2/audit-log-retention-policy.md). '
  'Immutability enforced by triggers (prevent_audit_log_update, prevent_audit_log_delete). '
  'Do NOT delete entries. Archive to cold storage when table exceeds growth threshold. '
  'SOC 2 Controls: CC7.3 (retention), A1.2 (integrity), CC6.1 (access).';

-- Ensure an index exists on created_at for efficient date-range queries.
-- This index supports:
--   1. Admin portal log viewer date filtering
--   2. Log export with date range parameters
--   3. Future archival queries (SELECT ... WHERE created_at < threshold)
--   4. SOC 2 auditor queries for specific time periods
-- Using IF NOT EXISTS for idempotency.
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at);
