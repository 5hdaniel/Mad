"use strict";
/**
 * Backup IPC Handlers
 *
 * Handles IPC communication between the renderer process and the backup service.
 * Provides backup operations for iPhone data extraction.
 * Includes encrypted backup support (TASK-007).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupService = void 0;
exports.registerBackupHandlers = registerBackupHandlers;
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
const backupService_1 = require("./services/backupService");
Object.defineProperty(exports, "backupService", { enumerable: true, get: function () { return backupService_1.backupService; } });
const backupDecryptionService_1 = require("./services/backupDecryptionService");
/**
 * Register all backup-related IPC handlers
 * @param mainWindow The main BrowserWindow instance for sending events
 */
function registerBackupHandlers(mainWindow) {
    electron_log_1.default.info('[BackupHandlers] Registering backup handlers');
    // Forward progress events to renderer
    backupService_1.backupService.on('progress', (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backup:progress', progress);
        }
    });
    // Forward completion events to renderer
    backupService_1.backupService.on('complete', (result) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backup:complete', result);
        }
    });
    // Forward error events to renderer
    backupService_1.backupService.on('error', (error) => {
        electron_log_1.default.error('[BackupHandlers] Backup error:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backup:error', { message: error.message });
        }
    });
    // Forward password-required events to renderer (TASK-007)
    backupService_1.backupService.on('password-required', (data) => {
        electron_log_1.default.info('[BackupHandlers] Password required for device:', data.udid);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('backup:password-required', data);
        }
    });
    /**
     * Get backup capabilities
     * Returns information about what the backup system can do
     */
    electron_1.ipcMain.handle('backup:capabilities', async () => {
        try {
            return await backupService_1.backupService.checkCapabilities();
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Error getting capabilities:', error);
            return {
                supportsDomainFiltering: false,
                supportsIncremental: true,
                supportsSkipApps: true,
                supportsEncryption: true,
                availableDomains: []
            };
        }
    });
    /**
     * Get current backup status
     */
    electron_1.ipcMain.handle('backup:status', () => {
        return backupService_1.backupService.getStatus();
    });
    /**
     * Check if a device requires encrypted backup (TASK-007)
     * @param udid Device UDID
     */
    electron_1.ipcMain.handle('backup:check-encryption', async (_, udid) => {
        electron_log_1.default.info('[BackupHandlers] Checking encryption status for device:', udid);
        try {
            if (!udid) {
                throw new Error('Device UDID is required');
            }
            const encryptionInfo = await backupService_1.backupService.checkEncryptionStatus(udid);
            return {
                success: true,
                isEncrypted: encryptionInfo.isEncrypted,
                needsPassword: encryptionInfo.needsPassword
            };
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Error checking encryption:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Start a backup operation
     * @param options BackupOptions with device UDID and optional settings
     */
    electron_1.ipcMain.handle('backup:start', async (_, options) => {
        electron_log_1.default.info('[BackupHandlers] Starting backup for device:', options.udid);
        try {
            // Validate options
            if (!options.udid) {
                throw new Error('Device UDID is required');
            }
            const result = await backupService_1.backupService.startBackup(options);
            electron_log_1.default.info('[BackupHandlers] Backup completed:', {
                success: result.success,
                duration: result.duration,
                size: result.backupSize,
                isIncremental: result.isIncremental,
                isEncrypted: result.isEncrypted
            });
            return result;
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Backup failed:', error);
            return {
                success: false,
                backupPath: null,
                error: error.message,
                duration: 0,
                deviceUdid: options.udid,
                isIncremental: false,
                backupSize: 0
            };
        }
    });
    /**
     * Start a backup with password (for encrypted backups) (TASK-007)
     * @param options BackupOptions including password
     */
    electron_1.ipcMain.handle('backup:start-with-password', async (_, options) => {
        electron_log_1.default.info('[BackupHandlers] Starting encrypted backup for device:', options.udid);
        try {
            if (!options.udid) {
                throw new Error('Device UDID is required');
            }
            if (!options.password) {
                throw new Error('Password is required for encrypted backup');
            }
            const result = await backupService_1.backupService.startBackup(options);
            // Clear password from options after use
            options.password = '';
            electron_log_1.default.info('[BackupHandlers] Encrypted backup completed:', {
                success: result.success,
                duration: result.duration,
                size: result.backupSize,
                isEncrypted: result.isEncrypted
            });
            return result;
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Encrypted backup failed:', error);
            return {
                success: false,
                backupPath: null,
                error: error.message,
                duration: 0,
                deviceUdid: options.udid,
                isIncremental: false,
                backupSize: 0
            };
        }
    });
    /**
     * Verify a backup password without starting backup (TASK-007)
     */
    electron_1.ipcMain.handle('backup:verify-password', async (_, backupPath, password) => {
        electron_log_1.default.info('[BackupHandlers] Verifying password for backup:', backupPath);
        try {
            if (!backupPath) {
                throw new Error('Backup path is required');
            }
            if (!password) {
                throw new Error('Password is required');
            }
            const isValid = await backupDecryptionService_1.backupDecryptionService.verifyPassword(backupPath, password);
            return {
                success: true,
                valid: isValid
            };
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Password verification failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Check if an existing backup is encrypted (TASK-007)
     */
    electron_1.ipcMain.handle('backup:is-encrypted', async (_, backupPath) => {
        electron_log_1.default.info('[BackupHandlers] Checking if backup is encrypted:', backupPath);
        try {
            if (!backupPath) {
                throw new Error('Backup path is required');
            }
            const isEncrypted = await backupDecryptionService_1.backupDecryptionService.isBackupEncrypted(backupPath);
            return {
                success: true,
                isEncrypted
            };
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Encryption check failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    /**
     * Cancel an in-progress backup
     */
    electron_1.ipcMain.handle('backup:cancel', () => {
        electron_log_1.default.info('[BackupHandlers] Cancelling backup');
        backupService_1.backupService.cancelBackup();
        return { success: true };
    });
    /**
     * List all existing backups
     */
    electron_1.ipcMain.handle('backup:list', async () => {
        try {
            return await backupService_1.backupService.listBackups();
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Error listing backups:', error);
            return [];
        }
    });
    /**
     * Delete a specific backup
     * @param backupPath Path to the backup to delete
     */
    electron_1.ipcMain.handle('backup:delete', async (_, backupPath) => {
        electron_log_1.default.info('[BackupHandlers] Deleting backup:', backupPath);
        try {
            await backupService_1.backupService.deleteBackup(backupPath);
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Error deleting backup:', error);
            return { success: false, error: error.message };
        }
    });
    /**
     * Clean up old backups
     * @param keepCount Number of backups to keep per device
     */
    electron_1.ipcMain.handle('backup:cleanup', async (_, keepCount = 1) => {
        electron_log_1.default.info('[BackupHandlers] Cleaning up old backups, keeping:', keepCount);
        try {
            await backupService_1.backupService.cleanupOldBackups(keepCount);
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Error cleaning up backups:', error);
            return { success: false, error: error.message };
        }
    });
    /**
     * Clean up decrypted files after extraction (TASK-007)
     */
    electron_1.ipcMain.handle('backup:cleanup-decrypted', async (_, backupPath) => {
        electron_log_1.default.info('[BackupHandlers] Cleaning up decrypted files:', backupPath);
        try {
            await backupService_1.backupService.cleanupDecryptedFiles(backupPath);
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error('[BackupHandlers] Error cleaning up decrypted files:', error);
            return { success: false, error: error.message };
        }
    });
    // Clean up running backup on app quit
    electron_1.app.on('before-quit', () => {
        const status = backupService_1.backupService.getStatus();
        if (status.isRunning) {
            electron_log_1.default.info('[BackupHandlers] App quitting, cancelling running backup');
            backupService_1.backupService.cancelBackup();
        }
    });
    electron_log_1.default.info('[BackupHandlers] Backup handlers registered');
}
