/**
 * In-memory rate limiter using sliding window.
 *
 * Tracks request timestamps per key (typically IP address) and enforces
 * a maximum number of requests within a rolling time window.
 *
 * Note: This is per-process only. In a multi-instance deployment,
 * consider replacing with a Redis-backed solution.
 */

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RequestRecord {
  timestamps: number[];
}

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly requests: Map<string, RequestRecord> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;

    // Auto-cleanup expired entries every 60 seconds to prevent memory leaks
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    // Allow the Node.js process to exit even if the timer is still active
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check if a request from the given key should be allowed.
   *
   * @param key - Identifier for the requester (e.g., IP address)
   * @returns true if the request is within the rate limit, false if exceeded
   */
  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.requests.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.requests.set(key, record);
    }

    // Remove timestamps outside the current window (sliding window)
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    // Check if adding this request would exceed the limit
    if (record.timestamps.length >= this.maxRequests) {
      return false;
    }

    // Record this request
    record.timestamps.push(now);
    return true;
  }

  /**
   * Remove entries with no timestamps in the current window.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, record] of this.requests) {
      record.timestamps = record.timestamps.filter((t) => t > windowStart);
      if (record.timestamps.length === 0) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * Rate limiter for the impersonation entry route.
 * Allows 5 requests per IP per 60-second window.
 */
export const impersonationRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});
