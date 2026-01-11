/**
 * Audit Service
 * Centralized audit logging system that tracks all security-relevant user actions
 * with "who, what, when, where" attribution.
 *
 * Key features:
 * - Append-only local logging (immutable)
 * - Cloud sync to Supabase when online
 * - Queue mechanism for offline operation
 */

import crypto from "crypto";
import logService from "./logService";

// ============================================
// TYPES
// ============================================

/**
 * Audit actions representing security-relevant user operations
 */
export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "DATA_ACCESS"
  | "DATA_EXPORT"
  | "DATA_DELETE"
  | "TRANSACTION_CREATE"
  | "TRANSACTION_UPDATE"
  | "TRANSACTION_DELETE"
  | "CONTACT_CREATE"
  | "CONTACT_UPDATE"
  | "CONTACT_DELETE"
  | "SETTINGS_CHANGE"
  | "MAILBOX_CONNECT"
  | "MAILBOX_DISCONNECT";

/**
 * Resource types that can be audited
 */
export type ResourceType =
  | "USER"
  | "SESSION"
  | "TRANSACTION"
  | "CONTACT"
  | "COMMUNICATION"
  | "EXPORT"
  | "MAILBOX"
  | "SETTINGS";

/**
 * Complete audit log entry with all fields
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  sessionId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  syncedAt?: Date;
}

/**
 * Input for creating a new audit log entry (excludes auto-generated fields)
 */
export type NewAuditLogEntry = Omit<
  AuditLogEntry,
  "id" | "timestamp" | "syncedAt"
>;

/**
 * Database representation of audit log entry
 */
export interface AuditLogDbRow {
  id: string;
  timestamp: string;
  user_id: string;
  session_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: number;
  error_message: string | null;
  synced_at: string | null;
}

// ============================================
// DATABASE SERVICE INTERFACE
// ============================================

/**
 * Interface for database operations that AuditService needs
 * This allows for dependency injection and testing
 */
interface IDatabaseService {
  insertAuditLog(entry: AuditLogEntry): Promise<void>;
  getUnsyncedAuditLogs(limit?: number): Promise<AuditLogEntry[]>;
  markAuditLogsSynced(ids: string[]): Promise<void>;
}

/**
 * Interface for Supabase operations that AuditService needs
 */
interface ISupabaseService {
  batchInsertAuditLogs(entries: AuditLogEntry[]): Promise<void>;
}

// ============================================
// AUDIT SERVICE CLASS
// ============================================

class AuditService {
  private pendingSyncQueue: AuditLogEntry[] = [];
  private syncInProgress = false;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private databaseService: IDatabaseService | null = null;
  private supabaseService: ISupabaseService | null = null;
  private initialized = false;

  private readonly SYNC_INTERVAL_MS = 60000; // 1 minute
  private readonly SYNC_BATCH_SIZE = 100;

  /**
   * Initialize the audit service with required dependencies
   */
  initialize(
    databaseService: IDatabaseService,
    supabaseService: ISupabaseService,
  ): void {
    if (this.initialized) {
      return;
    }

    this.databaseService = databaseService;
    this.supabaseService = supabaseService;
    this.initialized = true;

    // Start periodic sync
    this.startSyncInterval();

    logService.debug("Audit service initialized", "AuditService");
  }

  /**
   * Start periodic sync interval
   */
  private startSyncInterval(): void {
    if (this.syncIntervalId) {
      return;
    }

    this.syncIntervalId = setInterval(() => {
      this.syncToCloud().catch((error) => {
        logService.warn("Periodic sync failed", "AuditService", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic sync interval
   */
  stopSyncInterval(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Log an audit event - this is append-only
   * @param entry - Audit entry data (id and timestamp will be auto-generated)
   */
  async log(entry: NewAuditLogEntry): Promise<void> {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Never log sensitive data in metadata
    if (fullEntry.metadata) {
      fullEntry.metadata = this.sanitizeMetadata(fullEntry.metadata);
    }

    try {
      // Write to local database (append-only table)
      await this.writeToLocal(fullEntry);

      // Queue for cloud sync
      this.pendingSyncQueue.push(fullEntry);

      // Attempt cloud sync (non-blocking)
      this.syncToCloud().catch(() => {
        // Silent catch - will retry on next log or interval
      });
    } catch (error) {
      // Log the failure but don't throw - audit failures shouldn't break the app
      logService.error("Failed to write audit log", "AuditService", {
        action: entry.action,
        resourceType: entry.resourceType,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Audit wrapper for handlers - logs success or failure
   * @param params - Audit parameters
   * @param operation - The operation to wrap
   * @returns The result of the operation
   */
  async withAudit<T>(
    params: {
      userId: string;
      sessionId?: string;
      action: AuditAction;
      resourceType: ResourceType;
      resourceId?: string;
      metadata?: Record<string, unknown>;
    },
    operation: () => Promise<T>,
  ): Promise<T> {
    const { userId, sessionId, action, resourceType, resourceId, metadata } =
      params;

    try {
      const result = await operation();

      await this.log({
        userId,
        sessionId,
        action,
        resourceType,
        resourceId,
        metadata,
        success: true,
      });

      return result;
    } catch (error) {
      await this.log({
        userId,
        sessionId,
        action,
        resourceType,
        resourceId,
        metadata,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  /**
   * Write audit entry to local database
   */
  private async writeToLocal(entry: AuditLogEntry): Promise<void> {
    if (!this.databaseService) {
      throw new Error("AuditService not initialized - call initialize() first");
    }

    await this.databaseService.insertAuditLog(entry);
  }

  /**
   * Sync pending audit logs to cloud
   */
  async syncToCloud(): Promise<void> {
    if (this.syncInProgress || this.pendingSyncQueue.length === 0) {
      return;
    }

    if (!this.supabaseService || !this.databaseService) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Get entries to sync (from queue or database)
      let entriesToSync: AuditLogEntry[] = [];

      if (this.pendingSyncQueue.length > 0) {
        entriesToSync = this.pendingSyncQueue.slice(0, this.SYNC_BATCH_SIZE);
      } else {
        // Check database for any unsynced entries
        entriesToSync = await this.databaseService.getUnsyncedAuditLogs(
          this.SYNC_BATCH_SIZE,
        );
      }

      if (entriesToSync.length === 0) {
        return;
      }

      // Sync to cloud
      await this.supabaseService.batchInsertAuditLogs(entriesToSync);

      // Mark as synced in local database
      const ids = entriesToSync.map((e) => e.id);
      await this.databaseService.markAuditLogsSynced(ids);

      // Remove from queue
      this.pendingSyncQueue = this.pendingSyncQueue.filter(
        (e) => !ids.includes(e.id),
      );

      logService.info(
        `Synced ${entriesToSync.length} audit logs to cloud`,
        "AuditService",
      );
    } catch (error) {
      // Will retry on next sync attempt
      logService.warn("Failed to sync audit logs to cloud", "AuditService", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Force sync all pending logs (useful before app shutdown)
   */
  async flushPendingLogs(): Promise<void> {
    while (this.pendingSyncQueue.length > 0) {
      await this.syncToCloud();
    }
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized = { ...metadata };

    // List of sensitive keys that should never be logged
    const sensitiveKeys = [
      "password",
      "token",
      "access_token",
      "refresh_token",
      "secret",
      "key",
      "api_key",
      "apiKey",
      "authorization",
      "credential",
      "credentials",
    ];

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (
        sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))
      ) {
        sanitized[key] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  /**
   * Get pending sync count (for monitoring)
   */
  getPendingSyncCount(): number {
    return this.pendingSyncQueue.length;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const auditService = new AuditService();
export default auditService;
