// ============================================
// PREFERENCE IPC HANDLERS
// This file contains preference handlers to be added to main.js
// ============================================

import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import supabaseService from "./services/supabaseService";

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  sanitizeObject,
} from "./utils/validation";

// Type definitions
interface PreferenceResponse {
  success: boolean;
  error?: string;
  preferences?: Record<string, unknown>;
}

/**
 * Register all preference-related IPC handlers
 */
export function registerPreferenceHandlers(): void {
  // Get user preferences
  ipcMain.handle(
    "preferences:get",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
    ): Promise<PreferenceResponse> => {
      try {
        console.log("[Preferences] Getting preferences for user:", userId);

        // Validate input
        const validatedUserId = validateUserId(userId)!;

        const preferences =
          (await supabaseService.getPreferences(validatedUserId)) ?? {};

        return {
          success: true,
          preferences: preferences || {},
        };
      } catch (error) {
        console.error("[Preferences] Failed to get preferences:", error);
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Save user preferences
  ipcMain.handle(
    "preferences:save",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      preferences: unknown,
    ): Promise<PreferenceResponse> => {
      try {
        console.log("[Preferences] Saving preferences for user:", userId);

        // Validate inputs
        const validatedUserId = validateUserId(userId)!;

        if (!preferences || typeof preferences !== "object") {
          throw new ValidationError(
            "Preferences must be an object",
            "preferences",
          );
        }

        // Sanitize preferences to prevent prototype pollution
        const sanitizedPreferences = sanitizeObject(preferences) as Record<
          string,
          any
        >;

        await supabaseService.syncPreferences(
          validatedUserId,
          sanitizedPreferences,
        );

        return {
          success: true,
        };
      } catch (error) {
        console.error("[Preferences] Failed to save preferences:", error);
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Update specific preference (partial update)
  ipcMain.handle(
    "preferences:update",
    async (
      event: IpcMainInvokeEvent,
      userId: string,
      partialPreferences: unknown,
    ): Promise<PreferenceResponse> => {
      try {
        console.log("[Preferences] Updating preferences for user:", userId);

        // Validate inputs
        const validatedUserId = validateUserId(userId)!;

        if (!partialPreferences || typeof partialPreferences !== "object") {
          throw new ValidationError(
            "Preferences must be an object",
            "partialPreferences",
          );
        }

        // Sanitize preferences to prevent prototype pollution
        const sanitizedPartialPreferences = sanitizeObject(partialPreferences);

        // Get existing preferences
        const existingPreferences =
          (await supabaseService.getPreferences(validatedUserId)) ?? {};

        // Merge with new preferences (deep merge for nested objects)
        const updatedPreferences = deepMerge(
          existingPreferences,
          sanitizedPartialPreferences,
        );

        // Save merged preferences
        await supabaseService.syncPreferences(
          validatedUserId,
          updatedPreferences,
        );

        return {
          success: true,
          preferences: updatedPreferences,
        };
      } catch (error) {
        console.error("[Preferences] Failed to update preferences:", error);
        if (error instanceof ValidationError) {
          return {
            success: false,
            error: `Validation error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  console.log("[Preferences] Handlers registered");
}

/**
 * Deep merge two objects
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
function deepMerge(target: unknown, source: unknown): Record<string, unknown> {
  const output = { ...(target as Record<string, unknown>) };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in (target as Record<string, unknown>))) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(
            (target as Record<string, unknown>)[key],
            source[key],
          );
        }
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

/**
 * Check if value is an object
 * @param item - Item to check
 * @returns True if object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}
