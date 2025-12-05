"use strict";
/**
 * Sync IPC Handlers
 *
 * Handles IPC communication between renderer and main process
 * for iPhone sync operations on Windows.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSyncHandlers = registerSyncHandlers;
exports.cleanupSyncHandlers = cleanupSyncHandlers;
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const syncOrchestrator_1 = require("./services/syncOrchestrator");
let orchestrator = null;
let mainWindowRef = null;
/**
 * Send event to renderer process
 */
function sendToRenderer(channel, data) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(channel, data);
    }
}
/**
 * Register sync-related IPC handlers
 */
function registerSyncHandlers(mainWindow) {
    mainWindowRef = mainWindow;
    orchestrator = syncOrchestrator_1.syncOrchestrator;
    // Set up event forwarding to renderer
    setupEventForwarding();
    // Start sync operation
    electron_1.ipcMain.handle('sync:start', async (_, options) => {
        electron_log_1.default.info('[SyncHandlers] Starting sync', { udid: options.udid });
        try {
            const result = await orchestrator.sync(options);
            return result;
        }
        catch (error) {
            electron_log_1.default.error('[SyncHandlers] Sync error', { error });
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
    electron_1.ipcMain.handle('sync:cancel', () => {
        electron_log_1.default.info('[SyncHandlers] Cancelling sync');
        orchestrator?.cancel();
        return { success: true };
    });
    // Get current sync status
    electron_1.ipcMain.handle('sync:status', () => {
        return orchestrator?.getStatus() || { isRunning: false, phase: 'idle' };
    });
    // Get connected devices
    electron_1.ipcMain.handle('sync:devices', () => {
        return orchestrator?.getConnectedDevices() || [];
    });
    // Start device detection polling
    electron_1.ipcMain.handle('sync:start-detection', (_, intervalMs) => {
        electron_log_1.default.info('[SyncHandlers] Starting device detection');
        orchestrator?.startDeviceDetection(intervalMs);
        return { success: true };
    });
    // Stop device detection polling
    electron_1.ipcMain.handle('sync:stop-detection', () => {
        electron_log_1.default.info('[SyncHandlers] Stopping device detection');
        orchestrator?.stopDeviceDetection();
        return { success: true };
    });
    electron_log_1.default.info('[SyncHandlers] Registered sync IPC handlers');
}
/**
 * Set up event forwarding from orchestrator to renderer
 */
function setupEventForwarding() {
    if (!orchestrator)
        return;
    // Forward progress events
    orchestrator.on('progress', (progress) => {
        sendToRenderer('sync:progress', progress);
    });
    // Forward phase changes
    orchestrator.on('phase', (phase) => {
        sendToRenderer('sync:phase', phase);
    });
    // Forward device events
    orchestrator.on('device-connected', (device) => {
        electron_log_1.default.info('[SyncHandlers] Device connected', { name: device.name, udid: device.udid });
        sendToRenderer('sync:device-connected', device);
    });
    orchestrator.on('device-disconnected', (device) => {
        electron_log_1.default.info('[SyncHandlers] Device disconnected', { name: device.name, udid: device.udid });
        sendToRenderer('sync:device-disconnected', device);
    });
    // Forward password required event
    orchestrator.on('password-required', () => {
        electron_log_1.default.info('[SyncHandlers] Password required for encrypted backup');
        sendToRenderer('sync:password-required', {});
    });
    // Forward error events
    orchestrator.on('error', (error) => {
        electron_log_1.default.error('[SyncHandlers] Sync error event', { error: error.message });
        sendToRenderer('sync:error', { message: error.message });
    });
    // Forward completion events
    orchestrator.on('complete', (result) => {
        electron_log_1.default.info('[SyncHandlers] Sync complete', {
            conversations: result.conversations.length,
            messages: result.messages.length,
        });
        sendToRenderer('sync:complete', result);
    });
}
/**
 * Cleanup sync handlers
 */
function cleanupSyncHandlers() {
    if (orchestrator) {
        orchestrator.stopDeviceDetection();
        orchestrator.removeAllListeners();
    }
    orchestrator = null;
    mainWindowRef = null;
    // Remove IPC handlers
    electron_1.ipcMain.removeHandler('sync:start');
    electron_1.ipcMain.removeHandler('sync:cancel');
    electron_1.ipcMain.removeHandler('sync:status');
    electron_1.ipcMain.removeHandler('sync:devices');
    electron_1.ipcMain.removeHandler('sync:start-detection');
    electron_1.ipcMain.removeHandler('sync:stop-detection');
    electron_log_1.default.info('[SyncHandlers] Cleaned up sync handlers');
}
