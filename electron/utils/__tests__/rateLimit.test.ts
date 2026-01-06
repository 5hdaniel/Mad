/**
 * Unit tests for rate limiting utilities.
 *
 * Tests throttle, debounce, and IPCRateLimiter functionality.
 * Created as part of TASK-620: IPC Rate Limiting for Expensive Handlers
 */

import {
  throttle,
  debounce,
  createIPCRateLimiter,
  rateLimiters,
} from "../rateLimit";

// Mock electron-log
jest.mock("electron-log", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("rateLimit utilities", () => {
  describe("throttle", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("allows first call immediately", () => {
      const fn = jest.fn().mockReturnValue("result");
      const throttled = throttle(fn, 1000);

      const result = throttled("arg1", "arg2");

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("result");
    });

    it("blocks calls within cooldown period and returns last result", () => {
      const fn = jest.fn().mockReturnValue("original");
      const throttled = throttle(fn, 1000);

      // First call
      const result1 = throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(result1).toBe("original");

      // Second call within cooldown
      jest.advanceTimersByTime(500);
      const result2 = throttled();
      expect(fn).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toBe("original"); // Returns cached result
    });

    it("allows call after cooldown expires", () => {
      const fn = jest.fn();
      fn.mockReturnValueOnce("first").mockReturnValueOnce("second");
      const throttled = throttle(fn, 1000);

      // First call
      const result1 = throttled();
      expect(result1).toBe("first");

      // Wait for cooldown to expire
      jest.advanceTimersByTime(1001);

      // Second call should execute
      const result2 = throttled();
      expect(fn).toHaveBeenCalledTimes(2);
      expect(result2).toBe("second");
    });

    it("handles zero delay (no throttling)", () => {
      const fn = jest.fn().mockReturnValue("result");
      const throttled = throttle(fn, 0);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("handles rapid successive calls", () => {
      const fn = jest.fn().mockReturnValue("result");
      const throttled = throttle(fn, 100);

      // Rapid calls
      for (let i = 0; i < 10; i++) {
        throttled();
      }

      // Only first call should execute
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("preserves function return type", () => {
      const fn = jest.fn().mockReturnValue({ data: "value", count: 42 });
      const throttled = throttle(fn, 1000);

      const result = throttled();
      expect(result).toEqual({ data: "value", count: 42 });
    });
  });

  describe("debounce", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("delays execution until quiet period", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 1000);

      debounced("arg");
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1001);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("arg");
    });

    it("resets timer on subsequent calls", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 1000);

      debounced("first");
      jest.advanceTimersByTime(500);

      debounced("second");
      jest.advanceTimersByTime(500);

      // Should not have executed yet (timer was reset)
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(501);
      // Now it should execute with last args
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("second");
    });

    it("handles zero delay (immediate execution)", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 0);

      debounced();
      jest.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("handles rapid successive calls", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      // Rapid calls
      for (let i = 0; i < 10; i++) {
        debounced(i);
        jest.advanceTimersByTime(50); // Within debounce period
      }

      // Should not have executed yet
      expect(fn).not.toHaveBeenCalled();

      // Wait for final debounce to complete
      jest.advanceTimersByTime(101);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(9); // Last call's argument
    });
  });

  describe("createIPCRateLimiter", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("allows first execution for a key", () => {
      const limiter = createIPCRateLimiter(1000);

      const result = limiter.canExecute("test:channel", "key1");

      expect(result.allowed).toBe(true);
      expect(result.remainingMs).toBeUndefined();
    });

    it("blocks execution within cooldown", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      jest.advanceTimersByTime(500);

      const result = limiter.canExecute("test:channel", "key1");

      expect(result.allowed).toBe(false);
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.remainingMs).toBeLessThanOrEqual(500);
    });

    it("allows execution after cooldown", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      jest.advanceTimersByTime(1001);

      const result = limiter.canExecute("test:channel", "key1");

      expect(result.allowed).toBe(true);
    });

    it("tracks different keys independently", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      jest.advanceTimersByTime(500);

      // key1 should be blocked
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(false);

      // key2 should be allowed (first call)
      expect(limiter.canExecute("test:channel", "key2").allowed).toBe(true);
    });

    it("returns correct remaining cooldown", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      jest.advanceTimersByTime(300);

      const remaining = limiter.getRemainingCooldown("key1");

      expect(remaining).toBeGreaterThan(600);
      expect(remaining).toBeLessThanOrEqual(700);
    });

    it("returns 0 remaining cooldown for unknown key", () => {
      const limiter = createIPCRateLimiter(1000);

      const remaining = limiter.getRemainingCooldown("unknown");

      expect(remaining).toBe(0);
    });

    it("returns 0 remaining cooldown after expiry", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      jest.advanceTimersByTime(1001);

      const remaining = limiter.getRemainingCooldown("key1");

      expect(remaining).toBe(0);
    });

    it("clears specific key", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      limiter.canExecute("test:channel", "key2");

      // Clear only key1
      limiter.clearKey("key1");

      // key1 should be allowed again
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(true);

      // key2 should still be blocked
      expect(limiter.canExecute("test:channel", "key2").allowed).toBe(false);
    });

    it("clears all keys", () => {
      const limiter = createIPCRateLimiter(1000);

      limiter.canExecute("test:channel", "key1");
      limiter.canExecute("test:channel", "key2");
      limiter.canExecute("test:channel", "key3");

      limiter.clearAll();

      // All keys should be allowed
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(true);
      expect(limiter.canExecute("test:channel", "key2").allowed).toBe(true);
      expect(limiter.canExecute("test:channel", "key3").allowed).toBe(true);
    });

    it("handles very short cooldowns", () => {
      const limiter = createIPCRateLimiter(10);

      limiter.canExecute("test:channel", "key1");
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(false);

      jest.advanceTimersByTime(11);
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(true);
    });

    it("handles very long cooldowns", () => {
      const limiter = createIPCRateLimiter(60_000); // 1 minute

      limiter.canExecute("test:channel", "key1");

      jest.advanceTimersByTime(30_000); // 30 seconds
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(false);

      jest.advanceTimersByTime(30_001); // Just past 1 minute total
      expect(limiter.canExecute("test:channel", "key1").allowed).toBe(true);
    });
  });

  describe("pre-configured rateLimiters", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Clear all limiters before each test
      rateLimiters.backup.clearAll();
      rateLimiters.sync.clearAll();
      rateLimiters.scan.clearAll();
      rateLimiters.export.clearAll();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("backup limiter has 30 second cooldown", () => {
      rateLimiters.backup.canExecute("backup:start", "device1");

      // Should be blocked at 29 seconds
      jest.advanceTimersByTime(29_000);
      expect(rateLimiters.backup.canExecute("backup:start", "device1").allowed).toBe(false);

      // Should be allowed at 30+ seconds
      jest.advanceTimersByTime(1_001);
      expect(rateLimiters.backup.canExecute("backup:start", "device1").allowed).toBe(true);
    });

    it("sync limiter has 10 second cooldown", () => {
      rateLimiters.sync.canExecute("sync:start", "device1");

      jest.advanceTimersByTime(9_000);
      expect(rateLimiters.sync.canExecute("sync:start", "device1").allowed).toBe(false);

      jest.advanceTimersByTime(1_001);
      expect(rateLimiters.sync.canExecute("sync:start", "device1").allowed).toBe(true);
    });

    it("scan limiter has 5 second cooldown", () => {
      rateLimiters.scan.canExecute("transactions:scan", "user1");

      jest.advanceTimersByTime(4_000);
      expect(rateLimiters.scan.canExecute("transactions:scan", "user1").allowed).toBe(false);

      jest.advanceTimersByTime(1_001);
      expect(rateLimiters.scan.canExecute("transactions:scan", "user1").allowed).toBe(true);
    });

    it("export limiter has 10 second cooldown", () => {
      rateLimiters.export.canExecute("transactions:export", "tx1");

      jest.advanceTimersByTime(9_000);
      expect(rateLimiters.export.canExecute("transactions:export", "tx1").allowed).toBe(false);

      jest.advanceTimersByTime(1_001);
      expect(rateLimiters.export.canExecute("transactions:export", "tx1").allowed).toBe(true);
    });

    it("different limiters are independent", () => {
      // Use backup limiter
      rateLimiters.backup.canExecute("backup:start", "device1");

      // Sync limiter should still be available for same key
      expect(rateLimiters.sync.canExecute("sync:start", "device1").allowed).toBe(true);
    });
  });
});
