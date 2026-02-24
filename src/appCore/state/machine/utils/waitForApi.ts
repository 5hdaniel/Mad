/**
 * Preload Bridge Readiness Utility
 *
 * Waits for the Electron preload bridge (window.api) to become available.
 * The contextBridge.exposeInMainWorld() call in preload.ts may not have
 * completed by the time React mounts, causing a race condition where
 * window.api is undefined.
 *
 * Uses exponential backoff: 50ms -> 100ms -> 200ms -> 500ms (cap)
 * with a configurable timeout (default 5s).
 *
 * @module appCore/state/machine/utils/waitForApi
 */

/**
 * Waits for the Electron preload bridge (window.api) to become available.
 *
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @returns Promise that resolves when window.api is available, or rejects on timeout
 *
 * @example
 * ```ts
 * try {
 *   await waitForApi();
 *   // Safe to use window.api.system, window.api.auth, etc.
 * } catch (err) {
 *   // Bridge never became available within timeout
 * }
 * ```
 */
export async function waitForApi(timeoutMs = 5000): Promise<void> {
  // Fast path: already available (99% of startups)
  if (window.api?.system) return;

  const startTime = Date.now();
  let delay = 50; // Start with 50ms, double each iteration

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (window.api?.system) return;
    delay = Math.min(delay * 2, 500); // Cap at 500ms between checks
  }

  throw new Error(
    "Electron preload bridge (window.api) not available after " +
      timeoutMs +
      "ms. The app may need to be restarted."
  );
}
