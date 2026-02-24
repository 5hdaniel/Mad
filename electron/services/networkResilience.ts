/**
 * Network Resilience Service (TASK-2049)
 *
 * Provides network-resilient email sync with:
 * - Partial sync progress tracking (save what you fetched before disconnect)
 * - Exponential backoff retry on network errors
 * - Auto-retry on network reconnection via Electron's 'online' event
 * - User-friendly sync status events
 *
 * This service wraps the existing email sync flow in emailSyncHandlers.ts
 * rather than modifying the fetch services directly, keeping the change
 * surface minimal and testable.
 */

import logService from "./logService";
import { isNetworkError } from "../utils/networkErrors";

/**
 * Result of a partial sync operation.
 * When network disconnects mid-sync, this captures what was completed.
 */
export interface PartialSyncResult {
  /** Sync completed fully or was interrupted */
  status: "complete" | "partial" | "failed";
  /** Number of emails successfully saved before failure */
  savedCount: number;
  /** Provider that was being synced */
  provider: "gmail" | "outlook";
  /** User-friendly error message (only for partial/failed) */
  error?: string;
  /** Total emails that were fetched (may be > savedCount if save failed) */
  fetchedCount?: number;
}

/**
 * State for a pending retry after network disconnection.
 */
export interface PendingSyncRetry {
  /** User ID for the sync */
  userId: string;
  /** Provider to retry */
  provider: "gmail" | "outlook";
  /** When the failure occurred */
  failedAt: Date;
  /** Number of retry attempts so far */
  retryCount: number;
  /** Emails saved before failure */
  savedCount: number;
}

/**
 * Configuration for network-resilient retry behavior.
 */
export interface NetworkRetryConfig {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: number;
}

/**
 * Default retry configuration matching task acceptance criteria:
 * 1s, 2s, 4s, 8s, max 30s with 5 retries
 */
export const DEFAULT_NETWORK_RETRY_CONFIG: NetworkRetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Calculate exponential backoff delay.
 *
 * @param attempt - Current attempt (0-indexed)
 * @param baseDelayMs - Base delay in ms
 * @param maxDelayMs - Maximum delay cap in ms
 * @returns Delay in milliseconds
 */
export function calculateNetworkBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Execute an async operation with network-aware retry.
 *
 * Retries ONLY on network errors (isNetworkError). Non-network errors
 * (auth failures, 4xx responses, etc.) are thrown immediately.
 *
 * Uses exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at maxDelayMs).
 *
 * @param operation - The async operation to execute
 * @param config - Retry configuration
 * @param context - Logging context string (e.g., "Gmail sync")
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted or a non-network error
 */
export async function retryOnNetwork<T>(
  operation: () => Promise<T>,
  config: NetworkRetryConfig = DEFAULT_NETWORK_RETRY_CONFIG,
  context: string = "EmailSync"
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Non-network errors: throw immediately, no retry
      if (!isNetworkError(error)) {
        throw lastError;
      }

      // Last attempt: throw
      if (attempt === config.maxRetries) {
        logService.error(
          `Network retry exhausted after ${config.maxRetries} attempts`,
          context,
          { error: lastError.message }
        );
        throw lastError;
      }

      const delay = calculateNetworkBackoff(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs
      );

      logService.warn(
        `Network error during sync, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`,
        context,
        { error: lastError.message }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript requires this, though it should be unreachable
  throw lastError!;
}

/**
 * NetworkResilienceService
 *
 * Manages pending sync retries after network disconnection.
 * Listens for Electron 'online' events to auto-retry.
 *
 * Usage:
 * 1. When a sync fails due to network error, call recordPartialSync()
 * 2. When network comes back online, retryPendingSync() is auto-triggered
 * 3. The retry callback re-invokes the full sync flow
 */
export class NetworkResilienceService {
  private pendingRetries: Map<string, PendingSyncRetry> = new Map();
  private retryCallback: ((userId: string, provider: "gmail" | "outlook") => Promise<void>) | null = null;
  private isRetrying = false;

  /**
   * Register a callback that will be invoked when network reconnects
   * and pending retries exist.
   *
   * @param callback - Function to re-invoke sync for a user/provider
   */
  setRetryCallback(
    callback: (userId: string, provider: "gmail" | "outlook") => Promise<void>
  ): void {
    this.retryCallback = callback;
  }

  /**
   * Record a partial sync that needs to be retried when network returns.
   *
   * @param userId - User whose sync failed
   * @param provider - The email provider
   * @param savedCount - Emails saved before failure
   */
  recordPartialSync(
    userId: string,
    provider: "gmail" | "outlook",
    savedCount: number
  ): void {
    const key = `${userId}:${provider}`;
    const existing = this.pendingRetries.get(key);

    this.pendingRetries.set(key, {
      userId,
      provider,
      failedAt: new Date(),
      retryCount: existing ? existing.retryCount + 1 : 0,
      savedCount,
    });

    logService.info(
      `Recorded partial sync for retry: ${provider} (${savedCount} emails saved)`,
      "NetworkResilience",
      { userId, provider, savedCount }
    );
  }

  /**
   * Check if there are any pending retries.
   */
  hasPendingRetries(): boolean {
    return this.pendingRetries.size > 0;
  }

  /**
   * Get all pending retries (for status reporting).
   */
  getPendingRetries(): PendingSyncRetry[] {
    return Array.from(this.pendingRetries.values());
  }

  /**
   * Clear all pending retries (e.g., when user manually triggers sync).
   */
  clearPendingRetries(): void {
    this.pendingRetries.clear();
  }

  /**
   * Retry all pending syncs. Called when network comes back online.
   *
   * Processes retries sequentially to avoid overwhelming the API.
   * Failed retries remain in the queue for the next online event.
   */
  async retryPendingSync(): Promise<void> {
    if (this.isRetrying || !this.retryCallback || this.pendingRetries.size === 0) {
      return;
    }

    this.isRetrying = true;

    logService.info(
      `Network restored. Retrying ${this.pendingRetries.size} pending syncs`,
      "NetworkResilience"
    );

    const retries = Array.from(this.pendingRetries.entries());

    for (const [key, state] of retries) {
      if (state.retryCount >= DEFAULT_NETWORK_RETRY_CONFIG.maxRetries) {
        logService.warn(
          `Skipping retry for ${key}: max retries (${DEFAULT_NETWORK_RETRY_CONFIG.maxRetries}) exceeded`,
          "NetworkResilience"
        );
        this.pendingRetries.delete(key);
        continue;
      }

      try {
        await this.retryCallback(state.userId, state.provider);
        this.pendingRetries.delete(key);
        logService.info(
          `Retry succeeded for ${key}`,
          "NetworkResilience"
        );
      } catch (error) {
        if (isNetworkError(error)) {
          // Still offline, increment retry count and leave in queue
          state.retryCount++;
          state.failedAt = new Date();
          logService.warn(
            `Retry failed for ${key}: still offline (attempt ${state.retryCount})`,
            "NetworkResilience"
          );
        } else {
          // Non-network error, remove from queue
          this.pendingRetries.delete(key);
          logService.error(
            `Retry failed for ${key} with non-network error, removing from queue`,
            "NetworkResilience",
            { error: error instanceof Error ? error.message : "Unknown" }
          );
        }
      }
    }

    this.isRetrying = false;
  }
}

/**
 * Singleton instance of the network resilience service.
 */
export const networkResilienceService = new NetworkResilienceService();
