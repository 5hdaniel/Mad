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

/**
 * Register all system and permission-related IPC handlers
 */
export function registerSystemHandlers(): void {
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
      console.error('[Main] Failed to open external URL:', error);
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
      console.error('[Main] Failed to open support email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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
      console.error('[Main] Failed to get diagnostics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}
