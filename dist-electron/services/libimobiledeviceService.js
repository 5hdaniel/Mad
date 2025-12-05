"use strict";
/**
 * libimobiledevice Service
 * Locates and provides paths to libimobiledevice Windows binaries
 *
 * This service is compatible with TASK-002 specification and extends it
 * with additional utilities for the backup service.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_EXECUTABLES = void 0;
exports.isMockMode = isMockMode;
exports.getLibimobiledevicePath = getLibimobiledevicePath;
exports.getExecutablePath = getExecutablePath;
exports.areBinariesAvailable = areBinariesAvailable;
exports.getCommand = getCommand;
exports.canUseLibimobiledevice = canUseLibimobiledevice;
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
/**
 * List of required executable names for libimobiledevice functionality
 */
exports.REQUIRED_EXECUTABLES = [
    'idevice_id',
    'ideviceinfo',
    'idevicebackup2',
];
/**
 * Check if running in mock mode for development without actual device
 */
function isMockMode() {
    return process.env.MOCK_DEVICE === 'true';
}
/**
 * Get the base path to the libimobiledevice binaries directory
 * @returns The absolute path to the libimobiledevice binaries directory
 * @throws Error if not running on Windows
 */
function getLibimobiledevicePath() {
    if (process.platform !== 'win32') {
        throw new Error('libimobiledevice binaries only available on Windows');
    }
    const isDev = !electron_1.app.isPackaged;
    if (isDev) {
        return path_1.default.join(__dirname, '../../resources/win/libimobiledevice');
    }
    return path_1.default.join(process.resourcesPath, 'win/libimobiledevice');
}
/**
 * Get the full path to a specific libimobiledevice executable
 * @param name - The name of the executable (without .exe extension)
 * @returns The absolute path to the executable
 * @throws Error if not running on Windows
 */
function getExecutablePath(name) {
    const basePath = getLibimobiledevicePath();
    const exePath = path_1.default.join(basePath, `${name}.exe`);
    electron_log_1.default.debug(`[libimobiledeviceService] Resolved executable path: ${exePath}`);
    return exePath;
}
/**
 * Check if libimobiledevice binaries are available
 * @returns True if binaries directory exists and contains expected files
 */
function areBinariesAvailable() {
    if (process.platform !== 'win32') {
        return false;
    }
    try {
        const basePath = getLibimobiledevicePath();
        const fs = require('fs');
        return fs.existsSync(basePath);
    }
    catch (error) {
        electron_log_1.default.error('[libimobiledeviceService] Error checking binaries availability:', error);
        return false;
    }
}
/**
 * Get the command to execute for a libimobiledevice tool
 * On Windows, returns the full path. On other platforms, returns command name for PATH lookup.
 * @param name - Name of the executable (e.g., 'idevice_id', 'idevicebackup2')
 * @returns Command string suitable for spawn/exec
 */
function getCommand(name) {
    if (process.platform === 'win32') {
        try {
            return getExecutablePath(name);
        }
        catch {
            // Fall through to return just the name
            return name;
        }
    }
    // On macOS/Linux, tools are expected to be in PATH
    return name;
}
/**
 * Check if we can use libimobiledevice commands
 * Returns true in mock mode or if platform is supported
 */
function canUseLibimobiledevice() {
    if (isMockMode()) {
        return true;
    }
    if (process.platform === 'win32') {
        return areBinariesAvailable();
    }
    // On macOS/Linux, assume commands are available in PATH
    // (actual availability will be checked at runtime)
    return true;
}
