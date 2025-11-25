/**
 * Unit tests for Permission Service
 */

import permissionService from '../permissionService';
import { promises as fs } from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    constants: {
      R_OK: 4,
    },
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PermissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    permissionService.clearCache();
  });

  describe('checkFullDiskAccess', () => {
    it('should return hasPermission: true when file is accessible', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await permissionService.checkFullDiskAccess();

      expect(result.hasPermission).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return hasPermission: false when access denied', async () => {
      (mockFs.access as jest.Mock).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await permissionService.checkFullDiskAccess();

      expect(result.hasPermission).toBe(false);
      expect(result.error).toBe('EACCES: permission denied');
      expect(result.errorCode).toBe('FULL_DISK_ACCESS_DENIED');
      expect(result.userMessage).toContain('Full Disk Access');
      expect(result.action).toContain('System Settings');
    });

    it('should cache permission result', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      await permissionService.checkFullDiskAccess();

      const cached = permissionService.getCachedPermissions();
      expect(cached).not.toBeNull();
      expect(cached?.fullDiskAccess).toBe(true);
    });
  });

  describe('checkContactsPermission', () => {
    it('should return hasPermission: true when contacts accessible', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await permissionService.checkContactsPermission();

      expect(result.hasPermission).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return hasPermission: false when contacts access denied', async () => {
      (mockFs.access as jest.Mock).mockRejectedValue(new Error('EPERM: operation not permitted'));

      const result = await permissionService.checkContactsPermission();

      expect(result.hasPermission).toBe(false);
      expect(result.error).toBe('EPERM: operation not permitted');
      expect(result.errorCode).toBe('CONTACTS_ACCESS_DENIED');
      expect(result.userMessage).toContain('Contacts');
    });

    it('should cache permission result', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      await permissionService.checkContactsPermission();

      const cached = permissionService.getCachedPermissions();
      expect(cached?.contacts).toBe(true);
    });
  });

  describe('checkAllPermissions', () => {
    it('should return allGranted: true when all permissions granted', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await permissionService.checkAllPermissions();

      expect(result.allGranted).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.permissions.fullDiskAccess?.hasPermission).toBe(true);
      expect(result.permissions.contacts?.hasPermission).toBe(true);
    });

    it('should return allGranted: false when any permission denied', async () => {
      // First call succeeds (fullDiskAccess), second fails (contacts)
      (mockFs.access as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('EACCES'));

      const result = await permissionService.checkAllPermissions();

      expect(result.allGranted).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should collect all permission errors', async () => {
      (mockFs.access as jest.Mock).mockRejectedValue(new Error('EACCES'));

      const result = await permissionService.checkAllPermissions();

      expect(result.errors.length).toBe(2); // Both permissions denied
    });
  });

  describe('getCachedPermissions', () => {
    it('should return null when no cache exists', () => {
      const cached = permissionService.getCachedPermissions();
      expect(cached).toBeNull();
    });

    it('should return cached permissions within maxAge', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      await permissionService.checkFullDiskAccess();

      const cached = permissionService.getCachedPermissions(5000);
      expect(cached).not.toBeNull();
      expect(cached?.fullDiskAccess).toBe(true);
    });

    it('should return null when cache is expired', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      await permissionService.checkFullDiskAccess();

      // Wait a bit and use very small maxAge to force expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      const cached = permissionService.getCachedPermissions(1); // 1ms maxAge
      expect(cached).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached permissions', async () => {
      (mockFs.access as jest.Mock).mockResolvedValue(undefined);

      await permissionService.checkFullDiskAccess();
      await permissionService.checkContactsPermission();

      expect(permissionService.getCachedPermissions()).not.toBeNull();

      permissionService.clearCache();

      expect(permissionService.getCachedPermissions()).toBeNull();
    });
  });

  describe('getPermissionError', () => {
    it('should return PERMISSION_DENIED for EACCES errors', () => {
      const error = new Error('EACCES: permission denied');

      const result = permissionService.getPermissionError(error);

      expect(result.type).toBe('PERMISSION_DENIED');
      expect(result.title).toBe('Permission Required');
      expect(result.severity).toBe('error');
      expect(result.actionHandler).toBe('open-system-settings');
    });

    it('should return PERMISSION_DENIED for EPERM errors', () => {
      const error = new Error('EPERM: operation not permitted');

      const result = permissionService.getPermissionError(error);

      expect(result.type).toBe('PERMISSION_DENIED');
    });

    it('should return MESSAGES_NOT_FOUND for messages ENOENT errors', () => {
      const error = new Error('ENOENT: no such file or directory messages');

      const result = permissionService.getPermissionError(error);

      expect(result.type).toBe('MESSAGES_NOT_FOUND');
      expect(result.title).toBe('Messages Database Not Found');
      expect(result.actionHandler).toBe('open-messages-app');
    });

    it('should return DATABASE_ERROR for sqlite errors', () => {
      const error = new Error('SQLITE_CANTOPEN: unable to open database file');

      const result = permissionService.getPermissionError(error);

      expect(result.type).toBe('DATABASE_ERROR');
      expect(result.title).toBe('Database Error');
    });

    it('should return DATABASE_ERROR for database errors', () => {
      const error = new Error('database is locked');

      const result = permissionService.getPermissionError(error);

      expect(result.type).toBe('DATABASE_ERROR');
    });

    it('should return UNKNOWN_ERROR for unrecognized errors', () => {
      const error = new Error('Something completely unexpected');

      const result = permissionService.getPermissionError(error);

      expect(result.type).toBe('UNKNOWN_ERROR');
      expect(result.title).toBe('An Error Occurred');
      expect(result.actionHandler).toBe('retry');
    });
  });
});
