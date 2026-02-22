/**
 * In-memory rate limiter for Supabase Edge Functions.
 *
 * Uses a fixed-window approach: each key tracks a request count and a window
 * expiration timestamp.  When the window expires the counter resets.
 *
 * **Important:** Deno Deploy isolates may not share memory across invocations.
 * This means the rate limiter is "best effort" -- it will catch sustained abuse
 * within a single isolate but cannot guarantee global enforcement.  For v1 this
 * is an acceptable trade-off; a Supabase-table-based approach can be added later
 * if stricter enforcement is needed.
 *
 * No external imports -- fully self-contained for maximum compatibility.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/** Counter used to trigger periodic cleanup of expired entries. */
let requestCounter = 0;

/** How often (in requests) to run stale-entry cleanup. */
const CLEANUP_INTERVAL = 1000;

/**
 * Remove expired entries from the rate limit map to prevent memory leaks.
 * Called automatically every {@link CLEANUP_INTERVAL} requests.
 */
export function pruneExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Check whether a request identified by `key` is within its rate limit.
 *
 * @param key          Unique identifier for the client (e.g. token hash, user ID, IP).
 * @param maxRequests  Maximum number of requests allowed within the window.
 * @param windowMs     Window duration in milliseconds.
 * @returns            `{ allowed: true }` if within limits, or
 *                     `{ allowed: false, retryAfter: <seconds> }` if exceeded.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Periodic cleanup
  requestCounter++;
  if (requestCounter >= CLEANUP_INTERVAL) {
    requestCounter = 0;
    pruneExpiredEntries();
  }

  const entry = rateLimitMap.get(key);

  // No existing entry or window expired -- start a new window
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  // Window is still active -- check count
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Within limit -- increment
  entry.count++;
  return { allowed: true };
}

/**
 * Reset all rate limit state.  Useful for testing.
 */
export function resetRateLimitState(): void {
  rateLimitMap.clear();
  requestCounter = 0;
}

/**
 * Get the current size of the rate limit map.  Useful for testing / monitoring.
 */
export function getRateLimitMapSize(): number {
  return rateLimitMap.size;
}
