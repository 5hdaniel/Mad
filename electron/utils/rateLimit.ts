/**
 * Rate Limiting Utilities for IPC Handlers
 *
 * Provides throttle and debounce functions to prevent DoS attacks via rapid
 * repeated IPC calls to expensive handlers.
 *
 * Created as part of TASK-620: IPC Rate Limiting for Expensive Handlers
 *
 * Usage:
 *   import { throttle, createIPCRateLimiter } from './rateLimit';
 *
 *   // For simple throttling
 *   const throttledFn = throttle(expensiveFn, 5000);
 *
 *   // For IPC handlers with per-key rate limiting
 *   const rateLimiter = createIPCRateLimiter(30000); // 30 second cooldown
 *   if (!rateLimiter.canExecute('backup:start', deviceUdid)) {
 *     return { success: false, error: 'Rate limit exceeded. Try again later.' };
 *   }
 */

import log from "electron-log";

/**
 * Throttle function - limits execution to at most once per delay period.
 * Returns the last result if called during cooldown.
 *
 * @param fn - The function to throttle
 * @param delay - Minimum milliseconds between executions
 * @returns Throttled function that returns undefined during cooldown or last result
 *
 * @example
 * const throttledBackup = throttle(startBackup, 30000); // 30 second cooldown
 * throttledBackup(options); // Executes immediately
 * throttledBackup(options); // Returns undefined (within cooldown)
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  let lastResult: ReturnType<T> | undefined;

  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      lastResult = fn(...args) as ReturnType<T>;
      return lastResult;
    }
    return lastResult;
  };
}

/**
 * Debounce function - delays execution until no calls for delay period.
 * Useful for operations that should wait for user to stop typing/clicking.
 *
 * @param fn - The function to debounce
 * @param delay - Milliseconds to wait after last call before executing
 * @returns Debounced function
 *
 * @example
 * const debouncedSearch = debounce(searchContacts, 300);
 * debouncedSearch('john'); // Queued
 * debouncedSearch('john s'); // Replaces previous, resets timer
 * // After 300ms of no calls, searchContacts('john s') executes
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Rate limiter state for a single operation type.
 * Tracks cooldown per unique key (e.g., per device UDID, per user ID).
 */
interface RateLimiterState {
  /** Map of key -> last execution timestamp */
  lastCalls: Map<string, number>;
  /** Cooldown period in milliseconds */
  cooldownMs: number;
}

/**
 * IPC Rate Limiter for expensive handlers.
 *
 * Provides per-key rate limiting with configurable cooldown periods.
 * Unlike throttle(), this doesn't execute the function - it just checks
 * if execution is allowed and tracks state.
 *
 * Benefits over simple throttle():
 * - Per-key limiting (e.g., different devices can have their own cooldowns)
 * - Returns remaining cooldown time for user feedback
 * - Explicit check-before-execute pattern fits IPC handler flow better
 * - Can be shared across handler invocations
 */
export interface IPCRateLimiter {
  /**
   * Check if an operation can execute for the given key.
   * Updates last call time if allowed.
   *
   * @param channel - IPC channel name (for logging)
   * @param key - Unique key for rate limiting (e.g., deviceUdid, userId)
   * @returns Object with allowed status and remaining cooldown if blocked
   */
  canExecute(
    channel: string,
    key: string
  ): { allowed: boolean; remainingMs?: number };

  /**
   * Get remaining cooldown time for a key without executing.
   *
   * @param key - Unique key to check
   * @returns Remaining milliseconds, or 0 if not in cooldown
   */
  getRemainingCooldown(key: string): number;

  /**
   * Clear rate limit state for a key (e.g., on cancel/error).
   *
   * @param key - Unique key to clear
   */
  clearKey(key: string): void;

  /**
   * Clear all rate limit state.
   */
  clearAll(): void;
}

/**
 * Creates an IPC rate limiter with the specified cooldown period.
 *
 * @param cooldownMs - Cooldown period in milliseconds
 * @returns IPCRateLimiter instance
 *
 * @example
 * // In backup-handlers.ts
 * const backupRateLimiter = createIPCRateLimiter(30000); // 30 second cooldown
 *
 * ipcMain.handle('backup:start', async (_, options) => {
 *   const { allowed, remainingMs } = backupRateLimiter.canExecute('backup:start', options.udid);
 *   if (!allowed) {
 *     const seconds = Math.ceil(remainingMs! / 1000);
 *     return { success: false, error: `Please wait ${seconds}s before starting another backup.` };
 *   }
 *   // ... proceed with backup
 * });
 */
export function createIPCRateLimiter(cooldownMs: number): IPCRateLimiter {
  const state: RateLimiterState = {
    lastCalls: new Map(),
    cooldownMs,
  };

  return {
    canExecute(channel: string, key: string): { allowed: boolean; remainingMs?: number } {
      const now = Date.now();
      const lastCall = state.lastCalls.get(key) || 0;
      const elapsed = now - lastCall;

      if (elapsed < state.cooldownMs) {
        const remainingMs = state.cooldownMs - elapsed;
        log.debug(
          `[RateLimit] ${channel} blocked for key "${key}". ` +
            `Cooldown: ${Math.ceil(remainingMs / 1000)}s remaining`
        );
        return { allowed: false, remainingMs };
      }

      // Update last call time
      state.lastCalls.set(key, now);
      log.debug(`[RateLimit] ${channel} allowed for key "${key}"`);
      return { allowed: true };
    },

    getRemainingCooldown(key: string): number {
      const lastCall = state.lastCalls.get(key) || 0;
      const elapsed = Date.now() - lastCall;
      return Math.max(0, state.cooldownMs - elapsed);
    },

    clearKey(key: string): void {
      state.lastCalls.delete(key);
      log.debug(`[RateLimit] Cleared rate limit for key "${key}"`);
    },

    clearAll(): void {
      state.lastCalls.clear();
      log.debug("[RateLimit] Cleared all rate limits");
    },
  };
}

/**
 * Pre-configured rate limiters for expensive IPC handlers.
 *
 * These are exported as singletons so they persist across handler invocations
 * and maintain rate limit state for the lifetime of the main process.
 *
 * Thresholds are chosen to be generous enough for legitimate use while
 * preventing rapid-fire abuse:
 *
 * - Backup: 30s cooldown - backups are expensive (disk I/O, potentially hours)
 * - Sync: 10s cooldown - syncs involve network + disk but are more routine
 * - Scan: 5s cooldown - email scans hit external APIs
 * - Export: 10s cooldown - exports involve file I/O and PDF generation
 */
export const rateLimiters = {
  /**
   * Rate limiter for backup operations.
   * 30 second cooldown - backups are very expensive (full device backup).
   */
  backup: createIPCRateLimiter(30_000),

  /**
   * Rate limiter for sync operations.
   * 10 second cooldown - syncs involve device communication + database writes.
   */
  sync: createIPCRateLimiter(10_000),

  /**
   * Rate limiter for transaction scan operations.
   * 5 second cooldown - scans hit external email APIs.
   */
  scan: createIPCRateLimiter(5_000),

  /**
   * Rate limiter for export operations.
   * 10 second cooldown - exports involve PDF generation and file I/O.
   */
  export: createIPCRateLimiter(10_000),
} as const;
