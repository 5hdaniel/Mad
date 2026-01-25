/**
 * Unit tests for API rate limiting utilities.
 *
 * Tests exponential backoff, Retry-After parsing, throttling, and retry logic.
 * Created as part of BACKLOG-497: Email API Rate Limiting
 */

import {
  parseRetryAfter,
  isRateLimitError,
  extractRetryAfter,
  calculateBackoffDelay,
  isRetryableError,
  withRetry,
  createApiThrottler,
  apiThrottlers,
} from "../apiRateLimit";

// Mock logService - use factory function to avoid hoisting issues
jest.mock("../../services/logService", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("apiRateLimit utilities", () => {
  describe("parseRetryAfter", () => {
    it("returns null for null/undefined input", () => {
      expect(parseRetryAfter(null)).toBeNull();
      expect(parseRetryAfter(undefined)).toBeNull();
    });

    it("parses numeric seconds", () => {
      expect(parseRetryAfter("120")).toBe(120000);
      expect(parseRetryAfter("0")).toBe(0);
      expect(parseRetryAfter("60")).toBe(60000);
    });

    it("returns null for negative numbers", () => {
      expect(parseRetryAfter("-1")).toBeNull();
    });

    it("returns null for invalid strings", () => {
      expect(parseRetryAfter("invalid")).toBeNull();
      expect(parseRetryAfter("")).toBeNull();
    });

    it("parses HTTP-date format", () => {
      // Set a fixed "now" for testing
      const now = new Date("2024-01-15T12:00:00Z").getTime();
      jest.spyOn(Date, "now").mockReturnValue(now);

      const futureDate = "Mon, 15 Jan 2024 12:01:00 GMT";
      const result = parseRetryAfter(futureDate);

      // Should be approximately 60 seconds (60000ms)
      expect(result).toBeGreaterThan(59000);
      expect(result).toBeLessThan(61000);

      jest.restoreAllMocks();
    });

    it("returns 0 for past HTTP-date", () => {
      const now = new Date("2024-01-15T12:00:00Z").getTime();
      jest.spyOn(Date, "now").mockReturnValue(now);

      const pastDate = "Mon, 15 Jan 2024 11:00:00 GMT";
      expect(parseRetryAfter(pastDate)).toBe(0);

      jest.restoreAllMocks();
    });
  });

  describe("isRateLimitError", () => {
    it("returns false for null/undefined", () => {
      expect(isRateLimitError(null)).toBe(false);
      expect(isRateLimitError(undefined)).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(isRateLimitError("error")).toBe(false);
      expect(isRateLimitError(429)).toBe(false);
    });

    it("detects 429 in response.status", () => {
      expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
      expect(isRateLimitError({ response: { status: 500 } })).toBe(false);
    });

    it("detects 429 in status property", () => {
      expect(isRateLimitError({ status: 429 })).toBe(true);
      expect(isRateLimitError({ status: 400 })).toBe(false);
    });

    it("detects 429 in code property", () => {
      expect(isRateLimitError({ code: 429 })).toBe(true);
      expect(isRateLimitError({ code: "429" })).toBe(true);
      expect(isRateLimitError({ code: "500" })).toBe(false);
    });

    it("detects rate limit in error message", () => {
      expect(isRateLimitError({ message: "Rate limit exceeded" })).toBe(true);
      expect(isRateLimitError({ message: "Too many requests" })).toBe(true);
      expect(isRateLimitError({ message: "Quota exceeded" })).toBe(true);
      expect(isRateLimitError({ message: "Normal error" })).toBe(false);
    });
  });

  describe("extractRetryAfter", () => {
    it("returns null for non-objects", () => {
      expect(extractRetryAfter(null)).toBeNull();
      expect(extractRetryAfter("error")).toBeNull();
    });

    it("extracts from Fetch API style headers", () => {
      const error = {
        response: {
          headers: {
            get: (name: string) => (name === "retry-after" ? "60" : null),
          },
        },
      };
      expect(extractRetryAfter(error)).toBe(60000);
    });

    it("extracts from axios style headers", () => {
      const error = {
        response: {
          headers: {
            "retry-after": "30",
          },
        },
      };
      expect(extractRetryAfter(error)).toBe(30000);
    });

    it("returns null when no Retry-After header", () => {
      const error = {
        response: {
          headers: {},
        },
      };
      expect(extractRetryAfter(error)).toBeNull();
    });
  });

  describe("calculateBackoffDelay", () => {
    it("calculates exponential delays", () => {
      // Seed Math.random for predictable jitter (mock returns 0)
      jest.spyOn(Math, "random").mockReturnValue(0);

      expect(calculateBackoffDelay(0, 1000, 30000)).toBe(1000); // 1000 * 2^0 = 1000
      expect(calculateBackoffDelay(1, 1000, 30000)).toBe(2000); // 1000 * 2^1 = 2000
      expect(calculateBackoffDelay(2, 1000, 30000)).toBe(4000); // 1000 * 2^2 = 4000
      expect(calculateBackoffDelay(3, 1000, 30000)).toBe(8000); // 1000 * 2^3 = 8000

      jest.restoreAllMocks();
    });

    it("caps delay at maxDelay", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);

      // 1000 * 2^5 = 32000, but max is 30000
      expect(calculateBackoffDelay(5, 1000, 30000)).toBe(30000);

      // 1000 * 2^10 = 1024000, but max is 30000
      expect(calculateBackoffDelay(10, 1000, 30000)).toBe(30000);

      jest.restoreAllMocks();
    });

    it("adds jitter (0-25% of delay)", () => {
      jest.spyOn(Math, "random").mockReturnValue(1); // Max jitter

      // Base delay 1000, with max jitter (25%) = 1250
      const delay = calculateBackoffDelay(0, 1000, 30000);
      expect(delay).toBe(1250);

      jest.restoreAllMocks();
    });
  });

  describe("isRetryableError", () => {
    it("returns false for non-objects", () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError("error")).toBe(false);
    });

    it("returns true for rate limit errors", () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
    });

    it("returns true for 5xx errors", () => {
      expect(isRetryableError({ response: { status: 500 } })).toBe(true);
      expect(isRetryableError({ response: { status: 502 } })).toBe(true);
      expect(isRetryableError({ response: { status: 503 } })).toBe(true);
      expect(isRetryableError({ response: { status: 504 } })).toBe(true);
    });

    it("returns false for 4xx errors (except 429)", () => {
      expect(isRetryableError({ response: { status: 400 } })).toBe(false);
      expect(isRetryableError({ response: { status: 401 } })).toBe(false);
      expect(isRetryableError({ response: { status: 404 } })).toBe(false);
    });

    it("returns true for network errors", () => {
      expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
      expect(isRetryableError({ code: "ETIMEDOUT" })).toBe(true);
      expect(isRetryableError({ code: "ECONNREFUSED" })).toBe(true);
      expect(isRetryableError({ code: "ENETUNREACH" })).toBe(true);
    });
  });

  describe("withRetry", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns result on first success", async () => {
      const fn = jest.fn().mockResolvedValue("success");

      const promise = withRetry(fn);
      jest.runAllTimers();
      const result = await promise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable errors", async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue("success");

      const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100 });

      // First call fails immediately
      await jest.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for first backoff
      await jest.advanceTimersByTimeAsync(150);
      expect(fn).toHaveBeenCalledTimes(2);

      // Wait for second backoff
      await jest.advanceTimersByTimeAsync(300);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe("success");
    });

    it("throws immediately for non-retryable errors", async () => {
      const error = { status: 404, message: "Not found" };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toEqual(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws after maxRetries exhausted", async () => {
      const error = { status: 500 };
      const fn = jest.fn().mockRejectedValue(error);

      let caughtError: unknown;
      const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100 }).catch(
        (e) => {
          caughtError = e;
        }
      );

      // Need to let timers run incrementally for each retry
      // Run all timers to completion
      await jest.runAllTimersAsync();
      await promise;

      expect(caughtError).toEqual(error);
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("respects Retry-After header on 429", async () => {
      const rateLimitError = {
        status: 429,
        response: {
          headers: {
            "retry-after": "5", // 5 seconds
          },
        },
      };
      const fn = jest
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue("success");

      const promise = withRetry(fn, { baseDelay: 100 });

      // First call fails immediately
      await jest.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Wait for Retry-After (5000ms)
      await jest.advanceTimersByTimeAsync(5000);
      expect(fn).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
    });
  });

  describe("createApiThrottler", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("allows immediate first request", async () => {
      const throttler = createApiThrottler(100);

      const start = Date.now();
      await throttler.throttle();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10); // Should be immediate
    });

    it("delays subsequent requests", async () => {
      const throttler = createApiThrottler(100);

      await throttler.throttle();

      // Advance time by 50ms (less than minDelay)
      jest.advanceTimersByTime(50);

      // Next request should wait ~50ms
      const waitTime = throttler.getWaitTime();
      expect(waitTime).toBeGreaterThan(40);
      expect(waitTime).toBeLessThanOrEqual(50);
    });

    it("allows request after minDelay elapsed", async () => {
      const throttler = createApiThrottler(100);

      await throttler.throttle();
      jest.advanceTimersByTime(100);

      const waitTime = throttler.getWaitTime();
      expect(waitTime).toBe(0);
    });

    it("reset clears state", async () => {
      const throttler = createApiThrottler(100);

      await throttler.throttle();

      throttler.reset();

      // Should allow immediate request after reset
      const waitTime = throttler.getWaitTime();
      expect(waitTime).toBe(0);
    });
  });

  describe("apiThrottlers", () => {
    it("has microsoftGraph throttler", () => {
      expect(apiThrottlers.microsoftGraph).toBeDefined();
      expect(typeof apiThrottlers.microsoftGraph.throttle).toBe("function");
    });

    it("has gmail throttler", () => {
      expect(apiThrottlers.gmail).toBeDefined();
      expect(typeof apiThrottlers.gmail.throttle).toBe("function");
    });
  });
});
