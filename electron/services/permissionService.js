/**
 * Permission Service
 * Centralized permission checking and error handling
 */

const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

class PermissionService {
  constructor() {
    this.lastPermissionCheck = null;
    this.permissionCache = {
      fullDiskAccess: null,
      contacts: null,
      cachedAt: null,
    };
  }

  /**
   * Check Full Disk Access permission
   * @returns {Promise<{hasPermission: boolean, error?: string}>}
   */
  async checkFullDiskAccess() {
    try {
      const messagesDbPath = path.join(process.env.HOME, 'Library/Messages/chat.db');
      await fs.access(messagesDbPath, fs.constants.R_OK);

      this.permissionCache.fullDiskAccess = true;
      this.permissionCache.cachedAt = Date.now();

      return {
        hasPermission: true,
      };
    } catch (error) {
      this.permissionCache.fullDiskAccess = false;
      this.permissionCache.cachedAt = Date.now();

      return {
        hasPermission: false,
        error: error.message,
        errorCode: 'FULL_DISK_ACCESS_DENIED',
        userMessage: 'Full Disk Access permission is required to read iMessages.',
        action: 'Please grant Full Disk Access in System Settings > Privacy & Security > Full Disk Access',
      };
    }
  }

  /**
   * Check Contacts permission
   * @returns {Promise<{hasPermission: boolean, error?: string}>}
   */
  async checkContactsPermission() {
    try {
      const contactsDbPath = path.join(
        process.env.HOME,
        'Library/Application Support/AddressBook/Sources'
      );
      await fs.access(contactsDbPath, fs.constants.R_OK);

      this.permissionCache.contacts = true;
      this.permissionCache.cachedAt = Date.now();

      return {
        hasPermission: true,
      };
    } catch (error) {
      this.permissionCache.contacts = false;
      this.permissionCache.cachedAt = Date.now();

      return {
        hasPermission: false,
        error: error.message,
        errorCode: 'CONTACTS_ACCESS_DENIED',
        userMessage: 'Contacts permission is required to match phone numbers to names.',
        action:
          'Full Disk Access in System Settings > Privacy & Security > Full Disk Access will grant access to Contacts',
      };
    }
  }

  /**
   * Check if contacts are actually loading from the Contacts app
   * This is a more thorough check than just checking directory access
   * @returns {Promise<{canLoadContacts: boolean, contactCount?: number, error?: Object}>}
   */
  async checkContactsLoading() {
    try {
      // Import contactsService here to avoid circular dependencies
      const { getContactNames } = require('./contactsService');

      const result = await getContactNames();

      if (result.status && !result.status.success) {
        return {
          canLoadContacts: false,
          contactCount: 0,
          error: {
            type: 'CONTACTS_LOADING_FAILED',
            title: 'Cannot Load Contacts',
            message: result.status.userMessage || 'Could not load contacts from Contacts app',
            details: result.status.error || result.status.lastError,
            action: result.status.action || 'Grant Full Disk Access',
            actionHandler: 'open-system-settings',
            severity: 'error',
          },
        };
      }

      const contactCount = result.status?.contactCount || Object.keys(result.contactMap).length;

      if (contactCount === 0) {
        return {
          canLoadContacts: false,
          contactCount: 0,
          error: {
            type: 'NO_CONTACTS_FOUND',
            title: 'No Contacts Found',
            message: 'No contacts were found in your Contacts app. You may need to grant Full Disk Access.',
            details: 'Contact database exists but contains no contacts',
            action: 'Open System Settings',
            actionHandler: 'open-system-settings',
            severity: 'warning',
          },
        };
      }

      return {
        canLoadContacts: true,
        contactCount,
      };
    } catch (error) {
      console.error('[PermissionService] Contacts loading check failed:', error);
      return {
        canLoadContacts: false,
        contactCount: 0,
        error: {
          type: 'CONTACTS_CHECK_FAILED',
          title: 'Contacts Check Failed',
          message: 'Could not verify contacts access',
          details: error.message,
          action: 'Grant Full Disk Access',
          actionHandler: 'open-system-settings',
          severity: 'error',
        },
      };
    }
  }

  /**
   * Check all required permissions
   * @returns {Promise<{allGranted: boolean, permissions: Object, errors: Array}>}
   */
  async checkAllPermissions() {
    const results = {
      allGranted: true,
      permissions: {},
      errors: [],
    };

    // Check Full Disk Access
    const fullDiskAccess = await this.checkFullDiskAccess();
    results.permissions.fullDiskAccess = fullDiskAccess;
    if (!fullDiskAccess.hasPermission) {
      results.allGranted = false;
      results.errors.push(fullDiskAccess);
    }

    // Check Contacts
    const contacts = await this.checkContactsPermission();
    results.permissions.contacts = contacts;
    if (!contacts.hasPermission) {
      results.allGranted = false;
      results.errors.push(contacts);
    }

    return results;
  }

  /**
   * Get cached permission status (to avoid repeated file system checks)
   * @param {number} maxAge - Maximum cache age in milliseconds (default: 30 seconds)
   * @returns {Object|null} Cached permissions or null if expired
   */
  getCachedPermissions(maxAge = 30000) {
    if (!this.permissionCache.cachedAt) {
      return null;
    }

    const age = Date.now() - this.permissionCache.cachedAt;
    if (age > maxAge) {
      return null;
    }

    return {
      fullDiskAccess: this.permissionCache.fullDiskAccess,
      contacts: this.permissionCache.contacts,
      cachedAt: this.permissionCache.cachedAt,
    };
  }

  /**
   * Clear permission cache
   */
  clearCache() {
    this.permissionCache = {
      fullDiskAccess: null,
      contacts: null,
      cachedAt: null,
    };
  }

  /**
   * Get user-friendly error message for permission errors
   * @param {Error} error
   * @returns {Object} Structured error with user message and actions
   */
  getPermissionError(error) {
    const errorMessage = error.message.toLowerCase();

    // Full Disk Access errors
    if (errorMessage.includes('eacces') || errorMessage.includes('eperm')) {
      return {
        type: 'PERMISSION_DENIED',
        title: 'Permission Required',
        message:
          'Magic Audit needs Full Disk Access to read your iMessages and Contacts.',
        details: error.message,
        action: 'Open System Settings',
        actionHandler: 'open-system-settings',
        severity: 'error',
      };
    }

    // File not found (Messages database)
    if (errorMessage.includes('enoent') && errorMessage.includes('messages')) {
      return {
        type: 'MESSAGES_NOT_FOUND',
        title: 'Messages Database Not Found',
        message:
          'Could not find the iMessages database. Make sure Messages app is configured.',
        details: error.message,
        action: 'Open Messages App',
        actionHandler: 'open-messages-app',
        severity: 'warning',
      };
    }

    // Generic database error
    if (errorMessage.includes('sqlite') || errorMessage.includes('database')) {
      return {
        type: 'DATABASE_ERROR',
        title: 'Database Error',
        message: 'An error occurred while accessing the database.',
        details: error.message,
        action: 'Check Console Logs',
        severity: 'error',
      };
    }

    // Generic permission error
    return {
      type: 'UNKNOWN_ERROR',
      title: 'An Error Occurred',
      message: 'Something went wrong. Please try again.',
      details: error.message,
      action: 'Retry',
      actionHandler: 'retry',
      severity: 'error',
    };
  }
}

module.exports = new PermissionService();
