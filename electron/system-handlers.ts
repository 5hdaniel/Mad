// ============================================
// SYSTEM & PERMISSION IPC HANDLERS
// Permission checks, connection status, system health
// ============================================

import { ipcMain, shell } from 'electron';
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

// Import logging service
import logService from './services/logService';

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

// Guard to prevent multiple concurrent initializations
let isInitializing = false;
let initializationComplete = false;
let handlersRegistered = false;

/**
 * Register all system and permission-related IPC handlers
 */
export function registerSystemHandlers(): void {
  // Prevent double registration (can happen during hot-reload or app reactivation)
  if (handlersRegistered) {
    logService.warn('System handlers already registered, skipping duplicate registration', 'SystemHandlers');
    return;
  }
  handlersRegistered = true;

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Secure storage status check failed', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        available: false,
        platform: os.platform(),
        error: errorMessage,
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
    // If already initialized, return immediately
    if (initializationComplete) {
      logService.debug('Database already initialized, skipping', 'SystemHandlers');
      return {
        success: true,
        available: true,
        platform: os.platform(),
      };
    }

    // If initialization is in progress, wait for it to complete
    if (isInitializing) {
      logService.debug('Database initialization already in progress, waiting...', 'SystemHandlers');
      // Wait for current initialization to complete (poll every 100ms)
      let waitCount = 0;
      while (isInitializing && waitCount < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      return {
        success: initializationComplete,
        available: initializationComplete,
        platform: os.platform(),
        error: initializationComplete ? undefined : 'Initialization timeout',
      };
    }

    isInitializing = true;
    try {
      // Initialize database - this triggers keychain prompt for db encryption key
      await initializeDatabase();
      logService.info('Database initialized with encryption', 'SystemHandlers');

      // Session-only OAuth: Clear all sessions and OAuth tokens
      // This forces users to re-authenticate each app launch for better security
      await databaseService.clearAllSessions();
      await databaseService.clearAllOAuthTokens();
      logService.info('Cleared sessions and OAuth tokens for session-only OAuth', 'SystemHandlers');

      initializationComplete = true;
      return {
        success: true,
        available: true,
        platform: os.platform(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Database initialization failed. Please try again.';
      logService.error('Database initialization failed', 'SystemHandlers', { error: errorMessage });
      const platform = os.platform();
      return {
        success: false,
        available: false,
        platform,
        guidance: getSecureStorageGuidance(platform),
        error: errorMessage,
      };
    } finally {
      isInitializing = false;
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Key store check failed', 'SystemHandlers', { error: errorMessage });
      return { success: false, hasKeyStore: false };
    }
  });

  /**
   * Initialize the database after secure storage setup
   * This should be called after the user has authorized keychain access
   */
  ipcMain.handle('system:initialize-database', async (): Promise<SystemResponse> => {
    // If already initialized, return immediately
    if (initializationComplete) {
      logService.debug('Database already initialized via secure storage, skipping', 'SystemHandlers');
      return { success: true };
    }

    // If initialization is in progress, wait for it
    if (isInitializing) {
      logService.debug('Database initialization already in progress, waiting...', 'SystemHandlers');
      let waitCount = 0;
      while (isInitializing && waitCount < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      return {
        success: initializationComplete,
        error: initializationComplete ? undefined : 'Initialization timeout',
      };
    }

    isInitializing = true;
    try {
      await initializeDatabase();
      initializationComplete = true;
      logService.info('Database initialized successfully', 'SystemHandlers');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Database initialization failed', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      isInitializing = false;
    }
  });

  /**
   * Check if the database is initialized
   * Used to determine if we can perform database operations (e.g., save user after OAuth)
   */
  ipcMain.handle('system:is-database-initialized', async (): Promise<{ success: boolean; initialized: boolean }> => {
    try {
      const initialized = databaseService.isInitialized();
      return { success: true, initialized };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Database initialization check failed', 'SystemHandlers', { error: errorMessage });
      return { success: false, initialized: false };
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Permission setup failed', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Contacts permission request failed', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Full Disk Access setup failed', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to open privacy pane', 'SystemHandlers', { error: errorMessage });
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Full Disk Access status check failed', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        granted: false,
        error: errorMessage,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Full Disk Access check failed', 'SystemHandlers', { error: errorMessage });
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Contacts permission check failed', 'SystemHandlers', { error: errorMessage });
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('All permissions check failed', 'SystemHandlers', { error: errorMessage });
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Google connection check failed', 'SystemHandlers', { error: errorMessage });
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Microsoft connection check failed', 'SystemHandlers', { error: errorMessage });
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('All connections check failed', 'SystemHandlers', { error: errorMessage });
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

      // Skip permission checks on Windows (macOS-only features)
      const isMacOS = os.platform() === 'darwin';

      const [permissions, connection, contactsLoading] = await Promise.all([
        isMacOS ? permissionService.checkAllPermissions() : { allGranted: true, permissions: {}, errors: [] },
        validatedUserId && validatedProvider ? (
          validatedProvider === 'google'
            ? connectionStatusService.checkGoogleConnection(validatedUserId)
            : connectionStatusService.checkMicrosoftConnection(validatedUserId)
        ) : null,
        isMacOS ? permissionService.checkContactsLoading() : { canLoadContacts: true, contactCount: 0 },
      ]);

      const issues: unknown[] = [];

      // Add permission issues
      if (!permissions.allGranted) {
        issues.push(...permissions.errors);
      }

      // Add contacts loading issue
      if (!contactsLoading.canLoadContacts && contactsLoading.error) {
        issues.push(contactsLoading.error);
      }

      // Add connection issue (only for the provider the user logged in with)
      if (connection && connection.error) {
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
          criticalIssues: issues.filter((i) => (i as { severity?: string }).severity === 'error').length,
          warnings: issues.filter((i) => (i as { severity?: string }).severity === 'warning').length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('System health check failed', 'SystemHandlers', { error: errorMessage });
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
          details: errorMessage,
        },
      };
    }
  });

  // ===== SUPPORT & EXTERNAL LINKS =====

  /**
   * Open external URL in default browser
   */
  ipcMain.handle('shell:open-external', async (event: IpcMainInvokeEvent, url: string): Promise<SystemResponse> => {
    try {
      // Validate URL
      const validatedUrl = validateString(url, 'url', {
        required: true,
        maxLength: 2000,
      });

      if (!validatedUrl) {
        return {
          success: false,
          error: 'URL is required',
        };
      }

      // Only allow safe protocols
      const allowedProtocols = ['https:', 'http:', 'mailto:'];
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(validatedUrl);
      } catch {
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }

      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return {
          success: false,
          error: `Protocol not allowed: ${parsedUrl.protocol}`,
        };
      }

      await shell.openExternal(validatedUrl);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to open external URL', 'SystemHandlers', { error: errorMessage });
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  /**
   * Open support email with pre-filled content
   */
  ipcMain.handle('system:contact-support', async (event: IpcMainInvokeEvent, errorDetails?: string): Promise<SystemResponse> => {
    try {
      const supportEmail = 'magicauditwa@gmail.com';
      const subject = encodeURIComponent('Magic Audit Support Request');
      const body = encodeURIComponent(
        `Hi Magic Audit Support,\n\n` +
        `I need help with:\n\n` +
        `${errorDetails ? `Error details: ${errorDetails}\n\n` : ''}` +
        `Thank you for your assistance.\n`
      );

      const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
      await shell.openExternal(mailtoUrl);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to open support email', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  // ===== USER PHONE TYPE PREFERENCES =====

  /**
   * Get user's mobile phone type preference
   * @param userId - User ID to get phone type for
   * @returns Phone type ('iphone' | 'android' | null)
   */
  ipcMain.handle('user:get-phone-type', async (event: IpcMainInvokeEvent, userId: string): Promise<{ success: boolean; phoneType: 'iphone' | 'android' | null; error?: string }> => {
    try {
      const validatedUserId = validateUserId(userId);
      // validateUserId throws when required (default), so validatedUserId is never null here
      const user = await databaseService.getUserById(validatedUserId!);

      if (!user) {
        return { success: true, phoneType: null };
      }

      return {
        success: true,
        phoneType: user.mobile_phone_type as 'iphone' | 'android' | null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to get user phone type', 'SystemHandlers', { error: errorMessage });
      if (error instanceof ValidationError) {
        return { success: false, phoneType: null, error: `Validation error: ${error.message}` };
      }
      return { success: false, phoneType: null, error: errorMessage };
    }
  });

  /**
   * Set user's mobile phone type preference
   * @param userId - User ID to set phone type for
   * @param phoneType - Phone type to set ('iphone' | 'android')
   */
  ipcMain.handle('user:set-phone-type', async (event: IpcMainInvokeEvent, userId: string, phoneType: 'iphone' | 'android'): Promise<{ success: boolean; error?: string }> => {
    try {
      const validatedUserId = validateUserId(userId);

      // Validate phone type
      if (phoneType !== 'iphone' && phoneType !== 'android') {
        return { success: false, error: 'Invalid phone type. Must be "iphone" or "android"' };
      }

      // validateUserId throws when required (default), so validatedUserId is never null here
      await databaseService.updateUser(validatedUserId!, { mobile_phone_type: phoneType });
      logService.info(`Updated phone type for user ${validatedUserId} to ${phoneType}`, 'SystemHandlers');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to set user phone type', 'SystemHandlers', { error: errorMessage });
      if (error instanceof ValidationError) {
        return { success: false, error: `Validation error: ${error.message}` };
      }
      return { success: false, error: errorMessage };
    }
  });

  /**
   * Get diagnostic information for support requests
   */
  ipcMain.handle('system:get-diagnostics', async (): Promise<{ success: boolean; diagnostics?: string; error?: string }> => {
    try {
      const { app } = require('electron');
      const os = require('os');

      const diagnostics = {
        app: {
          version: app.getVersion(),
          name: app.getName(),
          locale: app.getLocale(),
        },
        system: {
          platform: process.platform,
          arch: process.arch,
          osVersion: os.release(),
          osType: os.type(),
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
        },
        memory: {
          total: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
          free: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
        },
        timestamp: new Date().toISOString(),
      };

      const diagnosticString = Object.entries(diagnostics)
        .map(([category, values]) => {
          if (typeof values === 'object') {
            const items = Object.entries(values as Record<string, unknown>)
              .map(([key, val]) => `  ${key}: ${val}`)
              .join('\n');
            return `${category.toUpperCase()}:\n${items}`;
          }
          return `${category}: ${values}`;
        })
        .join('\n\n');

      return { success: true, diagnostics: diagnosticString };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to get diagnostics', 'SystemHandlers', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  });
}
