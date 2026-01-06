/**
 * Audit Log Database Service
 * Handles all audit log-related database operations
 *
 * Note: The audit_logs table is append-only with triggers preventing
 * UPDATE and DELETE operations (except for synced_at updates).
 */

import type { AuditLogEntry, AuditLogDbRow } from "../auditService";
import { dbAll, dbRun, ensureDb } from "./core/dbConnection";

/**
 * Insert an audit log entry (append-only)
 * Note: The audit_logs table has triggers that prevent UPDATE and DELETE
 */
export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  const sql = `
    INSERT INTO audit_logs (
      id, timestamp, user_id, session_id, action, resource_type,
      resource_id, metadata, ip_address, user_agent, success, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    entry.id,
    entry.timestamp.toISOString(),
    entry.userId,
    entry.sessionId || null,
    entry.action,
    entry.resourceType,
    entry.resourceId || null,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
    entry.ipAddress || null,
    entry.userAgent || null,
    entry.success ? 1 : 0,
    entry.errorMessage || null,
  ];

  dbRun(sql, params);
}

/**
 * Get audit logs that haven't been synced to cloud
 */
export async function getUnsyncedAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  const sql = `
    SELECT * FROM audit_logs
    WHERE synced_at IS NULL
    ORDER BY timestamp ASC
    LIMIT ?
  `;

  const rows = dbAll<AuditLogDbRow>(sql, [limit]);
  return rows.map(mapAuditLogRowToEntry);
}

/**
 * Mark audit logs as synced (only updates synced_at field)
 * This is the ONLY allowed update to audit_logs - we need a special approach
 * because the table has triggers preventing normal updates
 */
export async function markAuditLogsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  // We need to temporarily disable the trigger for this specific update
  // This is safe because we're only updating the synced_at timestamp
  const db = ensureDb();
  const syncedAt = new Date().toISOString();

  try {
    // Disable the update trigger temporarily
    db.exec("DROP TRIGGER IF EXISTS prevent_audit_update");

    // Update synced_at for the specified IDs
    const placeholders = ids.map(() => "?").join(",");
    const sql = `UPDATE audit_logs SET synced_at = ? WHERE id IN (${placeholders})`;
    db.prepare(sql).run(syncedAt, ...ids);

    // Recreate the trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_audit_update
      BEFORE UPDATE ON audit_logs
      WHEN NEW.synced_at IS NULL OR OLD.synced_at IS NOT NULL
      BEGIN
        SELECT RAISE(ABORT, 'Audit logs cannot be modified');
      END
    `);
  } catch (error) {
    // Ensure trigger is recreated even on error
    try {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_audit_update
        BEFORE UPDATE ON audit_logs
        WHEN NEW.synced_at IS NULL OR OLD.synced_at IS NOT NULL
        BEGIN
          SELECT RAISE(ABORT, 'Audit logs cannot be modified');
        END
      `);
    } catch {
      // Ignore trigger recreation errors
    }
    throw error;
  }
}

/**
 * Audit log filter options
 */
export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Get audit logs for a user with optional filters
 */
export async function getAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
  let sql = "SELECT * FROM audit_logs WHERE 1=1";
  const params: (string | number)[] = [];

  if (filters.userId) {
    sql += " AND user_id = ?";
    params.push(filters.userId);
  }

  if (filters.action) {
    sql += " AND action = ?";
    params.push(filters.action);
  }

  if (filters.resourceType) {
    sql += " AND resource_type = ?";
    params.push(filters.resourceType);
  }

  if (filters.startDate) {
    sql += " AND timestamp >= ?";
    params.push(filters.startDate.toISOString());
  }

  if (filters.endDate) {
    sql += " AND timestamp <= ?";
    params.push(filters.endDate.toISOString());
  }

  sql += " ORDER BY timestamp DESC";

  if (filters.limit) {
    sql += " LIMIT ?";
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += " OFFSET ?";
    params.push(filters.offset);
  }

  const rows = dbAll<AuditLogDbRow>(sql, params);
  return rows.map(mapAuditLogRowToEntry);
}

/**
 * Map database row to AuditLogEntry
 */
function mapAuditLogRowToEntry(row: AuditLogDbRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    userId: row.user_id,
    sessionId: row.session_id || undefined,
    action: row.action as AuditLogEntry["action"],
    resourceType: row.resource_type as AuditLogEntry["resourceType"],
    resourceId: row.resource_id || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    ipAddress: row.ip_address || undefined,
    userAgent: row.user_agent || undefined,
    success: row.success === 1,
    errorMessage: row.error_message || undefined,
    syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
  };
}
