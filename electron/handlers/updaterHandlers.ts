// ============================================
// AUTO-UPDATER IPC HANDLERS
// Extracted from main.ts for modularity
// Handles: install-update
// ============================================

import { ipcMain, app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import * as Sentry from "@sentry/electron/main";
import logService from "../services/logService";

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

/**
 * Register auto-updater IPC handlers
 */
export function registerUpdaterHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    logService.warn(
      "Handlers already registered, skipping duplicate registration",
      "UpdaterHandlers"
    );
    return;
  }
  handlersRegistered = true;

  // Check for updates manually (TASK-1990)
  ipcMain.handle("app:check-for-updates", async () => {
    try {
      if (!app.isPackaged) {
        return { updateAvailable: false, currentVersion: app.getVersion() };
      }
      const result = await autoUpdater.checkForUpdatesAndNotify();
      return {
        updateAvailable: result?.isUpdateAvailable ?? false,
        version: result?.updateInfo?.version,
        currentVersion: app.getVersion(),
      };
    } catch (error) {
      log.warn("Manual update check failed:", error);
      Sentry.captureException(error, { tags: { component: "auto-updater", trigger: "manual-check" } });
      return {
        updateAvailable: false,
        currentVersion: app.getVersion(),
        error: error instanceof Error ? error.message : "Check failed",
      };
    }
  });

  // Install update and restart
  ipcMain.on("install-update", () => {
    log.info("Installing update...");

    // Ensure app relaunches after update
    // Parameters: isSilent, isForceRunAfter
    // false = show installer, true = force run after install
    setImmediate(() => {
      app.removeAllListeners("window-all-closed");
      if (mainWindow) {
        mainWindow.removeAllListeners("close");
        mainWindow.close();
      }
      autoUpdater.quitAndInstall(false, true);
    });
  });
}
