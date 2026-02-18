/**
 * waitForApi Utility Tests
 *
 * Tests for the preload bridge readiness polling utility.
 *
 * @module appCore/state/machine/utils/waitForApi.test
 */

import { waitForApi } from "./waitForApi";

describe("waitForApi", () => {
  const originalApi = window.api;

  afterEach(() => {
    // Restore original window.api
    if (originalApi) {
      (window as unknown as { api: typeof originalApi }).api = originalApi;
    } else {
      delete (window as unknown as { api?: unknown }).api;
    }
  });

  it("resolves immediately when window.api.system is already available", async () => {
    // Setup: window.api is available
    (window as unknown as { api: { system: object } }).api = {
      system: { hasEncryptionKeyStore: jest.fn() },
    };

    const start = Date.now();
    await waitForApi();
    const elapsed = Date.now() - start;

    // Should resolve nearly instantly (fast path)
    expect(elapsed).toBeLessThan(50);
  });

  it("waits and resolves when window.api becomes available after a delay", async () => {
    // Setup: window.api is initially undefined
    delete (window as unknown as { api?: unknown }).api;

    // Make window.api appear after 100ms
    setTimeout(() => {
      (window as unknown as { api: { system: object } }).api = {
        system: { hasEncryptionKeyStore: jest.fn() },
      };
    }, 100);

    await waitForApi(2000);
    // If we get here without throwing, the test passes
    expect(window.api?.system).toBeDefined();
  });

  it("rejects with timeout error when window.api never becomes available", async () => {
    // Setup: window.api is undefined and will stay undefined
    delete (window as unknown as { api?: unknown }).api;

    await expect(waitForApi(200)).rejects.toThrow(
      "Electron preload bridge (window.api) not available after 200ms"
    );
  });

  it("resolves when window.api exists but system is added later", async () => {
    // Setup: window.api exists but system is not yet defined
    (window as unknown as { api: Record<string, unknown> }).api = {};

    // Add system namespace after 80ms
    setTimeout(() => {
      (window.api as unknown as Record<string, unknown>).system = {
        hasEncryptionKeyStore: jest.fn(),
      };
    }, 80);

    await waitForApi(2000);
    expect(window.api?.system).toBeDefined();
  });

  it("uses default timeout of 5000ms", async () => {
    delete (window as unknown as { api?: unknown }).api;

    const start = Date.now();
    await expect(waitForApi()).rejects.toThrow("5000ms");
    const elapsed = Date.now() - start;

    // Should have waited approximately 5 seconds
    expect(elapsed).toBeGreaterThanOrEqual(4500);
    expect(elapsed).toBeLessThan(7000);
  }, 10000); // Extend Jest timeout for this test
});
