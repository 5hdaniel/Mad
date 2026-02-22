/**
 * Unit tests for Network Resilience Service (TASK-2049)
 *
 * Tests:
 * - retryOnNetwork: exponential backoff retry for network errors
 * - NetworkResilienceService: partial sync tracking and auto-retry
 * - calculateNetworkBackoff: delay calculation
 */

import {
  retryOnNetwork,
  NetworkResilienceService,
  calculateNetworkBackoff,
  DEFAULT_NETWORK_RETRY_CONFIG,
} from "../networkResilience";

// Mock logService to avoid console output in tests
jest.mock("../logService", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("calculateNetworkBackoff", () => {
  it("should return base delay for first attempt", () => {
    expect(calculateNetworkBackoff(0, 1000, 30000)).toBe(1000);
  });

  it("should double delay for each attempt", () => {
    expect(calculateNetworkBackoff(0, 1000, 30000)).toBe(1000);
    expect(calculateNetworkBackoff(1, 1000, 30000)).toBe(2000);
    expect(calculateNetworkBackoff(2, 1000, 30000)).toBe(4000);
    expect(calculateNetworkBackoff(3, 1000, 30000)).toBe(8000);
    expect(calculateNetworkBackoff(4, 1000, 30000)).toBe(16000);
  });

  it("should cap at maxDelay", () => {
    expect(calculateNetworkBackoff(5, 1000, 30000)).toBe(30000);
    expect(calculateNetworkBackoff(10, 1000, 30000)).toBe(30000);
  });

  it("should handle custom base and max delays", () => {
    expect(calculateNetworkBackoff(0, 500, 5000)).toBe(500);
    expect(calculateNetworkBackoff(3, 500, 5000)).toBe(4000);
    expect(calculateNetworkBackoff(4, 500, 5000)).toBe(5000); // Capped
  });
});

describe("retryOnNetwork", () => {
  // Speed up tests by using minimal delays
  const fastConfig = {
    maxRetries: 3,
    baseDelayMs: 1, // 1ms delays for fast tests
    maxDelayMs: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return result on first successful attempt", async () => {
    const operation = jest.fn().mockResolvedValue("success");

    const result = await retryOnNetwork(operation, fastConfig);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should retry on network errors", async () => {
    const networkError = Object.assign(new Error("Network error"), {
      code: "ECONNRESET",
    });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("success");

    const result = await retryOnNetwork(operation, fastConfig);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("should NOT retry on non-network errors", async () => {
    const appError = new Error("Invalid token");
    const operation = jest.fn().mockRejectedValue(appError);

    await expect(retryOnNetwork(operation, fastConfig)).rejects.toThrow(
      "Invalid token"
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should throw after max retries exhausted", async () => {
    const networkError = Object.assign(new Error("ECONNRESET"), {
      code: "ECONNRESET",
    });
    const operation = jest.fn().mockRejectedValue(networkError);

    await expect(retryOnNetwork(operation, fastConfig)).rejects.toThrow(
      "ECONNRESET"
    );
    // 1 initial + 3 retries = 4 calls
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it("should use default config when none provided", async () => {
    const networkError = Object.assign(new Error("fetch failed"), {
      code: "ENOTFOUND",
    });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("ok");

    // Use a very fast delay override for the default config test
    const result = await retryOnNetwork(operation, {
      ...DEFAULT_NETWORK_RETRY_CONFIG,
      baseDelayMs: 1,
      maxDelayMs: 2,
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should handle non-Error thrown values", async () => {
    const operation = jest.fn().mockRejectedValue("string error");

    await expect(retryOnNetwork(operation, fastConfig)).rejects.toThrow(
      "string error"
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should pass through the original error type after retries", async () => {
    const networkError = Object.assign(new Error("DNS resolution failed"), {
      code: "ENOTFOUND",
    });
    const operation = jest.fn().mockRejectedValue(networkError);

    try {
      await retryOnNetwork(operation, fastConfig);
      fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("DNS resolution failed");
    }
  });
});

describe("NetworkResilienceService", () => {
  let service: NetworkResilienceService;

  beforeEach(() => {
    service = new NetworkResilienceService();
    jest.clearAllMocks();
  });

  describe("recordPartialSync", () => {
    it("should record a partial sync for later retry", () => {
      service.recordPartialSync("user-1", "gmail", 25);

      expect(service.hasPendingRetries()).toBe(true);
      const retries = service.getPendingRetries();
      expect(retries).toHaveLength(1);
      expect(retries[0]).toMatchObject({
        userId: "user-1",
        provider: "gmail",
        savedCount: 25,
        retryCount: 0,
      });
    });

    it("should increment retry count when same user/provider recorded again", () => {
      service.recordPartialSync("user-1", "gmail", 25);
      service.recordPartialSync("user-1", "gmail", 30);

      const retries = service.getPendingRetries();
      expect(retries).toHaveLength(1);
      expect(retries[0].retryCount).toBe(1);
      expect(retries[0].savedCount).toBe(30); // Updated count
    });

    it("should track different providers separately", () => {
      service.recordPartialSync("user-1", "gmail", 10);
      service.recordPartialSync("user-1", "outlook", 20);

      expect(service.getPendingRetries()).toHaveLength(2);
    });

    it("should track different users separately", () => {
      service.recordPartialSync("user-1", "gmail", 10);
      service.recordPartialSync("user-2", "gmail", 20);

      expect(service.getPendingRetries()).toHaveLength(2);
    });
  });

  describe("hasPendingRetries", () => {
    it("should return false when no retries pending", () => {
      expect(service.hasPendingRetries()).toBe(false);
    });

    it("should return true when retries are pending", () => {
      service.recordPartialSync("user-1", "gmail", 10);
      expect(service.hasPendingRetries()).toBe(true);
    });
  });

  describe("clearPendingRetries", () => {
    it("should clear all pending retries", () => {
      service.recordPartialSync("user-1", "gmail", 10);
      service.recordPartialSync("user-2", "outlook", 20);

      service.clearPendingRetries();

      expect(service.hasPendingRetries()).toBe(false);
      expect(service.getPendingRetries()).toHaveLength(0);
    });
  });

  describe("retryPendingSync", () => {
    it("should do nothing when no callback registered", async () => {
      service.recordPartialSync("user-1", "gmail", 10);
      await service.retryPendingSync();
      // Should not throw
      expect(service.hasPendingRetries()).toBe(true);
    });

    it("should do nothing when no retries pending", async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      service.setRetryCallback(callback);

      await service.retryPendingSync();

      expect(callback).not.toHaveBeenCalled();
    });

    it("should call retry callback for each pending sync", async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      service.setRetryCallback(callback);

      service.recordPartialSync("user-1", "gmail", 10);
      service.recordPartialSync("user-2", "outlook", 20);

      await service.retryPendingSync();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith("user-1", "gmail");
      expect(callback).toHaveBeenCalledWith("user-2", "outlook");
    });

    it("should remove successful retries from the queue", async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      service.setRetryCallback(callback);

      service.recordPartialSync("user-1", "gmail", 10);

      await service.retryPendingSync();

      expect(service.hasPendingRetries()).toBe(false);
    });

    it("should keep failed retries in the queue (network still down)", async () => {
      const networkError = Object.assign(new Error("Still offline"), {
        code: "ENETUNREACH",
      });
      const callback = jest.fn().mockRejectedValue(networkError);
      service.setRetryCallback(callback);

      service.recordPartialSync("user-1", "gmail", 10);

      await service.retryPendingSync();

      expect(service.hasPendingRetries()).toBe(true);
      const retries = service.getPendingRetries();
      expect(retries[0].retryCount).toBe(1);
    });

    it("should remove retries that fail with non-network errors", async () => {
      const appError = new Error("Token expired");
      const callback = jest.fn().mockRejectedValue(appError);
      service.setRetryCallback(callback);

      service.recordPartialSync("user-1", "gmail", 10);

      await service.retryPendingSync();

      expect(service.hasPendingRetries()).toBe(false);
    });

    it("should skip retries that exceeded max retry count", async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      service.setRetryCallback(callback);

      service.recordPartialSync("user-1", "gmail", 10);
      // Simulate multiple failures by manually incrementing retry count
      const retries = service.getPendingRetries();
      // Record again 5 times to hit the max
      for (let i = 0; i < DEFAULT_NETWORK_RETRY_CONFIG.maxRetries; i++) {
        service.recordPartialSync("user-1", "gmail", 10);
      }

      await service.retryPendingSync();

      // Should have been removed from queue without calling callback
      expect(service.hasPendingRetries()).toBe(false);
    });

    it("should not allow concurrent retries", async () => {
      let resolveFirst: () => void;
      const firstCallPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      const callback = jest.fn().mockImplementation(() => firstCallPromise);
      service.setRetryCallback(callback);

      service.recordPartialSync("user-1", "gmail", 10);

      // Start first retry
      const firstRetry = service.retryPendingSync();

      // Try to start second retry while first is running
      const secondRetry = service.retryPendingSync();

      // Resolve first call
      resolveFirst!();
      await firstRetry;
      await secondRetry;

      // Should only have been called once (second call was blocked)
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
