/**
 * Permission Service Tests
 * Tests macOS permission checking and caching
 */

const PermissionService = require('../permissionService');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
  },
  constants: {
    R_OK: 4,
  },
}));

jest.mock('path');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
  },
}));

describe('PermissionService', () => {
  let permissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    path.join = jest.fn((...args) => args.join('/'));
    process.env.HOME = '/Users/test';
    permissionService = new PermissionService();
  });

  describe('checkFullDiskAccess', () => {
    it('should return true when Messages database is accessible', async () => {
      fs.access.mockResolvedValue();

      const result = await permissionService.checkFullDiskAccess();

      expect(result.hasPermission).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining('Library/Messages/chat.db'),
        fs.constants.R_OK
      );
    });

    it('should return false when Messages database is not accessible', async () => {
      fs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await permissionService.checkFullDiskAccess();

      expect(result.hasPermission).toBe(false);
      expect(result.errorCode).toBe('FULL_DISK_ACCESS_DENIED');
      expect(result.userMessage).toContain('Full Disk Access');
      expect(result.action).toBeDefined();
    });

    it('should cache successful permission check', async () => {
      fs.access.mockResolvedValue();

      await permissionService.checkFullDiskAccess();

      expect(permissionService.permissionCache.fullDiskAccess).toBe(true);
      expect(permissionService.permissionCache.cachedAt).toBeDefined();
    });

    it('should cache failed permission check', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      await permissionService.checkFullDiskAccess();

      expect(permissionService.permissionCache.fullDiskAccess).toBe(false);
      expect(permissionService.permissionCache.cachedAt).toBeDefined();
    });

    it('should update cache timestamp on each check', async () => {
      fs.access.mockResolvedValue();

      await permissionService.checkFullDiskAccess();
      const firstTimestamp = permissionService.permissionCache.cachedAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await permissionService.checkFullDiskAccess();
      const secondTimestamp = permissionService.permissionCache.cachedAt;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
    });
  });

  describe('checkContactsPermission', () => {
    it('should return true when Contacts directory is accessible', async () => {
      fs.access.mockResolvedValue();

      const result = await permissionService.checkContactsPermission();

      expect(result.hasPermission).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(
        expect.stringContaining('Library/Application Support/AddressBook'),
        fs.constants.R_OK
      );
    });

    it('should return false when Contacts directory is not accessible', async () => {
      fs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await permissionService.checkContactsPermission();

      expect(result.hasPermission).toBe(false);
      expect(result.errorCode).toBe('CONTACTS_ACCESS_DENIED');
      expect(result.userMessage).toContain('Contacts permission');
      expect(result.action).toContain('Full Disk Access');
    });

    it('should cache contacts permission check', async () => {
      fs.access.mockResolvedValue();

      await permissionService.checkContactsPermission();

      expect(permissionService.permissionCache.contacts).toBe(true);
      expect(permissionService.permissionCache.cachedAt).toBeDefined();
    });

    it('should provide helpful action message', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await permissionService.checkContactsPermission();

      expect(result.action).toContain('System Settings');
      expect(result.action).toContain('Privacy & Security');
    });
  });

  describe('checkContactsLoading', () => {
    beforeEach(() => {
      // Mock contactsService
      jest.mock('../contactsService', () => ({
        getContactNames: jest.fn(),
      }));
    });

    it('should return success when contacts load successfully', async () => {
      const { getContactNames } = require('../contactsService');
      getContactNames.mockResolvedValue({
        contactMap: {
          '+15551234567': 'John Doe',
          '+15559876543': 'Jane Smith',
        },
        phoneToContactInfo: {},
        status: {
          success: true,
          contactCount: 2,
        },
      });

      const result = await permissionService.checkContactsLoading();

      expect(result.canLoadContacts).toBe(true);
      expect(result.contactCount).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('should return error when contacts fail to load', async () => {
      const { getContactNames } = require('../contactsService');
      getContactNames.mockResolvedValue({
        contactMap: {},
        phoneToContactInfo: {},
        status: {
          success: false,
          error: 'Permission denied',
          userMessage: 'Could not load contacts',
          action: 'Grant Full Disk Access',
        },
      });

      const result = await permissionService.checkContactsLoading();

      expect(result.canLoadContacts).toBe(false);
      expect(result.contactCount).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error.type).toBe('CONTACTS_LOADING_FAILED');
    });

    it('should return warning when no contacts found', async () => {
      const { getContactNames } = require('../contactsService');
      getContactNames.mockResolvedValue({
        contactMap: {},
        phoneToContactInfo: {},
        status: {
          success: true,
          contactCount: 0,
        },
      });

      const result = await permissionService.checkContactsLoading();

      expect(result.canLoadContacts).toBe(false);
      expect(result.contactCount).toBe(0);
      expect(result.error.type).toBe('NO_CONTACTS_FOUND');
      expect(result.error.severity).toBe('warning');
    });

    it('should handle exceptions gracefully', async () => {
      const { getContactNames } = require('../contactsService');
      getContactNames.mockRejectedValue(new Error('Database error'));

      const result = await permissionService.checkContactsLoading();

      expect(result.canLoadContacts).toBe(false);
      expect(result.error.type).toBe('CONTACTS_CHECK_FAILED');
    });

    it('should provide actionable error information', async () => {
      const { getContactNames } = require('../contactsService');
      getContactNames.mockResolvedValue({
        contactMap: {},
        phoneToContactInfo: {},
        status: {
          success: false,
          error: 'Permission denied',
        },
      });

      const result = await permissionService.checkContactsLoading();

      expect(result.error.actionHandler).toBe('open-system-settings');
      expect(result.error.action).toBeDefined();
    });
  });

  describe('checkAllPermissions', () => {
    it('should check both Full Disk Access and Contacts', async () => {
      fs.access.mockResolvedValue();

      const result = await permissionService.checkAllPermissions();

      expect(result.fullDiskAccess).toBeDefined();
      expect(result.contacts).toBeDefined();
    });

    it('should return all permission statuses', async () => {
      fs.access.mockResolvedValue();

      const result = await permissionService.checkAllPermissions();

      expect(result.fullDiskAccess.hasPermission).toBeDefined();
      expect(result.contacts.hasPermission).toBeDefined();
      expect(result.allGranted).toBeDefined();
    });

    it('should set allGranted to true when all permissions granted', async () => {
      fs.access.mockResolvedValue();

      const result = await permissionService.checkAllPermissions();

      expect(result.allGranted).toBe(true);
    });

    it('should set allGranted to false when any permission denied', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await permissionService.checkAllPermissions();

      expect(result.allGranted).toBe(false);
    });
  });

  describe('permission cache', () => {
    it('should initialize cache as empty', () => {
      const service = new PermissionService();

      expect(service.permissionCache.fullDiskAccess).toBeNull();
      expect(service.permissionCache.contacts).toBeNull();
      expect(service.permissionCache.cachedAt).toBeNull();
    });

    it('should update cache on permission checks', async () => {
      fs.access.mockResolvedValue();

      await permissionService.checkFullDiskAccess();

      expect(permissionService.permissionCache.fullDiskAccess).toBe(true);
      expect(permissionService.permissionCache.cachedAt).toBeGreaterThan(0);
    });

    it('should track separate permissions independently', async () => {
      // Full Disk Access granted
      fs.access.mockResolvedValueOnce();
      await permissionService.checkFullDiskAccess();

      // Contacts denied
      fs.access.mockRejectedValueOnce(new Error('Permission denied'));
      await permissionService.checkContactsPermission();

      expect(permissionService.permissionCache.fullDiskAccess).toBe(true);
      expect(permissionService.permissionCache.contacts).toBe(false);
    });
  });

  describe('error messages', () => {
    it('should provide user-friendly error messages', async () => {
      fs.access.mockRejectedValue(new Error('EACCES'));

      const result = await permissionService.checkFullDiskAccess();

      expect(result.userMessage).toBeDefined();
      expect(result.userMessage).not.toContain('EACCES');
      expect(result.userMessage).toContain('Full Disk Access');
    });

    it('should include actionable steps', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await permissionService.checkFullDiskAccess();

      expect(result.action).toContain('System Settings');
      expect(result.action).toContain('Privacy & Security');
    });

    it('should include error codes for debugging', async () => {
      fs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await permissionService.checkFullDiskAccess();

      expect(result.errorCode).toBeDefined();
      expect(result.errorCode).toMatch(/^[A-Z_]+$/); // Uppercase with underscores
    });
  });
});
