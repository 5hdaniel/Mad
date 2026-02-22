/**
 * @jest-environment node
 */

/**
 * Unit tests for withRetry utility
 * TASK-2044: Tests retry logic, error classification, and backoff behavior
 */

import { jest } from "@jest/globals";
import {
  withRetry,
  isRetryableError,
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from "../withRetry";

describe("withRetry", () => {
  // Use very short delays for fast tests with real timers
  const fastConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1,
    maxDelayMs: 5,
    retryableErrors: ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR", "UNKNOWN_ERROR"],
  };

  describe("successful operations", () => {
    it("should succeed on the first attempt without retrying", async () => {
      const operation = jest.fn<() => Promise<string>>().mockResolvedValue("success");
      const onRetry = jest.fn();

      const result = await withRetry(operation, fastConfig, onRetry);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it("should succeed on the second attempt after a retryable error", async () => {
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("TIMEOUT"))
        .mockResolvedValue("success");
      const onRetry = jest.fn();

      const result = await withRetry(operation, fastConfig, onRetry);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it("should succeed on the third attempt after two retryable errors", async () => {
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("NETWORK_ERROR"))
        .mockRejectedValueOnce(new Error("SERVER_ERROR"))
        .mockResolvedValue("success");
      const onRetry = jest.fn();

      const result = await withRetry(operation, fastConfig, onRetry);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it("should succeed on the last possible attempt (attempt 4 with maxRetries 3)", async () => {
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("TIMEOUT"))
        .mockRejectedValueOnce(new Error("TIMEOUT"))
        .mockRejectedValueOnce(new Error("TIMEOUT"))
        .mockResolvedValue("success");
      const onRetry = jest.fn();

      const result = await withRetry(operation, fastConfig, onRetry);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(4);
      expect(onRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe("exhausted retries", () => {
    it("should throw the final error after all retries are exhausted", async () => {
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error("TIMEOUT: connection timed out"));
      const onRetry = jest.fn();

      await expect(
        withRetry(operation, fastConfig, onRetry)
      ).rejects.toThrow("TIMEOUT: connection timed out");

      // 1 initial + 3 retries = 4 total calls
      expect(operation).toHaveBeenCalledTimes(4);
      expect(onRetry).toHaveBeenCalledTimes(3);
    });

    it("should call onRetry with correct attempt numbers", async () => {
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error("NETWORK_ERROR"));
      const onRetry = jest.fn();

      await expect(
        withRetry(operation, fastConfig, onRetry)
      ).rejects.toThrow("NETWORK_ERROR");

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
      expect(onRetry).toHaveBeenCalledWith(3, expect.any(Error));
    });
  });

  describe("non-retryable errors", () => {
    it("should not retry on non-retryable errors (401 auth failure)", async () => {
      const authError = Object.assign(new Error("Invalid credentials"), {
        status: 401,
        code: "AUTH_FAILED",
      });
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(authError);
      const onRetry = jest.fn();

      await expect(
        withRetry(operation, fastConfig, onRetry)
      ).rejects.toThrow("Invalid credentials");

      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it("should not retry on 403 permission denied", async () => {
      const forbiddenError = Object.assign(new Error("Permission denied"), {
        status: 403,
      });
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(forbiddenError);
      const onRetry = jest.fn();

      await expect(
        withRetry(operation, fastConfig, onRetry)
      ).rejects.toThrow("Permission denied");

      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it("should not retry on MISSING_TOKENS deep link error", async () => {
      const error = Object.assign(new Error("Missing tokens"), {
        code: "MISSING_TOKENS",
      });
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(error);

      await expect(
        withRetry(operation, fastConfig)
      ).rejects.toThrow("Missing tokens");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should not retry on INVALID_TOKENS deep link error", async () => {
      const error = Object.assign(new Error("Invalid tokens"), {
        code: "INVALID_TOKENS",
      });
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(error);

      await expect(
        withRetry(operation, fastConfig)
      ).rejects.toThrow("Invalid tokens");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should immediately throw non-retryable error even with retries remaining", async () => {
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("TIMEOUT")) // retryable
        .mockRejectedValueOnce(
          Object.assign(new Error("Access denied"), { status: 403 })
        ); // non-retryable
      const onRetry = jest.fn();

      await expect(
        withRetry(operation, fastConfig, onRetry)
      ).rejects.toThrow("Access denied");

      expect(operation).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1); // Only called for the first (retryable) error
    });
  });

  describe("abort signal", () => {
    it("should abort immediately if signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const operation = jest.fn<() => Promise<string>>().mockResolvedValue("success");

      await expect(
        withRetry(operation, fastConfig, undefined, controller.signal)
      ).rejects.toThrow("Retry aborted");

      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe("default config", () => {
    it("should use default config when none provided", async () => {
      const operation = jest.fn<() => Promise<string>>().mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe("error coercion", () => {
    it("should coerce non-Error throws into Error objects", async () => {
      const operation = jest.fn<() => Promise<string>>().mockRejectedValue("string error");

      await expect(
        withRetry(operation, fastConfig)
      ).rejects.toThrow("string error");
    });

    it("should handle number throws", async () => {
      const operation = jest.fn<() => Promise<string>>().mockRejectedValue(42);

      await expect(
        withRetry(operation, fastConfig)
      ).rejects.toThrow("42");
    });
  });

  describe("maxRetries = 0", () => {
    it("should not retry when maxRetries is 0", async () => {
      const zeroConfig: RetryConfig = {
        ...fastConfig,
        maxRetries: 0,
      };
      const operation = jest
        .fn<() => Promise<string>>()
        .mockRejectedValue(new Error("TIMEOUT"));

      await expect(
        withRetry(operation, zeroConfig)
      ).rejects.toThrow("TIMEOUT");

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});

describe("isRetryableError", () => {
  const retryableErrors = DEFAULT_RETRY_CONFIG.retryableErrors;

  it("should return true for errors with retryable error codes", () => {
    const error = { code: "TIMEOUT", message: "Request timed out" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for errors with retryable errorCode property", () => {
    const error = { errorCode: "NETWORK_ERROR", message: "Network failed" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for errors with retryable message substring", () => {
    const error = new Error("Connection timeout occurred");
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for UNKNOWN_ERROR code", () => {
    const error = { code: "UNKNOWN_ERROR", message: "Something went wrong" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for HTTP 408 (timeout)", () => {
    const error = { status: 408, message: "Request Timeout" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for HTTP 429 (rate limited)", () => {
    const error = { status: 429, message: "Too Many Requests" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for HTTP 500 (server error)", () => {
    const error = { status: 500, message: "Internal Server Error" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for HTTP 502 (bad gateway)", () => {
    const error = { status: 502, message: "Bad Gateway" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return true for HTTP 503 (service unavailable)", () => {
    const error = { status: 503, message: "Service Unavailable" };
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });

  it("should return false for HTTP 401 (unauthorized)", () => {
    const error = { status: 401, message: "Unauthorized" };
    expect(isRetryableError(error, retryableErrors)).toBe(false);
  });

  it("should return false for HTTP 403 (forbidden)", () => {
    const error = { status: 403, message: "Forbidden" };
    expect(isRetryableError(error, retryableErrors)).toBe(false);
  });

  it("should return false for non-retryable error codes", () => {
    const error = { code: "AUTH_FAILED", message: "Authentication failed" };
    expect(isRetryableError(error, retryableErrors)).toBe(false);
  });

  it("should return false for null/undefined errors", () => {
    expect(isRetryableError(null, retryableErrors)).toBe(false);
    expect(isRetryableError(undefined, retryableErrors)).toBe(false);
  });

  it("should handle string errors", () => {
    expect(isRetryableError("TIMEOUT occurred", retryableErrors)).toBe(true);
    expect(isRetryableError("auth failed", retryableErrors)).toBe(false);
  });

  it("should use default retryable errors when not provided", () => {
    const error = { code: "TIMEOUT" };
    expect(isRetryableError(error)).toBe(true);
  });

  it("should be case-insensitive for message matching", () => {
    const error = new Error("network_error: connection refused");
    expect(isRetryableError(error, retryableErrors)).toBe(true);
  });
});

describe("calculateBackoffDelay", () => {
  it("should return base delay for first attempt", () => {
    // With jitter, delay should be between baseDelay and baseDelay * 1.2
    const delay = calculateBackoffDelay(1, 1000, 10000);
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1200);
  });

  it("should double delay for each attempt (exponential)", () => {
    // Mock Math.random to eliminate jitter for predictable testing
    const originalRandom = Math.random;
    Math.random = () => 0; // No jitter

    expect(calculateBackoffDelay(1, 1000, 100000)).toBe(1000);
    expect(calculateBackoffDelay(2, 1000, 100000)).toBe(2000);
    expect(calculateBackoffDelay(3, 1000, 100000)).toBe(4000);
    expect(calculateBackoffDelay(4, 1000, 100000)).toBe(8000);

    Math.random = originalRandom;
  });

  it("should cap delay at maxDelayMs", () => {
    const delay = calculateBackoffDelay(10, 1000, 5000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it("should add jitter (delay is not always the same)", () => {
    // Run multiple times and check that we get different values
    const delays = new Set<number>();
    for (let i = 0; i < 20; i++) {
      delays.add(calculateBackoffDelay(2, 1000, 100000));
    }
    // With random jitter, we should get multiple different values
    // (statistically certain with 20 iterations)
    expect(delays.size).toBeGreaterThan(1);
  });

  it("should handle zero base delay", () => {
    const delay = calculateBackoffDelay(1, 0, 10000);
    expect(delay).toBe(0);
  });
});

describe("DEFAULT_RETRY_CONFIG", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
    expect(DEFAULT_RETRY_CONFIG.retryableErrors).toContain("TIMEOUT");
    expect(DEFAULT_RETRY_CONFIG.retryableErrors).toContain("NETWORK_ERROR");
    expect(DEFAULT_RETRY_CONFIG.retryableErrors).toContain("SERVER_ERROR");
    expect(DEFAULT_RETRY_CONFIG.retryableErrors).toContain("UNKNOWN_ERROR");
  });
});
