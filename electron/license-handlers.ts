// ============================================
// LICENSE IPC HANDLERS
// Handles license-related IPC calls from renderer
// ============================================

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import sessionService from "./services/sessionService";
import { getUserById } from "./services/db/userDbService";
import supabaseService from "./services/supabaseService";
import logService from "./services/logService";
import type { LicenseType, UserLicense } from "./types/models";

// Type definitions
interface LicenseResponse {
  success: boolean;
  error?: string;
  license?: UserLicense;
}

/**
 * Get license data by checking Supabase for organization membership
 * This is the single source of truth for team license status
 */
async function getLicenseData(): Promise<LicenseResponse> {
  try {
    // Get current user session
    const session = await sessionService.loadSession();

    if (!session || !session.user) {
      logService.debug("[License] No active session", "License");
      return {
        success: true,
        license: {
          license_type: "individual" as LicenseType,
          ai_detection_enabled: false,
          organization_id: undefined,
        },
      };
    }

    const userId = session.user.id;

    // Check Supabase for active organization membership (single source of truth)
    logService.debug(
      "[License] Checking Supabase for organization membership",
      "License",
      { userId }
    );

    const membership = await supabaseService.getActiveOrganizationMembership(userId);

    // Determine license type based on organization membership
    const licenseType: LicenseType = membership ? "team" : "individual";

    // Get AI detection status from local user record
    const dbUser = await getUserById(userId);
    const aiEnabled = dbUser?.ai_detection_enabled || false;

    logService.debug("[License] License determined", "License", {
      license_type: licenseType,
      ai_detection_enabled: aiEnabled,
      organization_id: membership?.organization_id,
      source: membership ? "organization_members" : "default",
    });

    return {
      success: true,
      license: {
        license_type: licenseType,
        ai_detection_enabled: aiEnabled,
        organization_id: membership?.organization_id,
      },
    };
  } catch (error) {
    logService.error("[License] Failed to get license:", "License", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Register all license-related IPC handlers
 */
export function registerLicenseHandlers(): void {
  // Get current user's license
  ipcMain.handle(
    "license:get",
    async (_event: IpcMainInvokeEvent): Promise<LicenseResponse> => {
      logService.debug("[License] Getting license", "License");
      return getLicenseData();
    }
  );

  // Refresh license data (same as get, but explicitly marked for refresh)
  ipcMain.handle(
    "license:refresh",
    async (_event: IpcMainInvokeEvent): Promise<LicenseResponse> => {
      logService.debug("[License] Refreshing license", "License");
      return getLicenseData();
    }
  );

  logService.debug("License handlers registered", "License");
}
