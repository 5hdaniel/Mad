// ============================================
// SYSTEM & PERMISSION IPC HANDLERS
// Permission checks, connection status, system health
// ============================================

const { ipcMain } = require('electron');
const permissionService = require('./services/permissionService');
const connectionStatusService = require('./services/connectionStatusService');

/**
 * Register all system and permission-related IPC handlers
 */
function registerSystemHandlers() {
  // ===== PERMISSION CHECKS =====

  /**
   * Check Full Disk Access permission
   */
  ipcMain.handle('system:check-full-disk-access', async () => {
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
  ipcMain.handle('system:check-contacts-permission', async () => {
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
  ipcMain.handle('system:check-all-permissions', async () => {
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
  ipcMain.handle('system:check-google-connection', async (event, userId) => {
    try {
      const result = await connectionStatusService.checkGoogleConnection(userId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] Google connection check failed:', error);
      return {
        success: false,
        connected: false,
        error: {
          type: 'CHECK_FAILED',
          userMessage: 'Could not check Gmail connection',
          details: error.message,
        },
      };
    }
  });

  /**
   * Check Microsoft OAuth connection
   */
  ipcMain.handle('system:check-microsoft-connection', async (event, userId) => {
    try {
      const result = await connectionStatusService.checkMicrosoftConnection(userId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] Microsoft connection check failed:', error);
      return {
        success: false,
        connected: false,
        error: {
          type: 'CHECK_FAILED',
          userMessage: 'Could not check Outlook connection',
          details: error.message,
        },
      };
    }
  });

  /**
   * Check all OAuth connections
   */
  ipcMain.handle('system:check-all-connections', async (event, userId) => {
    try {
      const result = await connectionStatusService.checkAllConnections(userId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('[Main] All connections check failed:', error);
      return {
        success: false,
        error: {
          type: 'CHECK_FAILED',
          userMessage: 'Could not check email connections',
          details: error.message,
        },
      };
    }
  });

  /**
   * Get system health status (all checks combined)
   */
  ipcMain.handle('system:health-check', async (event, userId) => {
    try {
      const [permissions, connections] = await Promise.all([
        permissionService.checkAllPermissions(),
        userId ? connectionStatusService.checkAllConnections(userId) : null,
      ]);

      const issues = [];

      // Add permission issues
      if (!permissions.allGranted) {
        issues.push(...permissions.errors);
      }

      // Add connection issues
      if (connections) {
        if (connections.google.error) {
          issues.push({
            type: 'OAUTH_CONNECTION',
            provider: 'google',
            ...connections.google.error,
          });
        }
        if (connections.microsoft.error) {
          issues.push({
            type: 'OAUTH_CONNECTION',
            provider: 'microsoft',
            ...connections.microsoft.error,
          });
        }
      }

      return {
        success: true,
        healthy: issues.length === 0,
        permissions,
        connections,
        issues,
        summary: {
          totalIssues: issues.length,
          criticalIssues: issues.filter((i) => i.severity === 'error').length,
          warnings: issues.filter((i) => i.severity === 'warning').length,
        },
      };
    } catch (error) {
      console.error('[Main] System health check failed:', error);
      return {
        success: false,
        healthy: false,
        error: {
          type: 'HEALTH_CHECK_FAILED',
          userMessage: 'Could not check system status',
          details: error.message,
        },
      };
    }
  });
}

module.exports = {
  registerSystemHandlers,
};
