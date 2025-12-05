/**
 * Unit tests for System Handlers
 * Tests system and permission IPC handlers including:
 * - Permission setup and checks
 * - OAuth connection status
 * - System health monitoring
 */

import type { IpcMainInvokeEvent } from 'electron';

// Mock electron module
const mockIpcHandle = jest.fn();
const mockShellOpenExternal = jest.fn();

jest.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-user-data'),
  },
  shell: {
    openExternal: mockShellOpenExternal,
  },
}));

// Mock services
const mockPermissionService = {
  checkFullDiskAccess: jest.fn(),
  checkContactsPermission: jest.fn(),
  checkAllPermissions: jest.fn(),
  checkContactsLoading: jest.fn(),
  getPermissionError: jest.fn().mockImplementation((error: Error) => ({
    type: 'PERMISSION_ERROR',
    userMessage: error.message,
  })),
};

const mockConnectionStatusService = {
  checkGoogleConnection: jest.fn(),
  checkMicrosoftConnection: jest.fn(),
  checkAllConnections: jest.fn(),
};

const mockMacOSPermissionHelper = {
  runPermissionSetupFlow: jest.fn(),
  requestContactsPermission: jest.fn(),
  setupFullDiskAccess: jest.fn(),
  openPrivacyPane: jest.fn(),
  checkFullDiskAccessStatus: jest.fn(),
};

jest.mock('../services/permissionService', () => ({
  default: mockPermissionService,
}));

jest.mock('../services/databaseService', () => ({
  __esModule: true,
  default: {
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    isInitialized: jest.fn().mockReturnValue(true),
    clearAllSessions: jest.fn(),
    clearAllOAuthTokens: jest.fn(),
  },
}));

