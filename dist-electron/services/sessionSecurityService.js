"use strict";
/**
 * Session Security Service
 * Handles session validity checks including idle timeout and absolute timeout
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionSecurityService = void 0;
const logService_1 = __importDefault(require("./logService"));
/**
 * Session Security Service Class
 * Manages session validity with idle and absolute timeout checks
 */
class SessionSecurityService {
    constructor() {
        // Session timeout constants
        this.IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
        this.SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
        // Track last activity time per session (in-memory)
        this.lastActivityMap = new Map();
    }
    /**
     * Record user activity for a session
     * @param sessionToken - The session token to track
     */
    recordActivity(sessionToken) {
        this.lastActivityMap.set(sessionToken, Date.now());
    }
    /**
     * Get last activity time for a session
     * @param sessionToken - The session token to check
     * @returns Last activity timestamp or null if not tracked
     */
    getLastActivity(sessionToken) {
        return this.lastActivityMap.get(sessionToken) || null;
    }
    /**
     * Check if a session is valid based on timeouts
     * @param session - Session data with created_at timestamp
     * @param sessionToken - The session token for activity tracking
     * @returns Session validity result
     */
    async checkSessionValidity(session, sessionToken) {
        const now = Date.now();
        // Check absolute timeout (24 hours from creation)
        const sessionCreatedAt = new Date(session.created_at).getTime();
        const sessionAge = now - sessionCreatedAt;
        if (sessionAge > this.SESSION_TIMEOUT_MS) {
            await logService_1.default.info('Session expired due to age', 'SessionSecurityService', {
                sessionAge: Math.round(sessionAge / 1000 / 60), // minutes
                maxAge: Math.round(this.SESSION_TIMEOUT_MS / 1000 / 60) // minutes
            });
            // Clean up activity tracking
            if (sessionToken) {
                this.lastActivityMap.delete(sessionToken);
            }
            return { valid: false, reason: 'expired' };
        }
        // Check idle timeout (30 minutes of inactivity)
        if (sessionToken) {
            const lastActivity = this.lastActivityMap.get(sessionToken);
            if (lastActivity) {
                const idleTime = now - lastActivity;
                if (idleTime > this.IDLE_TIMEOUT_MS) {
                    await logService_1.default.info('Session expired due to inactivity', 'SessionSecurityService', {
                        idleTime: Math.round(idleTime / 1000 / 60), // minutes
                        maxIdleTime: Math.round(this.IDLE_TIMEOUT_MS / 1000 / 60) // minutes
                    });
                    // Clean up activity tracking
                    this.lastActivityMap.delete(sessionToken);
                    return { valid: false, reason: 'idle' };
                }
            }
            else {
                // First activity tracking for this session
                // Use last_accessed_at from database if available, otherwise session creation time
                const lastAccessedAt = session.last_accessed_at
                    ? new Date(session.last_accessed_at).getTime()
                    : sessionCreatedAt;
                const idleTime = now - lastAccessedAt;
                if (idleTime > this.IDLE_TIMEOUT_MS) {
                    await logService_1.default.info('Session expired due to inactivity (from database timestamp)', 'SessionSecurityService', {
                        idleTime: Math.round(idleTime / 1000 / 60), // minutes
                        maxIdleTime: Math.round(this.IDLE_TIMEOUT_MS / 1000 / 60) // minutes
                    });
                    return { valid: false, reason: 'idle' };
                }
                // Initialize activity tracking
                this.lastActivityMap.set(sessionToken, now);
            }
        }
        return { valid: true };
    }
    /**
     * Clean up session from activity tracking
     * @param sessionToken - The session token to remove
     */
    cleanupSession(sessionToken) {
        this.lastActivityMap.delete(sessionToken);
    }
    /**
     * Get remaining session time in seconds
     * @param session - Session data with created_at timestamp
     * @returns Remaining time in seconds, or 0 if expired
     */
    getRemainingSessionTime(session) {
        const sessionCreatedAt = new Date(session.created_at).getTime();
        const expiresAt = sessionCreatedAt + this.SESSION_TIMEOUT_MS;
        const remaining = expiresAt - Date.now();
        return Math.max(0, Math.round(remaining / 1000));
    }
    /**
     * Get remaining idle time in seconds
     * @param sessionToken - The session token to check
     * @returns Remaining idle time in seconds, or 0 if expired
     */
    getRemainingIdleTime(sessionToken) {
        const lastActivity = this.lastActivityMap.get(sessionToken);
        if (!lastActivity) {
            return Math.round(this.IDLE_TIMEOUT_MS / 1000); // Full idle time if not tracked
        }
        const expiresAt = lastActivity + this.IDLE_TIMEOUT_MS;
        const remaining = expiresAt - Date.now();
        return Math.max(0, Math.round(remaining / 1000));
    }
    /**
     * Get current configuration values
     */
    getConfig() {
        return {
            idleTimeoutMs: this.IDLE_TIMEOUT_MS,
            sessionTimeoutMs: this.SESSION_TIMEOUT_MS,
        };
    }
    /**
     * Clear all activity tracking (for testing or shutdown)
     */
    clearAllActivity() {
        this.lastActivityMap.clear();
    }
}
// Export singleton instance
exports.sessionSecurityService = new SessionSecurityService();
exports.default = exports.sessionSecurityService;
