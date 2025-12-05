"use strict";
// ============================================
// DEVICE DETECTION IPC HANDLERS
// Handles iOS device detection via USB
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeviceHandlers = registerDeviceHandlers;
exports.cleanupDeviceHandlers = cleanupDeviceHandlers;
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const deviceDetectionService_1 = require("./services/deviceDetectionService");
/**
 * Registers all device-related IPC handlers.
 * Sets up event forwarding from device service to renderer process.
 *
 * @param mainWindow The main browser window to send events to
 */
function registerDeviceHandlers(mainWindow) {
    electron_log_1.default.info('[DeviceHandlers] Registering device detection handlers');
    // Forward device events to renderer
    deviceDetectionService_1.deviceDetectionService.on('device-connected', (device) => {
        electron_log_1.default.info(`[DeviceHandlers] Forwarding device-connected event for: ${device.name}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device:connected', device);
        }
    });
    deviceDetectionService_1.deviceDetectionService.on('device-disconnected', (device) => {
        electron_log_1.default.info(`[DeviceHandlers] Forwarding device-disconnected event for: ${device.name}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('device:disconnected', device);
        }
    });
    // ===== IPC HANDLERS =====
    /**
     * List all currently connected devices
     */
    electron_1.ipcMain.handle('device:list', async () => {
        try {
            const devices = deviceDetectionService_1.deviceDetectionService.getConnectedDevices();
            return {
                success: true,
                devices,
            };
        }
        catch (error) {
            electron_log_1.default.error('[DeviceHandlers] Error listing devices:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });
    /**
     * Start device detection polling
     */
    electron_1.ipcMain.handle('device:start-detection', async () => {
        try {
            deviceDetectionService_1.deviceDetectionService.start();
            electron_log_1.default.info('[DeviceHandlers] Device detection started');
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[DeviceHandlers] Error starting device detection:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });
    /**
     * Stop device detection polling
     */
    electron_1.ipcMain.handle('device:stop-detection', async () => {
        try {
            deviceDetectionService_1.deviceDetectionService.stop();
            electron_log_1.default.info('[DeviceHandlers] Device detection stopped');
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[DeviceHandlers] Error stopping device detection:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });
    /**
     * Check if libimobiledevice tools are available
     */
    electron_1.ipcMain.handle('device:check-availability', async () => {
        try {
            const available = await deviceDetectionService_1.deviceDetectionService.checkLibimobiledeviceAvailable();
            return {
                success: true,
                available,
            };
        }
        catch (error) {
            electron_log_1.default.error('[DeviceHandlers] Error checking availability:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    });
    electron_log_1.default.info('[DeviceHandlers] Device handlers registered successfully');
}
/**
 * Cleanup function to stop device detection on app quit.
 * Should be called when the app is shutting down.
 */
function cleanupDeviceHandlers() {
    electron_log_1.default.info('[DeviceHandlers] Cleaning up device detection');
    deviceDetectionService_1.deviceDetectionService.stop();
}
