/**
 * Sync IPC Handlers
 *
 * Handles IPC communication between renderer and main process
 * for iPhone sync operations on Windows.
 */

import { ipcMain, BrowserWindow } from "electron";
import log from "electron-log";
import {
  SyncOrchestrator,
  syncOrchestrator,
  SyncProgress,
  SyncResult,
} from "./services/syncOrchestrator";
import { iPhoneSyncStorageService } from "./services/iPhoneSyncStorageService";
import type { iOSDevice } from "./types/device";

let orchestrator: SyncOrchestrator | null = null;
let mainWindowRef: BrowserWindow | null = null;
let currentUserId: string | null = null;
// Track user ID at sync start to prevent race conditions
let syncSessionUserId: string | null = null;

/**
 * Send event to renderer process
 */
function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data);
  }
}

/**
 * Register sync-related IPC handlers
 * @param mainWindow - The main BrowserWindow
 * @param userId - The current user's ID (optional, can be set later via setCurrentUserId)
 */
export function registerSyncHandlers(mainWindow: BrowserWindow, userId?: string): void {
  mainWindowRef = mainWindow;
  orchestrator = syncOrchestrator;
  if (userId) {
    currentUserId = userId;
  }

  // Set up event forwarding to renderer
  setupEventForwarding();

  // Start sync operation
  ipcMain.handle(
    "sync:start",
    async (
      _,
      options: { udid: string; password?: string; forceFullBackup?: boolean },
    ) => {
      log.info("[SyncHandlers] Starting sync", { udid: options.udid });

      // Capture user ID at sync start to prevent race conditions
      // This ensures data is saved to the correct user even if login state changes during sync
      syncSessionUserId = currentUserId;
      if (!syncSessionUserId) {
        log.warn("[SyncHandlers] No user ID available at sync start - data will not be persisted");
      }

      // Check if sync is stuck and force reset if needed
      const status = orchestrator?.getStatus();
      if (status?.isRunning) {
        log.warn("[SyncHandlers] Sync appears stuck, forcing reset before starting");
        orchestrator?.forceReset();
      }

      try {
        const result = await orchestrator!.sync(options);
        return result;
      } catch (error) {
        log.error("[SyncHandlers] Sync error", { error });
        // Reset state on error
        orchestrator?.forceReset();
        syncSessionUserId = null; // Clear session user ID on error
        return {
          success: false,
          messages: [],
          contacts: [],
          conversations: [],
          error: error instanceof Error ? error.message : "Unknown error",
          duration: 0,
        };
      }
    },
  );

  // Cancel sync operation
  ipcMain.handle("sync:cancel", () => {
    log.info("[SyncHandlers] Cancelling sync");
    orchestrator?.cancel();
    return { success: true };
  });

  // Force reset sync state (for recovery from stuck state)
  ipcMain.handle("sync:reset", () => {
    log.info("[SyncHandlers] Force resetting sync state");
    orchestrator?.forceReset();
    return { success: true };
  });

  // Get current sync status
  ipcMain.handle("sync:status", () => {
    return orchestrator?.getStatus() || { isRunning: false, phase: "idle" };
  });

  // Process existing backup without running new backup (for testing)
  ipcMain.handle(
    "sync:process-existing",
    async (_, options: { udid: string; password?: string }) => {
      log.info("[SyncHandlers] Processing existing backup", { udid: options.udid });

      // Capture user ID at sync start to prevent race conditions
      syncSessionUserId = currentUserId;
      if (!syncSessionUserId) {
        log.warn("[SyncHandlers] No user ID available at sync start - data will not be persisted");
      }

      // Check if sync is stuck and force reset if needed
      const status = orchestrator?.getStatus();
      if (status?.isRunning) {
        log.warn("[SyncHandlers] Sync appears stuck, forcing reset before processing");
        orchestrator?.forceReset();
      }

      try {
        const result = await orchestrator!.processExistingBackup(options.udid, options.password);
        return result;
      } catch (error) {
        log.error("[SyncHandlers] Process existing backup error", { error });
        orchestrator?.forceReset();
        syncSessionUserId = null; // Clear session user ID on error
        return {
          success: false,
          messages: [],
          contacts: [],
          conversations: [],
          error: error instanceof Error ? error.message : "Unknown error",
          duration: 0,
        };
      }
    }
  );

  // Get connected devices
  ipcMain.handle("sync:devices", () => {
    return orchestrator?.getConnectedDevices() || [];
  });

  // Start device detection polling
  ipcMain.handle("sync:start-detection", (_, intervalMs?: number) => {
    log.info("[SyncHandlers] Starting device detection");
    orchestrator?.startDeviceDetection(intervalMs);

    // Return any already-connected devices immediately
    const devices = orchestrator?.getConnectedDevices() || [];
    log.info(`[SyncHandlers] Already connected devices: ${devices.length}`);

    // Also emit device-connected for any already-connected devices
    // This handles the race condition where device was detected before
    // the renderer set up its event listeners
    for (const device of devices) {
      log.info(`[SyncHandlers] Re-emitting device-connected for: ${device.name}`);
      sendToRenderer("sync:device-connected", device);
    }

    return { success: true, devices };
  });

  // Stop device detection polling
  ipcMain.handle("sync:stop-detection", () => {
    log.info("[SyncHandlers] Stopping device detection");
    orchestrator?.stopDeviceDetection();
    return { success: true };
  });

  log.info("[SyncHandlers] Registered sync IPC handlers");
}

