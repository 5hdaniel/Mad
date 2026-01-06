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
import sessionService from "./services/sessionService";
import type { iOSDevice } from "./types/device";
import { rateLimiters } from "./utils/rateLimit";
import { syncStatusService } from "./services/syncStatusService";

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
 * Get the current user ID, trying multiple sources
 * 1. Use currentUserId if already set via setSyncUserId
 * 2. Fall back to loading from session file
 */
async function getCurrentUserIdForSync(): Promise<string | null> {
  // First try the cached currentUserId
  if (currentUserId) {
    return currentUserId;
  }

  // Fall back to loading from session
  log.info("[SyncHandlers] currentUserId not set, attempting to load from session...");
  try {
    const session = await sessionService.loadSession();
    if (session?.user?.id) {
      log.info("[SyncHandlers] Loaded user ID from session file", { userId: session.user.id });
      // Also update currentUserId for future calls
      currentUserId = session.user.id;
      return session.user.id;
    }
  } catch (error) {
    log.error("[SyncHandlers] Failed to load session for user ID", { error });
  }

  log.warn("[SyncHandlers] Could not determine user ID from any source");
  return null;
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
  // Rate limited: 10 second cooldown per device to prevent sync spam.
  // Syncs involve device communication and database writes.
  ipcMain.handle(
    "sync:start",
    async (
      _,
      options: { udid: string; password?: string; forceFullBackup?: boolean },
    ) => {
      log.info("[SyncHandlers] Starting sync", { udid: options.udid });

      // Rate limit check - 10 second cooldown per device
      const { allowed, remainingMs } = rateLimiters.sync.canExecute(
        "sync:start",
        options.udid
      );
      if (!allowed && remainingMs !== undefined) {
        const seconds = Math.ceil(remainingMs / 1000);
        log.warn(
          `[SyncHandlers] Rate limited sync:start for device ${options.udid}. ` +
            `Retry in ${seconds}s`
        );
        return {
          success: false,
          messages: [],
          contacts: [],
          conversations: [],
          error: `Please wait ${seconds} seconds before starting another sync.`,
          duration: 0,
          rateLimited: true,
        };
      }

      // Capture user ID at sync start to prevent race conditions
      // This ensures data is saved to the correct user even if login state changes during sync
      syncSessionUserId = await getCurrentUserIdForSync();
      if (!syncSessionUserId) {
        log.warn("[SyncHandlers] No user ID available at sync start - data will not be persisted");
      } else {
        log.info("[SyncHandlers] User ID captured for sync persistence", { userId: syncSessionUserId });
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

  // Get unified sync status (aggregates backup + orchestrator state)
  // TASK-904: Exposes combined sync state to UI for preventing concurrent operations
  ipcMain.handle("sync:getUnifiedStatus", () => {
    return syncStatusService.getStatus();
  });

  // Process existing backup without running new backup (for testing)
  ipcMain.handle(
    "sync:process-existing",
    async (_, options: { udid: string; password?: string }) => {
      log.info("[SyncHandlers] Processing existing backup", { udid: options.udid });

      // Capture user ID at sync start to prevent race conditions
      syncSessionUserId = await getCurrentUserIdForSync();
      if (!syncSessionUserId) {
        log.warn("[SyncHandlers] No user ID available at sync start - data will not be persisted");
      } else {
        log.info("[SyncHandlers] User ID captured for sync persistence", { userId: syncSessionUserId });
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

  // Forward passcode waiting events (user needs to enter passcode on iPhone)
  orchestrator.on("waiting-for-passcode", () => {
    log.info("[SyncHandlers] Waiting for user to enter passcode on iPhone");
    sendToRenderer("sync:waiting-for-passcode", {});
  });

  orchestrator.on("passcode-entered", () => {
    log.info("[SyncHandlers] User entered passcode, backup starting");
    sendToRenderer("sync:passcode-entered", {});
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

    // Send completion to renderer with counts only (NOT the full message/contact arrays)
    // Sending 627k messages over IPC would freeze the renderer
    sendToRenderer("sync:complete", {
      success: result.success,
      error: result.error,
      messageCount: result.messages.length,
      contactCount: result.contacts.length,
      conversationCount: result.conversations.length,
    });

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
        log.info("[SyncHandlers] Sending sync:storage-complete to renderer");
        sendToRenderer("sync:storage-complete", {
          messagesStored: persistResult.messagesStored,
          contactsStored: persistResult.contactsStored,
          duration: persistResult.duration,
        });
        log.info("[SyncHandlers] sync:storage-complete sent successfully");
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
  ipcMain.removeHandler("sync:getUnifiedStatus");
  ipcMain.removeHandler("sync:process-existing");
  ipcMain.removeHandler("sync:devices");
  ipcMain.removeHandler("sync:start-detection");
  ipcMain.removeHandler("sync:stop-detection");

  log.info("[SyncHandlers] Cleaned up sync handlers");
}
