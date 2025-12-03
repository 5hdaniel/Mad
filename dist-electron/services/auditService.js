"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logService_1 = __importDefault(require("./logService"));
// ============================================
// AUDIT SERVICE CLASS
// ============================================
class AuditService {
    constructor() {
        this.pendingSyncQueue = [];
        this.syncInProgress = false;
        this.syncIntervalId = null;
        this.databaseService = null;
        this.supabaseService = null;
        this.initialized = false;
        this.SYNC_INTERVAL_MS = 60000; // 1 minute
        this.SYNC_BATCH_SIZE = 100;
    }
    /**
     * Initialize the audit service with required dependencies
     */
    initialize(databaseService, supabaseService) {
        if (this.initialized) {
            return;
        }
        this.databaseService = databaseService;
        this.supabaseService = supabaseService;
        this.initialized = true;
        // Start periodic sync
        this.startSyncInterval();
        logService_1.default.info('Audit service initialized', 'AuditService');
    }
    /**
     * Start periodic sync interval
     */
    startSyncInterval() {
        if (this.syncIntervalId) {
            return;
        }
        this.syncIntervalId = setInterval(() => {
            this.syncToCloud().catch((error) => {
                logService_1.default.warn('Periodic sync failed', 'AuditService', { error: error instanceof Error ? error.message : 'Unknown error' });
            });
        }, this.SYNC_INTERVAL_MS);
    }
    /**
     * Stop periodic sync interval
     */
    stopSyncInterval() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }
    /**
     * Log an audit event - this is append-only
     * @param entry - Audit entry data (id and timestamp will be auto-generated)
     */
    async log(entry) {
        const fullEntry = {
            ...entry,
            id: crypto_1.default.randomUUID(),
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
        }
        catch (error) {
            // Log the failure but don't throw - audit failures shouldn't break the app
            logService_1.default.error('Failed to write audit log', 'AuditService', {
                action: entry.action,
                resourceType: entry.resourceType,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * Audit wrapper for handlers - logs success or failure
     * @param params - Audit parameters
     * @param operation - The operation to wrap
     * @returns The result of the operation
     */
    async withAudit(params, operation) {
        const { userId, sessionId, action, resourceType, resourceId, metadata } = params;
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
        }
        catch (error) {
            await this.log({
                userId,
                sessionId,
                action,
                resourceType,
                resourceId,
                metadata,
                success: false,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    /**
     * Write audit entry to local database
     */
    async writeToLocal(entry) {
        if (!this.databaseService) {
            throw new Error('AuditService not initialized - call initialize() first');
        }
        await this.databaseService.insertAuditLog(entry);
    }
    /**
     * Sync pending audit logs to cloud
     */
    async syncToCloud() {
        if (this.syncInProgress || this.pendingSyncQueue.length === 0) {
            return;
        }
        if (!this.supabaseService || !this.databaseService) {
            return;
        }
        this.syncInProgress = true;
        try {
            // Get entries to sync (from queue or database)
            let entriesToSync = [];
            if (this.pendingSyncQueue.length > 0) {
                entriesToSync = this.pendingSyncQueue.slice(0, this.SYNC_BATCH_SIZE);
            }
            else {
                // Check database for any unsynced entries
                entriesToSync = await this.databaseService.getUnsyncedAuditLogs(this.SYNC_BATCH_SIZE);
            }
            if (entriesToSync.length === 0) {
                return;
            }
            // Sync to cloud
            await this.supabaseService.batchInsertAuditLogs(entriesToSync);
            // Mark as synced in local database
            const ids = entriesToSync.map(e => e.id);
            await this.databaseService.markAuditLogsSynced(ids);
            // Remove from queue
            this.pendingSyncQueue = this.pendingSyncQueue.filter(e => !ids.includes(e.id));
            logService_1.default.info(`Synced ${entriesToSync.length} audit logs to cloud`, 'AuditService');
        }
        catch (error) {
            // Will retry on next sync attempt
            logService_1.default.warn('Failed to sync audit logs to cloud', 'AuditService', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
        finally {
            this.syncInProgress = false;
        }
    }
    /**
     * Force sync all pending logs (useful before app shutdown)
     */
    async flushPendingLogs() {
        while (this.pendingSyncQueue.length > 0) {
            await this.syncToCloud();
        }
    }
    /**
     * Sanitize metadata to remove sensitive information
     */
    sanitizeMetadata(metadata) {
        const sanitized = { ...metadata };
        // List of sensitive keys that should never be logged
        const sensitiveKeys = [
            'password',
            'token',
            'access_token',
            'refresh_token',
            'secret',
            'key',
            'api_key',
            'apiKey',
            'authorization',
            'credential',
            'credentials',
        ];
        for (const key of Object.keys(sanitized)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    /**
     * Get pending sync count (for monitoring)
     */
    getPendingSyncCount() {
        return this.pendingSyncQueue.length;
    }
    /**
     * Check if service is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}
// Export singleton instance
exports.auditService = new AuditService();
exports.default = exports.auditService;
