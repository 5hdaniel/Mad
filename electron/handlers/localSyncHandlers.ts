/**
 * Local Sync IPC Handlers
 * Exposes the local sync HTTP server to the renderer process via IPC.
 *
 * TASK-1429: Android Companion — Encrypted HTTP Transport
 */

import { ipcMain } from "electron";
import localSyncService from "../services/localSyncService";
import logService from "../services/logService";

const LOG_TAG = "LocalSyncHandlers";

/**
 * Register local sync IPC handlers.
 */
export function registerLocalSyncHandlers(): void {
  // Start the local sync HTTP server
  ipcMain.handle(
    "sync:start-server",
    async (
      _event,
      options: { port: number; secret: string }
    ): Promise<{ port: number; address: string }> => {
      logService.info("[LocalSync] IPC: start-server requested", LOG_TAG);
      return localSyncService.startServer(options.port, options.secret);
    }
  );

  // Stop the local sync HTTP server
  ipcMain.handle("sync:stop-server", async (): Promise<void> => {
    logService.info("[LocalSync] IPC: stop-server requested", LOG_TAG);
    return localSyncService.stopServer();
  });

  // Get server running status
  ipcMain.handle("sync:get-status", () => {
    return localSyncService.getStatus();
  });
}

/**
 * Clean up: stop the server if running.
 * Called from app.on('before-quit').
 */
export function cleanupLocalSyncHandlers(): void {
  logService.info("[LocalSync] Cleaning up sync server", LOG_TAG);
  // Fire-and-forget — we're shutting down
  localSyncService.stopServer().catch((err) => {
    logService.error(
      `[LocalSync] Cleanup error: ${err instanceof Error ? err.message : String(err)}`,
      LOG_TAG
    );
  });
}