/**
 * Set up event forwarding from orchestrator to renderer
 */
function setupEventForwarding(): void {
  if (!orchestrator) return;

  // Forward progress events
  orchestrator.on("progress", (progress: SyncProgress) => {
    sendToRenderer("sync:progress", progress);
  });

  // Forward phase changes
  orchestrator.on("phase", (phase: string) => {
    sendToRenderer("sync:phase", phase);
  });

  // Forward device events
  orchestrator.on("device-connected", (device: iOSDevice) => {
    log.info("[SyncHandlers] Device connected", {
      name: device.name,
      udid: device.udid,
    });
    sendToRenderer("sync:device-connected", device);
  });

  orchestrator.on("device-disconnected", (device: iOSDevice) => {
    log.info("[SyncHandlers] Device disconnected", {
      name: device.name,
      udid: device.udid,
    });
    sendToRenderer("sync:device-disconnected", device);
  });

  // Forward password required event
  orchestrator.on("password-required", () => {
    log.info("[SyncHandlers] Password required for encrypted backup");
    sendToRenderer("sync:password-required", {});
  });

  // Forward error events
  orchestrator.on("error", (error: Error) => {
    log.error("[SyncHandlers] Sync error event", { error: error.message });
    sendToRenderer("sync:error", { message: error.message });
  });

  // Forward completion events and persist data
  orchestrator.on("complete", async (result: SyncResult) => {
    log.info("[SyncHandlers] Sync complete", {
      conversations: result.conversations.length,
      messages: result.messages.length,
    });

    // Send completion to renderer first (with extraction results)
    sendToRenderer("sync:complete", result);

    // Use the user ID captured at sync start (not current) to prevent race conditions
    const userIdForPersistence = syncSessionUserId;
    syncSessionUserId = null; // Clear session user ID after capturing

    // Persist to database if we have a user ID
    if (userIdForPersistence && result.success) {
      log.info("[SyncHandlers] Starting database persistence for user", { userId: userIdForPersistence });
      sendToRenderer("sync:progress", {
        phase: "storing",
        percent: 0,
        message: "Saving messages to database...",
      });

      try {
        const persistResult = await iPhoneSyncStorageService.persistSyncResult(
          userIdForPersistence,
          result,
          (progress) => {
            const message =
              progress.phase === "messages"
                ? `Saving messages... ${progress.current.toLocaleString()} of ${progress.total.toLocaleString()}`
                : `Saving contacts... ${progress.current} of ${progress.total}`;
            sendToRenderer("sync:progress", {
              phase: "storing",
              percent: progress.percent,
              message,
            });
          }
        );

        log.info("[SyncHandlers] Database persistence complete", {
          messagesStored: persistResult.messagesStored,
          messagesSkipped: persistResult.messagesSkipped,
          contactsStored: persistResult.contactsStored,
          contactsSkipped: persistResult.contactsSkipped,
          duration: persistResult.duration,
        });

        // Send final completion with storage results
        sendToRenderer("sync:storage-complete", {
          messagesStored: persistResult.messagesStored,
          contactsStored: persistResult.contactsStored,
          duration: persistResult.duration,
        });
      } catch (error) {
        log.error("[SyncHandlers] Database persistence failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        sendToRenderer("sync:storage-error", {
          error: error instanceof Error ? error.message : "Failed to save messages",
        });
      }
    } else if (!userIdForPersistence) {
      log.warn("[SyncHandlers] No user ID available (was not set at sync start), skipping database persistence");
    }
  });
}

/**
 * Set the current user ID for database persistence
 * Call this after user logs in
 */
export function setSyncUserId(userId: string | null): void {
  currentUserId = userId;
  log.info("[SyncHandlers] User ID set for sync persistence", { userId: userId ? "set" : "cleared" });
}

/**
 * Cleanup sync handlers
 */
export function cleanupSyncHandlers(): void {
  if (orchestrator) {
    orchestrator.stopDeviceDetection();
    orchestrator.removeAllListeners();
  }
  orchestrator = null;
  mainWindowRef = null;
  currentUserId = null;
  syncSessionUserId = null;

  // Remove IPC handlers
  ipcMain.removeHandler("sync:start");
  ipcMain.removeHandler("sync:cancel");
  ipcMain.removeHandler("sync:reset");
  ipcMain.removeHandler("sync:status");
  ipcMain.removeHandler("sync:process-existing");
  ipcMain.removeHandler("sync:devices");
  ipcMain.removeHandler("sync:start-detection");
  ipcMain.removeHandler("sync:stop-detection");

  log.info("[SyncHandlers] Cleaned up sync handlers");
}
