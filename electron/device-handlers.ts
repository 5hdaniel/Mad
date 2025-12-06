// ============================================
// DEVICE DETECTION IPC HANDLERS
// Handles iOS device detection via USB
// ============================================

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { deviceDetectionService } from './services/deviceDetectionService';
import type { iOSDevice } from './types/device';

/**
 * Response type for device-related IPC handlers
 */
interface DeviceResponse {
  success: boolean;
  error?: string;
}

/**
 * Response type for listing devices
 */
interface ListDevicesResponse extends DeviceResponse {
  devices?: iOSDevice[];
}

/**
 * Registers all device-related IPC handlers.
 * Sets up event forwarding from device service to renderer process.
 *
 * @param mainWindow The main browser window to send events to
 */
export function registerDeviceHandlers(mainWindow: BrowserWindow): void {
  log.info('[DeviceHandlers] Registering device detection handlers');

  // Forward device events to renderer
  deviceDetectionService.on('device-connected', (device: iOSDevice) => {
    log.info(`[DeviceHandlers] Forwarding device-connected event for: ${device.name}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device:connected', device);
    }
  });

  deviceDetectionService.on('device-disconnected', (device: iOSDevice) => {
    log.info(`[DeviceHandlers] Forwarding device-disconnected event for: ${device.name}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device:disconnected', device);
    }
  });

  // ===== IPC HANDLERS =====

  /**
   * List all currently connected devices
   */
  ipcMain.handle('device:list', async (): Promise<ListDevicesResponse> => {
    try {
      const devices = deviceDetectionService.getConnectedDevices();
      return {
        success: true,
        devices,
      };
    } catch (error) {
      log.error('[DeviceHandlers] Error listing devices:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * Start device detection polling
   */
  ipcMain.handle('device:start-detection', async (): Promise<DeviceResponse> => {
    try {
      deviceDetectionService.start();
      log.info('[DeviceHandlers] Device detection started');
      return { success: true };
    } catch (error) {
      log.error('[DeviceHandlers] Error starting device detection:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * Stop device detection polling
   */
  ipcMain.handle('device:stop-detection', async (): Promise<DeviceResponse> => {
    try {
      deviceDetectionService.stop();
      log.info('[DeviceHandlers] Device detection stopped');
      return { success: true };
    } catch (error) {
      log.error('[DeviceHandlers] Error stopping device detection:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * Check if libimobiledevice tools are available
   */
  ipcMain.handle('device:check-availability', async (): Promise<DeviceResponse & { available?: boolean }> => {
    try {
      const available = await deviceDetectionService.checkLibimobiledeviceAvailable();
      return {
        success: true,
        available,
      };
    } catch (error) {
      log.error('[DeviceHandlers] Error checking availability:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  log.info('[DeviceHandlers] Device handlers registered successfully');
}

/**
 * Cleanup function to stop device detection on app quit.
 * Should be called when the app is shutting down.
 */
export function cleanupDeviceHandlers(): void {
  log.info('[DeviceHandlers] Cleaning up device detection');
  deviceDetectionService.stop();
}
