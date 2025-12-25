// ============================================
// AUTO-UPDATER IPC HANDLERS
// Extracted from main.ts for modularity
// Handles: install-update
// ============================================

import { ipcMain, app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

// Track registration to prevent duplicate handlers
let handlersRegistered = false;

/**
 * Register auto-updater IPC handlers
 */
export function registerUpdaterHandlers(mainWindow: BrowserWindow): void {
  // Prevent double registration
  if (handlersRegistered) {
    console.warn(
      "[UpdaterHandlers] Handlers already registered, skipping duplicate registration"
    );
    return;
  }
  handlersRegistered = true;

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
