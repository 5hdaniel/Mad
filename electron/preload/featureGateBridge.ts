/**
 * Feature Gate Bridge
 * Handles feature gate IPC calls from renderer to main process
 *
 * SPRINT-122: Plan Admin + Feature Gate Enforcement
 */

import { ipcRenderer } from "electron";
import type { FeatureAccess } from "../types/featureGate";

// Re-export for backwards compatibility
export type { FeatureAccess as FeatureAccessResult } from "../types/featureGate";

export const featureGateBridge = {
  /**
   * Check access to a specific feature
   * @param featureKey - Feature key to check (e.g., "text_export", "email_export")
   * @returns Feature access result with allowed status
   */
  check: (featureKey: string): Promise<FeatureAccess> =>
    ipcRenderer.invoke("feature-gate:check", featureKey),

  /**
   * Get all features for the current organization
   * @returns Record of feature keys to access results
   */
  getAll: (): Promise<Record<string, FeatureAccess>> =>
    ipcRenderer.invoke("feature-gate:get-all"),

  /**
   * Invalidate the feature gate cache, forcing a refresh on next check
   */
  invalidateCache: (): Promise<void> =>
    ipcRenderer.invoke("feature-gate:invalidate-cache"),
};
