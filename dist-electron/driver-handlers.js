"use strict";
/**
 * Apple Driver IPC Handlers
 *
 * Handles IPC communication for Apple driver detection and installation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDriverHandlers = registerDriverHandlers;
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const appleDriverService_1 = require("./services/appleDriverService");
/**
 * Register driver-related IPC handlers
 */
function registerDriverHandlers() {
    // Check if Apple drivers are installed
    electron_1.ipcMain.handle('drivers:check-apple', async () => {
        electron_log_1.default.info('[DriverHandlers] Checking Apple driver status');
        const status = await (0, appleDriverService_1.checkAppleDrivers)();
        electron_log_1.default.info('[DriverHandlers] Apple driver status:', status);
        return status;
    });
    // Check if bundled drivers are available
    electron_1.ipcMain.handle('drivers:has-bundled', () => {
        return { available: (0, appleDriverService_1.hasBundledDrivers)() };
    });
    // Install Apple drivers (requires user consent in UI)
    electron_1.ipcMain.handle('drivers:install-apple', async () => {
        electron_log_1.default.info('[DriverHandlers] User consented to install Apple drivers');
        const result = await (0, appleDriverService_1.installAppleDrivers)();
        electron_log_1.default.info('[DriverHandlers] Installation result:', result);
        return result;
    });
    // Open iTunes in Microsoft Store
    electron_1.ipcMain.handle('drivers:open-itunes-store', async () => {
        try {
            await electron_1.shell.openExternal((0, appleDriverService_1.getITunesDownloadUrl)());
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[DriverHandlers] Failed to open iTunes store:', error);
            // Fallback to web URL
            try {
                await electron_1.shell.openExternal((0, appleDriverService_1.getITunesWebUrl)());
                return { success: true };
            }
            catch (_fallbackError) {
                return {
                    success: false,
                    error: 'Failed to open iTunes download page',
                };
            }
        }
    });
    electron_log_1.default.info('[DriverHandlers] Registered driver IPC handlers');
}
