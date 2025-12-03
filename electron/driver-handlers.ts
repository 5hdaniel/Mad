/**
 * Apple Driver IPC Handlers
 *
 * Handles IPC communication for Apple driver detection and installation.
 */

import { ipcMain, shell } from 'electron';
import log from 'electron-log';
import {
  checkAppleDrivers,
  installAppleDrivers,
  hasBundledDrivers,
  getITunesDownloadUrl,
  getITunesWebUrl,
} from './services/appleDriverService';

/**
 * Register driver-related IPC handlers
 */
export function registerDriverHandlers(): void {
  // Check if Apple drivers are installed
  ipcMain.handle('drivers:check-apple', async () => {
    log.info('[DriverHandlers] Checking Apple driver status');
    const status = await checkAppleDrivers();
    log.info('[DriverHandlers] Apple driver status:', status);
    return status;
  });

  // Check if bundled drivers are available
  ipcMain.handle('drivers:has-bundled', () => {
    return { available: hasBundledDrivers() };
  });

  // Install Apple drivers (requires user consent in UI)
  ipcMain.handle('drivers:install-apple', async () => {
    log.info('[DriverHandlers] User consented to install Apple drivers');
    const result = await installAppleDrivers();
    log.info('[DriverHandlers] Installation result:', result);
    return result;
  });

  // Open iTunes in Microsoft Store
  ipcMain.handle('drivers:open-itunes-store', async () => {
    try {
      await shell.openExternal(getITunesDownloadUrl());
      return { success: true };
    } catch (error) {
      log.error('[DriverHandlers] Failed to open iTunes store:', error);
      // Fallback to web URL
      try {
        await shell.openExternal(getITunesWebUrl());
        return { success: true };
      } catch (_fallbackError) {
        return {
          success: false,
          error: 'Failed to open iTunes download page',
        };
      }
    }
  });

  log.info('[DriverHandlers] Registered driver IPC handlers');
}
