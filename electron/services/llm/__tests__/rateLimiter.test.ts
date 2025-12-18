/**
 * @jest-environment node
 */

import { RateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    jest.useFakeTimers();
    rateLimiter = new RateLimiter(60); // 60 requests per minute
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default 60 requests per minute', () => {
      const limiter = new RateLimiter();
      expect(limiter.getAvailableTokens()).toBe(60);
    });

    it('should initialize with custom requests per minute', () => {
      const limiter = new RateLimiter(100);
      expect(limiter.getAvailableTokens()).toBe(100);
    });
  });

  describe('tryAcquire', () => {
    it('should return true when tokens are available', () => {
      expect(rateLimiter.tryAcquire()).toBe(true);
    });

    it('should decrement tokens on successful acquire', () => {
      const initialTokens = rateLimiter.getAvailableTokens();
      rateLimiter.tryAcquire();
      expect(rateLimiter.getAvailableTokens()).toBe(initialTokens - 1);
    });

    it('should return false when no tokens available', () => {
      // Exhaust all tokens
      for (let i = 0; i < 60; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.tryAcquire()).toBe(false);
    });

    it('should allow acquire after tokens refill', () => {
      // Exhaust all tokens
      for (let i = 0; i < 60; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.tryAcquire()).toBe(false);

      // Advance time by 1 second (should refill 1 token)
      jest.advanceTimersByTime(1000);
      expect(rateLimiter.tryAcquire()).toBe(true);
    });
  });

  describe('acquire', () => {
    it('should return 0 wait time when tokens available', async () => {
      const waitTime = await rateLimiter.acquire();
      expect(waitTime).toBe(0);
    });

    it('should wait and return wait time when no tokens available', async () => {
      // Exhaust all tokens
      for (let i = 0; i < 60; i++) {
        await rateLimiter.acquire();
      }

      // Start acquire (will wait)
      const acquirePromise = rateLimiter.acquire();

      // The wait time should be about 1000ms for 1 token at 60/min
      jest.advanceTimersByTime(1000);

      const waitTime = await acquirePromise;
      expect(waitTime).toBeGreaterThan(0);
    });
  });

  describe('getWaitTime', () => {
    it('should return 0 when tokens are available', () => {
      expect(rateLimiter.getWaitTime()).toBe(0);
    });

    it('should return positive wait time when no tokens', () => {
      // Exhaust all tokens
      for (let i = 0; i < 60; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.getWaitTime()).toBeGreaterThan(0);
    });

    it('should return correct wait time based on refill rate', () => {
      // Exhaust all tokens
      for (let i = 0; i < 60; i++) {
        rateLimiter.tryAcquire();
      }
      // At 60 req/min = 1 req/sec, wait time for 1 token should be ~1000ms
      const waitTime = rateLimiter.getWaitTime();
      expect(waitTime).toBeGreaterThanOrEqual(900);
      expect(waitTime).toBeLessThanOrEqual(1100);
    });
  });

  describe('getAvailableTokens', () => {
    it('should return initial token count', () => {
      expect(rateLimiter.getAvailableTokens()).toBe(60);
    });

    it('should return decremented count after acquire', () => {
      rateLimiter.tryAcquire();
      rateLimiter.tryAcquire();
      expect(rateLimiter.getAvailableTokens()).toBe(58);
    });

    it('should not exceed max tokens after long time', () => {
      // Advance time by a lot
      jest.advanceTimersByTime(120000); // 2 minutes
      expect(rateLimiter.getAvailableTokens()).toBe(60);
    });
  });

  describe('reset', () => {
    it('should restore tokens to max capacity', () => {
      // Exhaust some tokens
      for (let i = 0; i < 30; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.getAvailableTokens()).toBe(30);

      rateLimiter.reset();
      expect(rateLimiter.getAvailableTokens()).toBe(60);
    });

    it('should reset even when fully exhausted', () => {
      // Exhaust all tokens
      for (let i = 0; i < 60; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.getAvailableTokens()).toBe(0);

      rateLimiter.reset();
      expect(rateLimiter.getAvailableTokens()).toBe(60);
    });
  });

  describe('refill behavior', () => {
    it('should refill tokens over time', () => {
      // Use 30 tokens
      for (let i = 0; i < 30; i++) {
        rateLimiter.tryAcquire();
      }
      expect(rateLimiter.getAvailableTokens()).toBe(30);

      // Advance time by 30 seconds (should refill 30 tokens)
      jest.advanceTimersByTime(30000);
      expect(rateLimiter.getAvailableTokens()).toBe(60);
    });

    it('should refill at correct rate', () => {
      // Use all tokens
      for (let i = 0; i < 60; i++) {
        rateLimiter.tryAcquire();
      }

      // At 60/min = 1/sec, after 10 seconds should have ~10 tokens
      jest.advanceTimersByTime(10000);
      expect(rateLimiter.getAvailableTokens()).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle very low rate limits', () => {
      const slowLimiter = new RateLimiter(1); // 1 request per minute
      expect(slowLimiter.tryAcquire()).toBe(true);
      expect(slowLimiter.tryAcquire()).toBe(false);

      // Should need to wait 60 seconds for next token
      const waitTime = slowLimiter.getWaitTime();
      expect(waitTime).toBeGreaterThanOrEqual(59000);
      expect(waitTime).toBeLessThanOrEqual(61000);
    });

    it('should handle high rate limits', () => {
      const fastLimiter = new RateLimiter(6000); // 100 requests per second
      for (let i = 0; i < 100; i++) {
        expect(fastLimiter.tryAcquire()).toBe(true);
      }
    });
  });
});
