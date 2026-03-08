import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });

    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
  });

  it('blocks requests exceeding the limit', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });

    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    // 4th request should be blocked
    expect(limiter.check('192.168.1.1')).toBe(false);
  });

  it('tracks different keys independently', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });

    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(false);

    // Different IP should still be allowed
    expect(limiter.check('10.0.0.1')).toBe(true);
    expect(limiter.check('10.0.0.1')).toBe(true);
    expect(limiter.check('10.0.0.1')).toBe(false);
  });

  it('resets after the time window expires', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 100 });

    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(true);
    expect(limiter.check('192.168.1.1')).toBe(false);

    // Fast-forward time by manipulating Date.now
    const originalNow = Date.now;
    Date.now = () => originalNow() + 150;

    try {
      // After window expires, should be allowed again
      expect(limiter.check('192.168.1.1')).toBe(true);
    } finally {
      Date.now = originalNow;
    }
  });

  it('implements sliding window (partial expiry)', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
    const baseTime = Date.now();
    const originalNow = Date.now;

    try {
      // Request at t=0
      Date.now = () => baseTime;
      expect(limiter.check('ip')).toBe(true);

      // Request at t=400ms
      Date.now = () => baseTime + 400;
      expect(limiter.check('ip')).toBe(true);

      // Request at t=800ms
      Date.now = () => baseTime + 800;
      expect(limiter.check('ip')).toBe(true);

      // 4th request at t=800ms should be blocked
      expect(limiter.check('ip')).toBe(false);

      // At t=1100ms, the first request (t=0) has expired
      // so we should have room for one more
      Date.now = () => baseTime + 1100;
      expect(limiter.check('ip')).toBe(true);

      // But a second additional request should be blocked (2 from 400ms and 800ms still in window)
      // Actually: at t=1100, requests at t=400 and t=800 are within window, plus the one we just added
      expect(limiter.check('ip')).toBe(false);
    } finally {
      Date.now = originalNow;
    }
  });
});
