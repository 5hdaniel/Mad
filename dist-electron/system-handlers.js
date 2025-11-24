"use strict";
// ============================================
// SYSTEM & PERMISSION IPC HANDLERS
// Permission checks, connection status, system health
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemHandlers = registerSystemHandlers;
const electron_1 = require("electron");
// Import services (TypeScript with default exports)
const permissionService = require('./services/permissionService').default;
const connectionStatusService = require('./services/connectionStatusService').default;
const macOSPermissionHelper = require('./services/macOSPermissionHelper').default;
// Import validation utilities
const validation_1 = require("./utils/validation");
/**
 * Register all system and permission-related IPC handlers
 */
function registerSystemHandlers() {
    // ===== PERMISSION SETUP (ONBOARDING) =====
    /**
     * Run permission setup flow (contacts + full disk access)
     */
    electron_1.ipcMain.handle('system:run-permission-setup', async () => {
        try {
            const result = await macOSPermissionHelper.runPermissionSetupFlow();
            return {
                success: result.overallSuccess,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Permission setup failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    /**
     * Request Contacts permission
     */
    electron_1.ipcMain.handle('system:request-contacts-permission', async () => {
        try {
            const result = await macOSPermissionHelper.requestContactsPermission();
            return result;
        }
        catch (error) {
            console.error('[Main] Contacts permission request failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    /**
     * Setup Full Disk Access (opens System Preferences)
     */
    electron_1.ipcMain.handle('system:setup-full-disk-access', async () => {
        try {
            const result = await macOSPermissionHelper.setupFullDiskAccess();
            return result;
        }
        catch (error) {
            console.error('[Main] Full Disk Access setup failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    /**
     * Open specific privacy pane in System Preferences
     */
    electron_1.ipcMain.handle('system:open-privacy-pane', async (event, pane) => {
        try {
            // Validate pane parameter
            const validatedPane = (0, validation_1.validateString)(pane, 'pane', {
                required: true,
                maxLength: 100,
            });
            const result = await macOSPermissionHelper.openPrivacyPane(validatedPane);
            return result;
        }
        catch (error) {
            console.error('[Main] Failed to open privacy pane:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    /**
     * Check Full Disk Access status
     */
    electron_1.ipcMain.handle('system:check-full-disk-access-status', async () => {
        try {
            const result = await macOSPermissionHelper.checkFullDiskAccessStatus();
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Full Disk Access status check failed:', error);
            return {
                success: false,
                granted: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ===== PERMISSION CHECKS =====
    /**
     * Check Full Disk Access permission
     */
    electron_1.ipcMain.handle('system:check-full-disk-access', async () => {
        try {
            const result = await permissionService.checkFullDiskAccess();
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Full Disk Access check failed:', error);
            return {
                success: false,
                hasPermission: false,
                error: permissionService.getPermissionError(error),
            };
        }
    });
    /**
     * Check Contacts permission
     */
    electron_1.ipcMain.handle('system:check-contacts-permission', async () => {
        try {
            const result = await permissionService.checkContactsPermission();
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Contacts permission check failed:', error);
            return {
                success: false,
                hasPermission: false,
                error: permissionService.getPermissionError(error),
            };
        }
    });
    /**
     * Check all required permissions
     */
    electron_1.ipcMain.handle('system:check-all-permissions', async () => {
        try {
            const result = await permissionService.checkAllPermissions();
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] All permissions check failed:', error);
            return {
                success: false,
                error: permissionService.getPermissionError(error),
            };
        }
    });
    // ===== CONNECTION STATUS =====
    /**
     * Check Google OAuth connection
     */
    electron_1.ipcMain.handle('system:check-google-connection', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const result = await connectionStatusService.checkGoogleConnection(validatedUserId);
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Google connection check failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    connected: false,
                    error: {
                        type: 'VALIDATION_ERROR',
                        userMessage: 'Invalid user ID',
                        details: error.message,
                    },
                };
            }
            return {
                success: false,
                connected: false,
                error: {
                    type: 'CHECK_FAILED',
                    userMessage: 'Could not check Gmail connection',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    });
    /**
     * Check Microsoft OAuth connection
     */
    electron_1.ipcMain.handle('system:check-microsoft-connection', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const result = await connectionStatusService.checkMicrosoftConnection(validatedUserId);
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] Microsoft connection check failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    connected: false,
                    error: {
                        type: 'VALIDATION_ERROR',
                        userMessage: 'Invalid user ID',
                        details: error.message,
                    },
                };
            }
            return {
                success: false,
                connected: false,
                error: {
                    type: 'CHECK_FAILED',
                    userMessage: 'Could not check Outlook connection',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    });
    /**
     * Check all OAuth connections
     */
    electron_1.ipcMain.handle('system:check-all-connections', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const result = await connectionStatusService.checkAllConnections(validatedUserId);
            return {
                success: true,
                ...result,
            };
        }
        catch (error) {
            console.error('[Main] All connections check failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: {
                        type: 'VALIDATION_ERROR',
                        userMessage: 'Invalid user ID',
                        details: error.message,
                    },
                };
            }
            return {
                success: false,
                error: {
                    type: 'CHECK_FAILED',
                    userMessage: 'Could not check email connections',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    });
    /**
     * Get system health status (all checks combined)
     */
    electron_1.ipcMain.handle('system:health-check', async (event, userId = null, provider = null) => {
        try {
            // Validate inputs (both optional)
            const validatedUserId = userId ? (0, validation_1.validateUserId)(userId) : null;
            const validatedProvider = provider ? (0, validation_1.validateProvider)(provider) : null;
            console.log('[Main] Health check called with userId:', validatedUserId, 'provider:', validatedProvider);
            const [permissions, connection, contactsLoading] = await Promise.all([
                permissionService.checkAllPermissions(),
                validatedUserId && validatedProvider ? (validatedProvider === 'google'
                    ? connectionStatusService.checkGoogleConnection(validatedUserId)
                    : connectionStatusService.checkMicrosoftConnection(validatedUserId)) : null,
                permissionService.checkContactsLoading(),
            ]);
            console.log('[Main] Connection check result:', connection);
            console.log('[Main] Contacts loading check result:', contactsLoading);
            const issues = [];
            // Add permission issues
            if (!permissions.allGranted) {
                issues.push(...permissions.errors);
            }
            // Add contacts loading issue
            if (!contactsLoading.canLoadContacts && contactsLoading.error) {
                console.log('[Main] Adding contacts loading issue');
                issues.push(contactsLoading.error);
            }
            // Add connection issue (only for the provider the user logged in with)
            if (connection && connection.error) {
                console.log('[Main] Adding connection issue for provider:', validatedProvider);
                issues.push({
                    type: 'OAUTH_CONNECTION',
                    provider: validatedProvider,
                    ...connection.error,
                });
            }
            return {
                success: true,
                healthy: issues.length === 0,
                permissions,
                connection,
                contactsLoading,
                issues,
                summary: {
                    totalIssues: issues.length,
                    criticalIssues: issues.filter((i) => i.severity === 'error').length,
                    warnings: issues.filter((i) => i.severity === 'warning').length,
                },
            };
        }
        catch (error) {
            console.error('[Main] System health check failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    healthy: false,
                    error: {
                        type: 'VALIDATION_ERROR',
                        userMessage: 'Invalid input parameters',
                        details: error.message,
                    },
                };
            }
            return {
                success: false,
                healthy: false,
                error: {
                    type: 'HEALTH_CHECK_FAILED',
                    userMessage: 'Could not check system status',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    });
}
