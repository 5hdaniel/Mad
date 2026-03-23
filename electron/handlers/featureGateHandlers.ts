// ============================================
// FEATURE GATE IPC HANDLERS
// SPRINT-122: Plan Admin + Feature Gate Enforcement
//
// Handles feature-gate IPC calls from the renderer.
// Resolves the current user's org from session before
// delegating to featureGateService.
// ============================================

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import sessionService from "../services/sessionService";
import supabaseService from "../services/supabaseService";
import featureGateService from "../services/featureGateService";
import type { FeatureAccess } from "../services/featureGateService";
import logService from "../services/logService";

/**
 * Resolve the organization ID for the current user.
 * Returns null if the user has no org membership.
 */
async function resolveOrgId(): Promise<string | null> {
  const session = await sessionService.loadSession();
  if (!session?.user?.id) {
    logService.debug(
      "[FeatureGate] No active session, cannot resolve org",
      "FeatureGateHandlers"
    );
    return null;
  }

  const membership = await supabaseService.getActiveOrganizationMembership(
    session.user.id
  );
  return membership?.organization_id ?? null;
}

/**
 * Register all feature gate IPC handlers
 */
export function registerFeatureGateHandlers(): void {
  // Check a single feature
  ipcMain.handle(
    "feature-gate:check",
    async (
      _event: IpcMainInvokeEvent,
      featureKey: string
    ): Promise<FeatureAccess> => {
      logService.debug(
        "[FeatureGate] Checking feature",
        "FeatureGateHandlers",
        { featureKey }
      );

      const orgId = await resolveOrgId();
      if (!orgId) {
        // No org => individual user
        // Explicitly deny team/enterprise features
        const teamFeatures = [
          "broker_submission",
          "ai_detection",
          "broker_email_view",
          "broker_email_attachments",
        ];
        if (teamFeatures.includes(featureKey)) {
          return { allowed: false, value: "", source: "default" };
        }
        // Individual features remain fail-open
        return { allowed: true, value: "", source: "default" };
      }

      return featureGateService.checkFeature(orgId, featureKey);
    }
  );

  // Get all features for the current org
  ipcMain.handle(
    "feature-gate:get-all",
    async (
      _event: IpcMainInvokeEvent
    ): Promise<Record<string, FeatureAccess>> => {
      logService.debug(
        "[FeatureGate] Getting all features",
        "FeatureGateHandlers"
      );

      const orgId = await resolveOrgId();
      if (!orgId) {
        // No org => individual user, restrict team/enterprise features
        // Individual features (text_export, email_export) remain fail-open
        // Team/Enterprise features are explicitly denied
        return {
          broker_submission: { allowed: false, value: "", source: "default" as const },
          ai_detection: { allowed: false, value: "", source: "default" as const },
          broker_email_view: { allowed: false, value: "", source: "default" as const },
          broker_email_attachments: { allowed: false, value: "", source: "default" as const },
        };
      }

      return featureGateService.getAllFeatures(orgId);
    }
  );

  // Invalidate cache (force refresh on next check)
  ipcMain.handle(
    "feature-gate:invalidate-cache",
    async (_event: IpcMainInvokeEvent): Promise<void> => {
      logService.debug(
        "[FeatureGate] Invalidating cache",
        "FeatureGateHandlers"
      );
      featureGateService.invalidateCache();
    }
  );

  logService.debug(
    "Feature gate handlers registered",
    "FeatureGateHandlers"
  );
}
