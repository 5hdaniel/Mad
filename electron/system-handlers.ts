// ============================================
// SYSTEM & PERMISSION IPC HANDLERS
// Permission checks, connection status, system health
// ============================================

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

// Import services (TypeScript with default exports)
const permissionService = require('./services/permissionService').default;
const connectionStatusService = require('./services/connectionStatusService').default;
const macOSPermissionHelper = require('./services/macOSPermissionHelper').default;
import { databaseEncryptionService } from './services/databaseEncryptionService';
import databaseService from './services/databaseService';
import { initializeDatabase } from './auth-handlers';
import os from 'os';

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  validateString,
  validateProvider,
} from './utils/validation';

// Type definitions
interface SystemResponse {
  success: boolean;
  error?: string | {
    type: string;
    userMessage: string;
    details?: string;
  };
}

interface PermissionResponse extends SystemResponse {
  hasPermission?: boolean;
  granted?: boolean;
  overallSuccess?: boolean;
}

interface ConnectionResponse extends SystemResponse {
  connected?: boolean;
  error?: {
    type: string;
    userMessage: string;
    details?: string;
  };
}

interface HealthCheckResponse extends SystemResponse {
  healthy?: boolean;
  permissions?: unknown;
  connection?: unknown;
  contactsLoading?: unknown;
  issues?: unknown[];
  summary?: {
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
  };
}

interface SecureStorageResponse extends SystemResponse {
  available: boolean;
  platform?: string;
  guidance?: string;
}

/**
 * Get user-friendly error message for secure storage unavailability
 */
function getSecureStorageErrorMessage(platform: string): string {
  switch (platform) {
    case 'darwin':
      return 'Could not access macOS Keychain. Please click "Allow" when prompted, or check your Keychain Access settings.';
    case 'win32':
      return 'Could not access Windows credential storage. Please try restarting the application.';
    case 'linux':
      return 'Could not access secure storage. Please ensure gnome-keyring or KWallet is installed and running.';
    default:
      return 'Secure storage is not available on your system.';
  }
}

/**
 * Get platform-specific guidance for resolving secure storage issues
 */
function getSecureStorageGuidance(platform: string): string {
  switch (platform) {
    case 'darwin':
      return `To enable secure storage on macOS:
1. When the Keychain Access prompt appears, click "Allow" or "Always Allow"
2. If you clicked "Deny", you may need to:
   - Open Keychain Access (in Applications > Utilities)
   - Find "magic-audit Safe Storage"
   - Right-click and select "Delete"
   - Then restart Magic Audit and click "Allow"`;
    case 'win32':
      return `Windows should automatically provide secure storage via DPAPI.
If you're seeing this error:
1. Try restarting the application
2. Run as administrator if the issue persists
3. Check Windows Event Viewer for credential-related errors`;
    case 'linux':
      return `Linux requires a secret service to be running:
1. Install gnome-keyring: sudo apt install gnome-keyring
2. Ensure it's running: eval $(gnome-keyring-daemon --start --components=secrets)
3. Or install KWallet if using KDE: sudo apt install kwalletmanager`;
    default:
      return 'Please ensure your operating system\'s credential storage service is available and running.';
  }
}

/**
 * Register all system and permission-related IPC handlers
 */
