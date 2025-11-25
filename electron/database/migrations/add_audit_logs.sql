-- ============================================
-- AUDIT LOGS TABLE - Immutable Security Logging
-- ============================================
-- Purpose: Track all security-relevant user actions with "who, what, when, where" attribution
-- Logs are append-only and cannot be modified or deleted locally

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL,
  session_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT,  -- JSON for additional context
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  synced_at DATETIME,

  -- No foreign keys - audit logs are independent
  -- This allows logs to persist even if user/session is deleted

  CHECK (action IN (
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'DATA_ACCESS', 'DATA_EXPORT', 'DATA_DELETE',
    'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'TRANSACTION_DELETE',
    'CONTACT_CREATE', 'CONTACT_UPDATE', 'CONTACT_DELETE',
    'SETTINGS_CHANGE', 'MAILBOX_CONNECT', 'MAILBOX_DISCONNECT'
  )),

  CHECK (resource_type IN (
    'USER', 'SESSION', 'TRANSACTION', 'CONTACT',
    'COMMUNICATION', 'EXPORT', 'MAILBOX', 'SETTINGS'
  ))
);

-- Create indexes for querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_synced ON audit_logs(synced_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);

-- CRITICAL: Create trigger to prevent modifications
-- Audit logs must be immutable for security compliance
CREATE TRIGGER IF NOT EXISTS prevent_audit_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'Audit logs cannot be modified');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'Audit logs cannot be deleted');
END;
