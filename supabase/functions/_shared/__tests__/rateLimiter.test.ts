/**
 * Unit tests for the Edge Function rate limiter utility.
 *
 * The rate limiter is a pure TypeScript module with no Deno-specific imports,
 * so it can be tested with Jest in the Node.js test runner.
 */

import {
  checkRateLimit,
  resetRateLimitState,
  pruneExpiredEntries,
  getRateLimitMapSize,
} from '../rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  describe('checkRateLimit', () => {
    it('should allow the first request', () => {
      const result = checkRateLimit('user-1', 10, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should allow requests under the limit', () => {
      for (let i = 0; i < 9; i++) {
        const result = checkRateLimit('user-1', 10, 60_000);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests at the limit', () => {
      // Use up all 5 allowed requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user-1', 5, 60_000);
      }

      // 6th request should be blocked
      const result = checkRateLimit('user-1', 5, 60_000);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should track different keys independently', () => {
      // Max out user-1
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user-1', 3, 60_000);
      }
      expect(checkRateLimit('user-1', 3, 60_000).allowed).toBe(false);

      // user-2 should still be allowed
      expect(checkRateLimit('user-2', 3, 60_000).allowed).toBe(true);
    });

    it('should reset after the window expires', () => {
      // Use a very short window (1ms)
      for (let i = 0; i < 3; i++) {
        checkRateLimit('user-1', 3, 1);
      }

      // Wait for the window to expire
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait 5ms
      }

      // Should be allowed again after window reset
      const result = checkRateLimit('user-1', 3, 1);
      expect(result.allowed).toBe(true);
    });

    it('should return retryAfter in seconds', () => {
      // Use a 30-second window
      for (let i = 0; i < 2; i++) {
        checkRateLimit('user-1', 2, 30_000);
      }

      const result = checkRateLimit('user-1', 2, 30_000);
      expect(result.allowed).toBe(false);
      // retryAfter should be approximately 30 seconds (could be 29 or 30)
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
      expect(result.retryAfter).toBeLessThanOrEqual(30);
    });
  });

  describe('pruneExpiredEntries', () => {
    it('should remove expired entries from the map', () => {
      // Create entries with a very short window
      checkRateLimit('user-1', 10, 1);
      checkRateLimit('user-2', 10, 1);
      expect(getRateLimitMapSize()).toBe(2);

      // Wait for expiry
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait 5ms
      }

      pruneExpiredEntries();
      expect(getRateLimitMapSize()).toBe(0);
    });

    it('should keep non-expired entries', () => {
      // Create an entry with a long window
      checkRateLimit('user-long', 10, 60_000);
      // Create an entry with a short window
      checkRateLimit('user-short', 10, 1);

      // Wait for the short one to expire
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait 5ms
      }

      pruneExpiredEntries();
      expect(getRateLimitMapSize()).toBe(1);
    });
  });

  describe('resetRateLimitState', () => {
    it('should clear all entries', () => {
      checkRateLimit('user-1', 10, 60_000);
      checkRateLimit('user-2', 10, 60_000);
      expect(getRateLimitMapSize()).toBe(2);

      resetRateLimitState();
      expect(getRateLimitMapSize()).toBe(0);
    });

    it('should allow previously blocked keys after reset', () => {
      for (let i = 0; i < 2; i++) {
        checkRateLimit('user-1', 2, 60_000);
      }
      expect(checkRateLimit('user-1', 2, 60_000).allowed).toBe(false);

      resetRateLimitState();
      expect(checkRateLimit('user-1', 2, 60_000).allowed).toBe(true);
    });
  });
});