jest.mock('../services/databaseEncryptionService', () => ({
  databaseEncryptionService: {
    hasKeyStore: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../services/logService', () => ({
  __esModule: true,
  default: {
    info: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../auth-handlers', () => ({
  initializeDatabase: jest.fn(),
}));

// Import after mocks
import databaseService from '../services/databaseService';
const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;

jest.mock('../services/connectionStatusService', () => ({
  default: mockConnectionStatusService,
}));

jest.mock('../services/macOSPermissionHelper', () => ({
  default: mockMacOSPermissionHelper,
}));

// Import after mocks are set up
import { registerSystemHandlers } from '../system-handlers';

// Test UUIDs
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('System Handlers', () => {
  let registeredHandlers: Map<string, Function>;
  const mockEvent = {} as IpcMainInvokeEvent;

  beforeAll(() => {
    // Capture registered handlers
    registeredHandlers = new Map();
    mockIpcHandle.mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    // Register all handlers
    registerSystemHandlers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Permission Setup (Onboarding)', () => {
    describe('system:run-permission-setup', () => {
      it('should run permission setup flow successfully', async () => {
        mockMacOSPermissionHelper.runPermissionSetupFlow.mockResolvedValue({
          overallSuccess: true,
          contacts: { granted: true },
          fullDiskAccess: { granted: true },
        });

        const handler = registeredHandlers.get('system:run-permission-setup');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.overallSuccess).toBe(true);
      });

      it('should handle partial permission grant', async () => {
        mockMacOSPermissionHelper.runPermissionSetupFlow.mockResolvedValue({
          overallSuccess: false,
          contacts: { granted: true },
          fullDiskAccess: { granted: false },
        });

        const handler = registeredHandlers.get('system:run-permission-setup');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.overallSuccess).toBe(false);
      });

      it('should handle setup failure', async () => {
        mockMacOSPermissionHelper.runPermissionSetupFlow.mockRejectedValue(
          new Error('Setup failed')
        );

        const handler = registeredHandlers.get('system:run-permission-setup');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Setup failed');
      });
    });

    describe('system:request-contacts-permission', () => {
      it('should request contacts permission successfully', async () => {
        mockMacOSPermissionHelper.requestContactsPermission.mockResolvedValue({
          success: true,
          granted: true,
        });

        const handler = registeredHandlers.get('system:request-contacts-permission');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.granted).toBe(true);
      });

      it('should handle permission denial', async () => {
        mockMacOSPermissionHelper.requestContactsPermission.mockResolvedValue({
          success: true,
          granted: false,
        });

        const handler = registeredHandlers.get('system:request-contacts-permission');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.granted).toBe(false);
      });

      it('should handle request failure', async () => {
        mockMacOSPermissionHelper.requestContactsPermission.mockRejectedValue(
          new Error('Request failed')
        );

        const handler = registeredHandlers.get('system:request-contacts-permission');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Request failed');
      });
    });

    describe('system:setup-full-disk-access', () => {
      it('should open System Preferences for Full Disk Access', async () => {
        mockMacOSPermissionHelper.setupFullDiskAccess.mockResolvedValue({
          success: true,
        });

        const handler = registeredHandlers.get('system:setup-full-disk-access');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
      });

      it('should handle setup failure', async () => {
        mockMacOSPermissionHelper.setupFullDiskAccess.mockRejectedValue(
          new Error('Could not open System Preferences')
        );

        const handler = registeredHandlers.get('system:setup-full-disk-access');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Could not open');
      });
    });

    describe('system:open-privacy-pane', () => {
      it('should open specific privacy pane', async () => {
        mockMacOSPermissionHelper.openPrivacyPane.mockResolvedValue({
          success: true,
        });

        const handler = registeredHandlers.get('system:open-privacy-pane');
        const result = await handler(mockEvent, 'Contacts');

        expect(result.success).toBe(true);
        expect(mockMacOSPermissionHelper.openPrivacyPane).toHaveBeenCalledWith('Contacts');
      });

      it('should handle invalid pane parameter', async () => {
        const handler = registeredHandlers.get('system:open-privacy-pane');
        const result = await handler(mockEvent, '');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation error');
      });

      it('should handle open failure', async () => {
        mockMacOSPermissionHelper.openPrivacyPane.mockRejectedValue(
          new Error('Pane not found')
        );

        const handler = registeredHandlers.get('system:open-privacy-pane');
        const result = await handler(mockEvent, 'InvalidPane');

        expect(result.success).toBe(false);
      });
    });

    describe('system:check-full-disk-access-status', () => {
      it('should return full disk access status', async () => {
        mockMacOSPermissionHelper.checkFullDiskAccessStatus.mockResolvedValue({
          granted: true,
        });

        const handler = registeredHandlers.get('system:check-full-disk-access-status');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.granted).toBe(true);
      });

      it('should handle check failure', async () => {
        mockMacOSPermissionHelper.checkFullDiskAccessStatus.mockRejectedValue(
          new Error('Check failed')
        );

        const handler = registeredHandlers.get('system:check-full-disk-access-status');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.granted).toBe(false);
      });
    });
  });

  describe('Permission Checks', () => {
    describe('system:check-full-disk-access', () => {
      it('should return true when permission is granted', async () => {
        mockPermissionService.checkFullDiskAccess.mockResolvedValue({
          hasPermission: true,
        });

        const handler = registeredHandlers.get('system:check-full-disk-access');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.hasPermission).toBe(true);
      });

      it('should return false when permission is denied', async () => {
        mockPermissionService.checkFullDiskAccess.mockResolvedValue({
          hasPermission: false,
        });

        const handler = registeredHandlers.get('system:check-full-disk-access');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.hasPermission).toBe(false);
      });

      it('should handle check failure', async () => {
        mockPermissionService.checkFullDiskAccess.mockRejectedValue(
          new Error('Permission check failed')
        );

        const handler = registeredHandlers.get('system:check-full-disk-access');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.hasPermission).toBe(false);
        expect(mockPermissionService.getPermissionError).toHaveBeenCalled();
      });
    });

    describe('system:check-contacts-permission', () => {
      it('should return true when permission is granted', async () => {
        mockPermissionService.checkContactsPermission.mockResolvedValue({
          hasPermission: true,
        });

        const handler = registeredHandlers.get('system:check-contacts-permission');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.hasPermission).toBe(true);
      });

      it('should handle check failure', async () => {
        mockPermissionService.checkContactsPermission.mockRejectedValue(
          new Error('Permission check failed')
        );

        const handler = registeredHandlers.get('system:check-contacts-permission');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
        expect(result.hasPermission).toBe(false);
      });
    });

    describe('system:check-all-permissions', () => {
      it('should return all permissions status', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: true,
          fullDiskAccess: { hasPermission: true },
          contacts: { hasPermission: true },
          errors: [],
        });

        const handler = registeredHandlers.get('system:check-all-permissions');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.allGranted).toBe(true);
      });

      it('should handle partial permissions', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: false,
          fullDiskAccess: { hasPermission: true },
          contacts: { hasPermission: false },
          errors: ['Contacts permission not granted'],
        });

        const handler = registeredHandlers.get('system:check-all-permissions');
        const result = await handler(mockEvent);

        expect(result.success).toBe(true);
        expect(result.allGranted).toBe(false);
      });

      it('should handle check failure', async () => {
        mockPermissionService.checkAllPermissions.mockRejectedValue(
          new Error('Check failed')
        );

        const handler = registeredHandlers.get('system:check-all-permissions');
        const result = await handler(mockEvent);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('Connection Status', () => {
    describe('system:check-google-connection', () => {
      it('should return connected status for valid user', async () => {
        mockConnectionStatusService.checkGoogleConnection.mockResolvedValue({
          connected: true,
          email: 'user@gmail.com',
        });

        const handler = registeredHandlers.get('system:check-google-connection');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.connected).toBe(true);
      });

      it('should handle invalid user ID', async () => {
        const handler = registeredHandlers.get('system:check-google-connection');
        const result = await handler(mockEvent, '');

        expect(result.success).toBe(false);
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('VALIDATION_ERROR');
      });

      it('should handle connection check failure', async () => {
        mockConnectionStatusService.checkGoogleConnection.mockRejectedValue(
          new Error('Connection check failed')
        );

        const handler = registeredHandlers.get('system:check-google-connection');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(false);
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('CHECK_FAILED');
      });
    });

    describe('system:check-microsoft-connection', () => {
      it('should return connected status for valid user', async () => {
        mockConnectionStatusService.checkMicrosoftConnection.mockResolvedValue({
          connected: true,
          email: 'user@outlook.com',
        });

        const handler = registeredHandlers.get('system:check-microsoft-connection');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.connected).toBe(true);
      });

      it('should handle invalid user ID', async () => {
        const handler = registeredHandlers.get('system:check-microsoft-connection');
        const result = await handler(mockEvent, '');

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe('VALIDATION_ERROR');
      });

      it('should handle connection check failure', async () => {
        mockConnectionStatusService.checkMicrosoftConnection.mockRejectedValue(
          new Error('Connection check failed')
        );

        const handler = registeredHandlers.get('system:check-microsoft-connection');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe('CHECK_FAILED');
      });
    });

    describe('system:check-all-connections', () => {
      it('should return all connection statuses', async () => {
        mockConnectionStatusService.checkAllConnections.mockResolvedValue({
          google: { connected: true },
          microsoft: { connected: false },
        });

        const handler = registeredHandlers.get('system:check-all-connections');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.google.connected).toBe(true);
        expect(result.microsoft.connected).toBe(false);
      });

      it('should handle invalid user ID', async () => {
        const handler = registeredHandlers.get('system:check-all-connections');
        const result = await handler(mockEvent, '');

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('Health Check', () => {
    describe('system:health-check', () => {
      it('should return healthy status when all checks pass', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: true,
          errors: [],
        });
        mockConnectionStatusService.checkGoogleConnection.mockResolvedValue({
          connected: true,
        });
        mockPermissionService.checkContactsLoading.mockResolvedValue({
          canLoadContacts: true,
        });

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, TEST_USER_ID, 'google');

        expect(result.success).toBe(true);
        expect(result.healthy).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should report permission issues', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: false,
          errors: [{ type: 'PERMISSION_MISSING', message: 'Full Disk Access required' }],
        });
        mockPermissionService.checkContactsLoading.mockResolvedValue({
          canLoadContacts: true,
        });

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, null, null);

        expect(result.success).toBe(true);
        expect(result.healthy).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
      });

      it('should report connection issues for Google', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: true,
          errors: [],
        });
        mockConnectionStatusService.checkGoogleConnection.mockResolvedValue({
          connected: false,
          error: { type: 'TOKEN_EXPIRED', userMessage: 'Token expired' },
        });
        mockPermissionService.checkContactsLoading.mockResolvedValue({
          canLoadContacts: true,
        });

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, TEST_USER_ID, 'google');

        expect(result.success).toBe(true);
        expect(result.healthy).toBe(false);
        // The issue type matches the error type from the connection check
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            type: 'TOKEN_EXPIRED',
            provider: 'google',
          })
        );
      });

      it('should report connection issues for Microsoft', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: true,
          errors: [],
        });
        mockConnectionStatusService.checkMicrosoftConnection.mockResolvedValue({
          connected: false,
          error: { type: 'TOKEN_EXPIRED', userMessage: 'Token expired' },
        });
        mockPermissionService.checkContactsLoading.mockResolvedValue({
          canLoadContacts: true,
        });

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, TEST_USER_ID, 'microsoft');

        expect(result.success).toBe(true);
        expect(result.healthy).toBe(false);
        // The issue type matches the error type from the connection check
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            type: 'TOKEN_EXPIRED',
            provider: 'microsoft',
          })
        );
      });

      it('should report contacts loading issues', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: true,
          errors: [],
        });
        mockPermissionService.checkContactsLoading.mockResolvedValue({
          canLoadContacts: false,
          error: { type: 'CONTACTS_UNAVAILABLE', message: 'Cannot load contacts' },
        });

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, null, null);

        expect(result.success).toBe(true);
        expect(result.healthy).toBe(false);
      });

      it('should handle invalid user ID', async () => {
        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, 'invalid', 'google');

        // Should fail validation since invalid isn't a proper UUID
        expect(result.success).toBe(false);
        expect(result.healthy).toBe(false);
        expect(result.error?.type).toBe('VALIDATION_ERROR');
      });

      it('should handle invalid provider', async () => {
        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, TEST_USER_ID, 'invalid-provider');

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe('VALIDATION_ERROR');
      });

      it('should handle health check failure', async () => {
        mockPermissionService.checkAllPermissions.mockRejectedValue(
          new Error('Health check failed')
        );

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, null, null);

        expect(result.success).toBe(false);
        expect(result.healthy).toBe(false);
        expect(result.error?.type).toBe('HEALTH_CHECK_FAILED');
      });

      it('should include summary of issues', async () => {
        mockPermissionService.checkAllPermissions.mockResolvedValue({
          allGranted: false,
          errors: [
            { type: 'ERROR', severity: 'error', message: 'Critical issue' },
            { type: 'WARNING', severity: 'warning', message: 'Minor issue' },
          ],
        });
        mockPermissionService.checkContactsLoading.mockResolvedValue({
          canLoadContacts: true,
        });

        const handler = registeredHandlers.get('system:health-check');
        const result = await handler(mockEvent, null, null);

        expect(result.success).toBe(true);
        expect(result.summary).toBeDefined();
        expect(result.summary.totalIssues).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('User Phone Type Preferences', () => {
    describe('user:get-phone-type', () => {
      it('should return phone type for user with iphone', async () => {
        mockDatabaseService.getUserById.mockResolvedValue({
          id: TEST_USER_ID,
          mobile_phone_type: 'iphone',
        });

        const handler = registeredHandlers.get('user:get-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.phoneType).toBe('iphone');
        expect(mockDatabaseService.getUserById).toHaveBeenCalledWith(TEST_USER_ID);
      });

      it('should return phone type for user with android', async () => {
        mockDatabaseService.getUserById.mockResolvedValue({
          id: TEST_USER_ID,
          mobile_phone_type: 'android',
        });

        const handler = registeredHandlers.get('user:get-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.phoneType).toBe('android');
      });

      it('should return null phone type when user has not selected', async () => {
        mockDatabaseService.getUserById.mockResolvedValue({
          id: TEST_USER_ID,
          mobile_phone_type: null,
        });

        const handler = registeredHandlers.get('user:get-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.phoneType).toBe(null);
      });

      it('should return null phone type when user not found', async () => {
        mockDatabaseService.getUserById.mockResolvedValue(null);

        const handler = registeredHandlers.get('user:get-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(true);
        expect(result.phoneType).toBe(null);
      });

      it('should handle invalid user ID', async () => {
        const handler = registeredHandlers.get('user:get-phone-type');
        const result = await handler(mockEvent, '');

        expect(result.success).toBe(false);
        expect(result.phoneType).toBe(null);
        expect(result.error).toContain('Validation error');
      });

      it('should handle database errors', async () => {
        mockDatabaseService.getUserById.mockRejectedValue(
          new Error('Database connection failed')
        );

        const handler = registeredHandlers.get('user:get-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID);

        expect(result.success).toBe(false);
        expect(result.phoneType).toBe(null);
        expect(result.error).toContain('Database connection failed');
      });
    });

    describe('user:set-phone-type', () => {
      it('should set phone type to iphone', async () => {
        mockDatabaseService.updateUser.mockResolvedValue(undefined);

        const handler = registeredHandlers.get('user:set-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID, 'iphone');

        expect(result.success).toBe(true);
        expect(mockDatabaseService.updateUser).toHaveBeenCalledWith(
          TEST_USER_ID,
          { mobile_phone_type: 'iphone' }
        );
      });

      it('should set phone type to android', async () => {
        mockDatabaseService.updateUser.mockResolvedValue(undefined);

        const handler = registeredHandlers.get('user:set-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID, 'android');

        expect(result.success).toBe(true);
        expect(mockDatabaseService.updateUser).toHaveBeenCalledWith(
          TEST_USER_ID,
          { mobile_phone_type: 'android' }
        );
      });

      it('should reject invalid phone type', async () => {
        const handler = registeredHandlers.get('user:set-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID, 'blackberry');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid phone type');
        expect(mockDatabaseService.updateUser).not.toHaveBeenCalled();
      });

      it('should handle invalid user ID', async () => {
        const handler = registeredHandlers.get('user:set-phone-type');
        const result = await handler(mockEvent, '', 'iphone');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation error');
        expect(mockDatabaseService.updateUser).not.toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
        mockDatabaseService.updateUser.mockRejectedValue(
          new Error('Database update failed')
        );

        const handler = registeredHandlers.get('user:set-phone-type');
        const result = await handler(mockEvent, TEST_USER_ID, 'iphone');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Database update failed');
      });
    });
  });

  describe('Shell Operations', () => {
    describe('shell:open-external', () => {
      beforeEach(() => {
        mockShellOpenExternal.mockReset();
      });

      it('should open valid HTTPS URL', async () => {
        mockShellOpenExternal.mockResolvedValue(undefined);

        const handler = registeredHandlers.get('shell:open-external');
        const result = await handler(mockEvent, 'https://example.com');

        expect(result.success).toBe(true);
        expect(mockShellOpenExternal).toHaveBeenCalledWith('https://example.com');
      });

      it('should open valid HTTP URL', async () => {
        mockShellOpenExternal.mockResolvedValue(undefined);

        const handler = registeredHandlers.get('shell:open-external');
        const result = await handler(mockEvent, 'http://example.com');

        expect(result.success).toBe(true);
        expect(mockShellOpenExternal).toHaveBeenCalledWith('http://example.com');
      });

      it('should open valid mailto URL', async () => {
        mockShellOpenExternal.mockResolvedValue(undefined);

        const handler = registeredHandlers.get('shell:open-external');
        const result = await handler(mockEvent, 'mailto:test@example.com');

        expect(result.success).toBe(true);
        expect(mockShellOpenExternal).toHaveBeenCalledWith('mailto:test@example.com');
      });

      it('should reject javascript URLs', async () => {
        const handler = registeredHandlers.get('shell:open-external');
        const result = await handler(mockEvent, 'javascript:alert(1)');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Protocol not allowed');
        expect(mockShellOpenExternal).not.toHaveBeenCalled();
      });

      it('should reject file URLs', async () => {
        const handler = registeredHandlers.get('shell:open-external');
        const result = await handler(mockEvent, 'file:///etc/passwd');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Protocol not allowed');
        expect(mockShellOpenExternal).not.toHaveBeenCalled();
      });

      it('should handle shell open failure', async () => {
        mockShellOpenExternal.mockRejectedValue(new Error('Shell error'));

        const handler = registeredHandlers.get('shell:open-external');
        const result = await handler(mockEvent, 'https://example.com');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Shell error');
      });
    });
  });
});
