/**
 * waitForApi Utility Tests
 *
 * Tests for the preload bridge readiness polling utility.
 * Uses fake timers to avoid real delays.
 *
 * @module appCore/state/machine/utils/waitForApi.test
 */

import { waitForApi } from "./waitForApi";

describe("waitForApi", () => {
  const originalApi = window.api;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

    // Fast path — no timers needed
    await waitForApi();
    expect(window.api?.system).toBeDefined();
  });

  it("waits and resolves when window.api becomes available after a delay", async () => {
    // Setup: window.api is initially undefined
    delete (window as unknown as { api?: unknown }).api;

    const promise = waitForApi(2000);

    // Advance past first poll (50ms)
    jest.advanceTimersByTime(50);

    // Make window.api appear
    (window as unknown as { api: { system: object } }).api = {
      system: { hasEncryptionKeyStore: jest.fn() },
    };

    // Advance past second poll (100ms)
    jest.advanceTimersByTime(100);

    await promise;
    expect(window.api?.system).toBeDefined();
  });

  it("rejects with timeout error when window.api never becomes available", async () => {
    // Setup: window.api is undefined and will stay undefined
    delete (window as unknown as { api?: unknown }).api;

    const promise = waitForApi(200);

    // Advance past the full timeout
    jest.advanceTimersByTime(250);

    await expect(promise).rejects.toThrow(
      "Electron preload bridge (window.api) not available after 200ms"
    );
  });

  it("resolves when window.api exists but system is added later", async () => {
    // Setup: window.api exists but system is not yet defined
    (window as unknown as { api: Record<string, unknown> }).api = {};

    const promise = waitForApi(2000);

    // Advance past first poll
    jest.advanceTimersByTime(50);

    // Add system namespace
    (window.api as unknown as Record<string, unknown>).system = {
      hasEncryptionKeyStore: jest.fn(),
    };

    // Advance past second poll
    jest.advanceTimersByTime(100);

    await promise;
    expect(window.api?.system).toBeDefined();
  });

  it("uses default timeout of 5000ms", async () => {
    delete (window as unknown as { api?: unknown }).api;

    const promise = waitForApi();

    // Advance past 5 seconds
    jest.advanceTimersByTime(5100);

    await expect(promise).rejects.toThrow("5000ms");
  });
});
