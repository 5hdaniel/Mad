// ============================================
// LICENSE IPC HANDLERS
// Handles license-related IPC calls from renderer
// ============================================

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import sessionService from "./services/sessionService";
import { getUserById } from "./services/db/userDbService";
import { dbRun } from "./services/db/core/dbConnection";
import logService from "./services/logService";
import supabaseService from "./services/supabaseService";
import type { LicenseType, UserLicense } from "./types/models";

// Type definitions
interface LicenseResponse {
  success: boolean;
  error?: string;
  license?: UserLicense;
}

/**
 * Get license data from the current session user
 * Falls back to database lookup if session doesn't have license fields
 */
async function getLicenseData(): Promise<LicenseResponse> {
  try {
    // First try to get license from session
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

    const user = session.user;

    // Check Supabase for organization membership (source of truth for team license)
    // This takes precedence over local database
    const orgMembership = await supabaseService.getActiveOrganizationMembership(user.id);

    if (orgMembership) {
      logService.debug("[License] Team membership found in Supabase", "License", {
        organization_id: orgMembership.organization_id,
        organization_name: orgMembership.organization_name,
      });

      // Get AI addon status from local database (local setting)
      const dbUser = await getUserById(user.id);
      const aiEnabled = dbUser?.ai_detection_enabled || false;

      return {
        success: true,
        license: {
          license_type: "team" as LicenseType,
          ai_detection_enabled: aiEnabled,
          organization_id: orgMembership.organization_id,
          organization_name: orgMembership.organization_name,
        },
      };
    }

    // No team membership - check local database for license info
    logService.debug(
      "[License] No team membership, checking local database",
      "License",
      { userId: user.id }
    );

    const dbUser = await getUserById(user.id);
    if (dbUser) {
      logService.debug("[License] License found in database", "License", {
        license_type: dbUser.license_type,
        ai_detection_enabled: dbUser.ai_detection_enabled,
      });

      return {
        success: true,
        license: {
          license_type: dbUser.license_type || "individual",
          ai_detection_enabled: dbUser.ai_detection_enabled || false,
          organization_id: dbUser.organization_id,
        },
      };
    }

    // Default: individual license with no AI
    logService.debug(
      "[License] No license found, using defaults",
      "License"
    );

    return {
      success: true,
      license: {
        license_type: "individual",
        ai_detection_enabled: false,
        organization_id: undefined,
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

  // DEV ONLY: Toggle AI add-on for testing
  ipcMain.handle(
    "license:dev:toggle-ai-addon",
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      enabled: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        logService.info(
          `[License] DEV: Setting AI add-on to ${enabled} for user ${userId}`,
          "License"
        );

        // Update local database directly (SQLite uses INTEGER 0/1 for boolean)
        dbRun(
          "UPDATE users_local SET ai_detection_enabled = ? WHERE id = ?",
          [enabled ? 1 : 0, userId]
        );

        logService.info(
          `[License] DEV: AI add-on ${enabled ? "enabled" : "disabled"} for user ${userId}`,
          "License"
        );

        return { success: true };
      } catch (error) {
        logService.error("[License] DEV: Failed to toggle AI add-on", "License", {
          error,
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // DEV ONLY: Set license type for testing
  ipcMain.handle(
    "license:dev:set-license-type",
    async (
      _event: IpcMainInvokeEvent,
      userId: string,
      licenseType: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        logService.info(
          `[License] DEV: Setting license_type to ${licenseType} for user ${userId}`,
          "License"
        );

        dbRun(
          "UPDATE users_local SET license_type = ? WHERE id = ?",
          [licenseType, userId]
        );

        logService.info(
          `[License] DEV: license_type set to ${licenseType} for user ${userId}`,
          "License"
        );

        return { success: true };
      } catch (error) {
        logService.error("[License] DEV: Failed to set license type", "License", {
          error,
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  logService.debug("License handlers registered", "License");
}
