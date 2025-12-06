/**
 * Sync IPC Handlers
 *
 * Handles IPC communication between renderer and main process
 * for iPhone sync operations on Windows.
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { SyncOrchestrator, syncOrchestrator, SyncProgress, SyncResult } from './services/syncOrchestrator';
import type { iOSDevice } from './types/device';

let orchestrator: SyncOrchestrator | null = null;
let mainWindowRef: BrowserWindow | null = null;

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
 */
export function registerSyncHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
  orchestrator = syncOrchestrator;

  // Set up event forwarding to renderer
  setupEventForwarding();

  // Start sync operation
  ipcMain.handle('sync:start', async (_, options: { udid: string; password?: string; forceFullBackup?: boolean }) => {
    log.info('[SyncHandlers] Starting sync', { udid: options.udid });

    try {
      const result = await orchestrator!.sync(options);
      return result;
    } catch (error) {
      log.error('[SyncHandlers] Sync error', { error });
      return {
        success: false,
        messages: [],
        contacts: [],
        conversations: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
      };
    }
  });

  // Cancel sync operation
  ipcMain.handle('sync:cancel', () => {
    log.info('[SyncHandlers] Cancelling sync');
    orchestrator?.cancel();
    return { success: true };
  });

  // Get current sync status
  ipcMain.handle('sync:status', () => {
    return orchestrator?.getStatus() || { isRunning: false, phase: 'idle' };
  });

  // Get connected devices
  ipcMain.handle('sync:devices', () => {
    return orchestrator?.getConnectedDevices() || [];
  });

  // Start device detection polling
  ipcMain.handle('sync:start-detection', (_, intervalMs?: number) => {
    log.info('[SyncHandlers] Starting device detection');
    orchestrator?.startDeviceDetection(intervalMs);
    return { success: true };
  });

  // Stop device detection polling
  ipcMain.handle('sync:stop-detection', () => {
    log.info('[SyncHandlers] Stopping device detection');
    orchestrator?.stopDeviceDetection();
    return { success: true };
  });

  log.info('[SyncHandlers] Registered sync IPC handlers');
}

/**
 * Set up event forwarding from orchestrator to renderer
 */
function setupEventForwarding(): void {
  if (!orchestrator) return;

  // Forward progress events
  orchestrator.on('progress', (progress: SyncProgress) => {
    sendToRenderer('sync:progress', progress);
  });

  // Forward phase changes
  orchestrator.on('phase', (phase: string) => {
    sendToRenderer('sync:phase', phase);
  });

  // Forward device events
  orchestrator.on('device-connected', (device: iOSDevice) => {
    log.info('[SyncHandlers] Device connected', { name: device.name, udid: device.udid });
    sendToRenderer('sync:device-connected', device);
  });

  orchestrator.on('device-disconnected', (device: iOSDevice) => {
    log.info('[SyncHandlers] Device disconnected', { name: device.name, udid: device.udid });
    sendToRenderer('sync:device-disconnected', device);
  });

  // Forward password required event
  orchestrator.on('password-required', () => {
    log.info('[SyncHandlers] Password required for encrypted backup');
    sendToRenderer('sync:password-required', {});
  });

  // Forward error events
  orchestrator.on('error', (error: Error) => {
    log.error('[SyncHandlers] Sync error event', { error: error.message });
    sendToRenderer('sync:error', { message: error.message });
  });

  // Forward completion events
  orchestrator.on('complete', (result: SyncResult) => {
    log.info('[SyncHandlers] Sync complete', {
      conversations: result.conversations.length,
      messages: result.messages.length,
    });
    sendToRenderer('sync:complete', result);
  });
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

  // Remove IPC handlers
  ipcMain.removeHandler('sync:start');
  ipcMain.removeHandler('sync:cancel');
  ipcMain.removeHandler('sync:status');
  ipcMain.removeHandler('sync:devices');
  ipcMain.removeHandler('sync:start-detection');
  ipcMain.removeHandler('sync:stop-detection');

  log.info('[SyncHandlers] Cleaned up sync handlers');
}