export function registerSystemHandlers(): void {
  // ===== SECURE STORAGE (KEYCHAIN) SETUP =====

  /**
   * Get secure storage status without triggering keychain prompt
   * Now checks database encryption status (session-only OAuth, no token encryption)
   */
  ipcMain.handle('system:get-secure-storage-status', async (): Promise<SecureStorageResponse> => {
    try {
      // Check if database encryption key store exists (file check, no keychain prompt)
      const hasKeyStore = databaseEncryptionService.hasKeyStore();
      return {
        success: true,
        available: hasKeyStore,
        platform: os.platform(),
      };
    } catch (error) {
      console.error('[Main] Secure storage status check failed:', error);
      return {
        success: false,
        available: false,
        platform: os.platform(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Initialize secure storage (database only)
   *
   * Since we use session-only OAuth (tokens not persisted), we only need
   * to initialize the database encryption. This triggers ONE keychain prompt
   * for the database encryption key.
   *
   * OAuth tokens are kept in memory only - users login each session.
   * This is more secure and avoids multiple keychain prompts.
   */
  ipcMain.handle('system:initialize-secure-storage', async (): Promise<SecureStorageResponse> => {
    try {
      // Initialize database - this triggers keychain prompt for db encryption key
      await initializeDatabase();
      console.log('[Main] Database initialized with encryption');

      // Session-only OAuth: Clear all sessions and OAuth tokens
      // This forces users to re-authenticate each app launch for better security
      await databaseService.clearAllSessions();
      await databaseService.clearAllOAuthTokens();
      console.log('[Main] Cleared sessions and OAuth tokens for session-only OAuth');

      return {
        success: true,
        available: true,
        platform: os.platform(),
      };
    } catch (error) {
      console.error('[Main] Database initialization failed:', error);
      const platform = os.platform();
      return {
        success: false,
        available: false,
        platform,
        guidance: getSecureStorageGuidance(platform),
        error: error instanceof Error ? error.message : 'Database initialization failed. Please try again.',
      };
    }
  });

  /**
   * Check if the database encryption key store exists
   * Used to determine if this is a new user (needs secure storage setup) vs returning user
   */
  ipcMain.handle('system:has-encryption-key-store', async (): Promise<{ success: boolean; hasKeyStore: boolean }> => {
    try {
      const hasKeyStore = databaseEncryptionService.hasKeyStore();
      return { success: true, hasKeyStore };
    } catch (error) {
      console.error('[Main] Key store check failed:', error);
      return { success: false, hasKeyStore: false };
    }
  });

  /**
   * Initialize the database after secure storage setup
   * This should be called after the user has authorized keychain access
   */
  ipcMain.handle('system:initialize-database', async (): Promise<SystemResponse> => {
    try {
      await initializeDatabase();
      return { success: true };
    } catch (error) {
      console.error('[Main] Database initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ===== PERMISSION SETUP (ONBOARDING) =====

  /**
   * Run permission setup flow (contacts + full disk access)
   */
  ipcMain.handle('system:run-permission-setup', async (): Promise<SystemResponse> => {
    try {
      const result = await macOSPermissionHelper.runPermissionSetupFlow();
      return {
        success: result.overallSuccess,
        ...result,
      };
    } catch (error) {
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
  ipcMain.handle('system:request-contacts-permission', async (): Promise<SystemResponse> => {
    try {
      const result = await macOSPermissionHelper.requestContactsPermission();
      return result;
    } catch (error) {
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
  ipcMain.handle('system:setup-full-disk-access', async (): Promise<SystemResponse> => {
    try {
      const result = await macOSPermissionHelper.setupFullDiskAccess();
      return result;
    } catch (error) {
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
  ipcMain.handle('system:open-privacy-pane', async (event: IpcMainInvokeEvent, pane: string): Promise<SystemResponse> => {
    try {
      // Validate pane parameter
      const validatedPane = validateString(pane, 'pane', {
        required: true,
        maxLength: 100,
      });

      const result = await macOSPermissionHelper.openPrivacyPane(validatedPane);
      return result;
    } catch (error) {
      console.error('[Main] Failed to open privacy pane:', error);
      if (error instanceof ValidationError) {
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
  ipcMain.handle('system:check-full-disk-access-status', async (): Promise<PermissionResponse> => {
    try {
      const result = await macOSPermissionHelper.checkFullDiskAccessStatus();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
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
  ipcMain.handle('system:check-full-disk-access', async (): Promise<PermissionResponse> => {
    try {
      const result = await permissionService.checkFullDiskAccess();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
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
  ipcMain.handle('system:check-contacts-permission', async (): Promise<PermissionResponse> => {
    try {
      const result = await permissionService.checkContactsPermission();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
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
  ipcMain.handle('system:check-all-permissions', async (): Promise<SystemResponse> => {
    try {
      const result = await permissionService.checkAllPermissions();
      return {
        success: true,
        ...result,
      };
    } catch (error) {
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
  ipcMain.handle('system:check-google-connection', async (event: IpcMainInvokeEvent, userId: string): Promise<ConnectionResponse> => {
    try {
      // Validate input
      const validatedUserId = validateUserId(userId);

      const result = await connectionStatusService.checkGoogleConnection(validatedUserId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] Google connection check failed:', error);
      if (error instanceof ValidationError) {
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
  ipcMain.handle('system:check-microsoft-connection', async (event: IpcMainInvokeEvent, userId: string): Promise<ConnectionResponse> => {
    try {
      // Validate input
      const validatedUserId = validateUserId(userId);

      const result = await connectionStatusService.checkMicrosoftConnection(validatedUserId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] Microsoft connection check failed:', error);
      if (error instanceof ValidationError) {
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
  ipcMain.handle('system:check-all-connections', async (event: IpcMainInvokeEvent, userId: string): Promise<SystemResponse> => {
    try {
      // Validate input
      const validatedUserId = validateUserId(userId);

      const result = await connectionStatusService.checkAllConnections(validatedUserId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] All connections check failed:', error);
      if (error instanceof ValidationError) {
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
  ipcMain.handle('system:health-check', async (event: IpcMainInvokeEvent, userId: string | null = null, provider: string | null = null): Promise<HealthCheckResponse> => {
    try {
      // Validate inputs (both optional)
      const validatedUserId = userId ? validateUserId(userId) : null;
      const validatedProvider = provider ? validateProvider(provider) : null;

      console.log('[Main] Health check called with userId:', validatedUserId, 'provider:', validatedProvider);

      const [permissions, connection, contactsLoading] = await Promise.all([
        permissionService.checkAllPermissions(),
        validatedUserId && validatedProvider ? (
          validatedProvider === 'google'
            ? connectionStatusService.checkGoogleConnection(validatedUserId)
            : connectionStatusService.checkMicrosoftConnection(validatedUserId)
        ) : null,
        permissionService.checkContactsLoading(),
      ]);

      console.log('[Main] Connection check result:', connection);
      console.log('[Main] Contacts loading check result:', contactsLoading);

      const issues: unknown[] = [];

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
          criticalIssues: issues.filter((i: any) => i.severity === 'error').length,
          warnings: issues.filter((i: any) => i.severity === 'warning').length,
        },
      };
    } catch (error) {
      console.error('[Main] System health check failed:', error);
      if (error instanceof ValidationError) {
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
