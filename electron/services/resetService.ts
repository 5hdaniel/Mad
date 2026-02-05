/**
 * Reset Service
 * TASK-1802: Reset App Data Self-Healing Feature
 *
 * Provides functionality to reset all local app data, allowing users
 * to recover from corrupted local state without contacting support.
 *
 * IMPORTANT: This is a destructive operation. All local data will be deleted.
 * Cloud data in Supabase is NOT affected.
 */

import { app } from "electron";
import { rm } from "fs/promises";
import logService from "./logService";
import { getErrorLoggingService } from "./errorLoggingService";
import sessionService from "./sessionService";

/**
 * Result of a reset operation
 */
export interface ResetResult {
  /** True if reset completed successfully */
  success: boolean;
  /** Error message if reset failed */
  error?: string;
}

/**
 * What gets reset:
 * - SQLite database (~/Library/Application Support/Magic Audit/)
 * - Session data (session.json in userData)
 * - App preferences stored in userData
 * - Encryption key store
 *
 * What is NOT reset:
 * - Supabase cloud data
 * - User's Supabase account
 * - License information (stored in Supabase)
 */
class ResetService {
  private static instance: ResetService;

  static getInstance(): ResetService {
    if (!ResetService.instance) {
      ResetService.instance = new ResetService();
    }
    return ResetService.instance;
  }

  /**
   * Perform a complete reset of all local app data
   * This will:
   * 1. Log the reset action to Supabase (for auditing)
   * 2. Clear the session
   * 3. Delete the entire userData directory
   * 4. Relaunch the app
   *
   * @returns Result with success status
   */
  async performReset(): Promise<ResetResult> {
    try {
      logService.warn(
        "[ResetService] Starting app data reset",
        "ResetService"
      );

      // Step 1: Log the reset action to Supabase BEFORE clearing
      // This creates an audit trail even if local data is corrupted
      await this.logResetAction();

      // Step 2: Clear session data
      await this.clearSession();

      // Step 3: Clear the entire userData directory
      // This removes: database, encryption keys, session file, logs, etc.
      await this.clearAppData();

      logService.info(
        "[ResetService] Reset completed, relaunching app",
        "ResetService"
      );

      // Step 4: Relaunch the app
      // Small delay to ensure logs are flushed
      setTimeout(() => {
        this.relaunchApp();
      }, 500);

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during reset";

      logService.error(
        "[ResetService] Reset failed",
        "ResetService",
        { error: errorMessage }
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Log the reset action to Supabase for auditing
   * We do this BEFORE clearing local data so we have a record
   */
  private async logResetAction(): Promise<void> {
    try {
      const errorLogging = getErrorLoggingService();
      await errorLogging.submitError({
        errorType: "user_reset",
        errorMessage: "User initiated app data reset from ErrorScreen",
        currentScreen: "ErrorScreen",
        appState: {
          action: "reset_app_data",
          timestamp: new Date().toISOString(),
        },
      });
      logService.info(
        "[ResetService] Reset action logged to Supabase",
        "ResetService"
      );
    } catch (error) {
      // Don't block reset if logging fails
      // The reset is user-initiated, so it should proceed
      logService.warn(
        "[ResetService] Failed to log reset action (continuing anyway)",
        "ResetService",
        { error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }

  /**
   * Clear the session file
   */
  private async clearSession(): Promise<void> {
    try {
      await sessionService.clearSession();
      logService.debug(
        "[ResetService] Session cleared",
        "ResetService"
      );
    } catch (error) {
      // Session clearing is not critical - proceed with reset
      logService.warn(
        "[ResetService] Failed to clear session (continuing)",
        "ResetService",
        { error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }

  /**
   * Clear the entire Application Support directory for the app
   * This removes all local data including:
   * - SQLite database
   * - Encryption key store
   * - Session data
   * - Local logs
   * - Cached attachments
   */
  private async clearAppData(): Promise<void> {
    const userDataPath = app.getPath("userData");
    logService.info(
      "[ResetService] Clearing userData directory",
      "ResetService",
      { path: userDataPath }
    );

    // Use rm with recursive and force options
    // This will delete the entire directory and all contents
    await rm(userDataPath, { recursive: true, force: true });

    logService.info(
      "[ResetService] userData directory cleared",
      "ResetService"
    );
  }

  /**
   * Relaunch the application
   * This will start a fresh instance after the reset
   */
  private relaunchApp(): void {
    logService.info(
      "[ResetService] Relaunching app",
      "ResetService"
    );
    app.relaunch();
    app.exit(0);
  }
}

/**
 * Get the singleton instance of ResetService
 */
export const getResetService = (): ResetService => {
  return ResetService.getInstance();
};

export default ResetService;
