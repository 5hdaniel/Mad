/**
 * Session Security Service
 * Handles session validity checks including idle timeout and absolute timeout
 */

import logService from './logService';

/**
 * Session validity check result
 */
export interface SessionValidityResult {
  valid: boolean;
  reason?: 'expired' | 'idle' | 'invalid';
}

/**
 * Session data interface (minimal for validation)
 */
interface SessionData {
  created_at: string;
  last_accessed_at?: string;
}

/**
 * Session Security Service Class
 * Manages session validity with idle and absolute timeout checks
 */
class SessionSecurityService {
  // Session timeout constants
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Track last activity time per session (in-memory)
  private lastActivityMap: Map<string, number> = new Map();

  /**
   * Record user activity for a session
   * @param sessionToken - The session token to track
   */
  recordActivity(sessionToken: string): void {
    this.lastActivityMap.set(sessionToken, Date.now());
  }

  /**
   * Get last activity time for a session
   * @param sessionToken - The session token to check
   * @returns Last activity timestamp or null if not tracked
   */
  getLastActivity(sessionToken: string): number | null {
    return this.lastActivityMap.get(sessionToken) || null;
  }

  /**
   * Check if a session is valid based on timeouts
   * @param session - Session data with created_at timestamp
   * @param sessionToken - The session token for activity tracking
   * @returns Session validity result
   */
  async checkSessionValidity(
    session: SessionData,
    sessionToken?: string
  ): Promise<SessionValidityResult> {
    const now = Date.now();

    // Check absolute timeout (24 hours from creation)
    const sessionCreatedAt = new Date(session.created_at).getTime();
    const sessionAge = now - sessionCreatedAt;

    if (sessionAge > this.SESSION_TIMEOUT_MS) {
      await logService.info(
        'Session expired due to age',
        'SessionSecurityService',
        {
          sessionAge: Math.round(sessionAge / 1000 / 60), // minutes
          maxAge: Math.round(this.SESSION_TIMEOUT_MS / 1000 / 60) // minutes
        }
      );

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
          await logService.info(
            'Session expired due to inactivity',
            'SessionSecurityService',
            {
              idleTime: Math.round(idleTime / 1000 / 60), // minutes
              maxIdleTime: Math.round(this.IDLE_TIMEOUT_MS / 1000 / 60) // minutes
            }
          );

          // Clean up activity tracking
          this.lastActivityMap.delete(sessionToken);

          return { valid: false, reason: 'idle' };
        }
      } else {
        // First activity tracking for this session
        // Use last_accessed_at from database if available, otherwise session creation time
        const lastAccessedAt = session.last_accessed_at
          ? new Date(session.last_accessed_at).getTime()
          : sessionCreatedAt;

        const idleTime = now - lastAccessedAt;

        if (idleTime > this.IDLE_TIMEOUT_MS) {
          await logService.info(
            'Session expired due to inactivity (from database timestamp)',
            'SessionSecurityService',
            {
              idleTime: Math.round(idleTime / 1000 / 60), // minutes
              maxIdleTime: Math.round(this.IDLE_TIMEOUT_MS / 1000 / 60) // minutes
            }
          );

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
  cleanupSession(sessionToken: string): void {
    this.lastActivityMap.delete(sessionToken);
  }

  /**
   * Get remaining session time in seconds
   * @param session - Session data with created_at timestamp
   * @returns Remaining time in seconds, or 0 if expired
   */
  getRemainingSessionTime(session: SessionData): number {
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
  getRemainingIdleTime(sessionToken: string): number {
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
  getConfig(): { idleTimeoutMs: number; sessionTimeoutMs: number } {
    return {
      idleTimeoutMs: this.IDLE_TIMEOUT_MS,
      sessionTimeoutMs: this.SESSION_TIMEOUT_MS,
    };
  }

  /**
   * Clear all activity tracking (for testing or shutdown)
   */
  clearAllActivity(): void {
    this.lastActivityMap.clear();
  }
}

// Export singleton instance
export const sessionSecurityService = new SessionSecurityService();
export default sessionSecurityService;
