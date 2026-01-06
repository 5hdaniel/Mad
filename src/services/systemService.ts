/**
 * System Service
 *
 * Service abstraction for system-related API calls including permissions,
 * connections, health checks, and secure storage.
 * Centralizes all window.api.system calls and provides type-safe wrappers.
 */

import type { OAuthProvider } from "@/types";
import { type ApiResult, getErrorMessage } from "./index";

/**
 * All permissions status
 */
export interface AllPermissions {
  fullDiskAccess: boolean;
  contactsAccess: boolean;
  allGranted: boolean;
}

/**
 * Provider connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  email?: string;
}

/**
 * All connections status
 */
export interface AllConnections {
  google?: ConnectionStatus;
  microsoft?: ConnectionStatus;
}

/**
 * Health check result
 */
export interface HealthCheck {
  healthy: boolean;
  provider?: OAuthProvider;
  issues?: string[];
}

/**
 * Secure storage status
 */
export interface SecureStorageStatus {
  available: boolean;
  platform?: string;
  guidance?: string;
}

/**
 * Diagnostics information
 */
export interface Diagnostics {
  diagnostics: string;
}

/**
 * System Service
 * Provides a clean abstraction over window.api.system
 */
export const systemService = {
  // ============================================
  // PERMISSION METHODS
  // ============================================

  /**
   * Run the permission setup wizard
   */
  async runPermissionSetup(): Promise<ApiResult> {
    try {
      const result = await window.api.system.runPermissionSetup();
      return { success: result.success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Request contacts permission
   */
  async requestContactsPermission(): Promise<ApiResult<{ granted: boolean }>> {
    try {
      const result = await window.api.system.requestContactsPermission();
      return { success: true, data: { granted: result.granted } };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Setup full disk access
   */
  async setupFullDiskAccess(): Promise<ApiResult> {
    try {
      const result = await window.api.system.setupFullDiskAccess();
      return { success: result.success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Open system privacy pane
   */
  async openPrivacyPane(pane: string): Promise<ApiResult> {
    try {
      const result = await window.api.system.openPrivacyPane(pane);
      return { success: result.success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check full disk access status
   */
  async checkFullDiskAccessStatus(): Promise<ApiResult<{ hasAccess: boolean }>> {
    try {
      const result = await window.api.system.checkFullDiskAccessStatus();
      return { success: true, data: { hasAccess: result.hasAccess } };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check full disk access (alias)
   */
  async checkFullDiskAccess(): Promise<ApiResult<{ hasAccess: boolean }>> {
    try {
      const result = await window.api.system.checkFullDiskAccess();
      return { success: true, data: { hasAccess: result.hasAccess } };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check contacts permission
   */
  async checkContactsPermission(): Promise<ApiResult<{ hasPermission: boolean }>> {
    try {
      const result = await window.api.system.checkContactsPermission();
      return { success: true, data: { hasPermission: result.hasPermission } };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check all permissions at once
   */
  async checkAllPermissions(): Promise<ApiResult<AllPermissions>> {
    try {
      const result = await window.api.system.checkAllPermissions();
      return {
        success: true,
        data: {
          fullDiskAccess: result.fullDiskAccess,
          contactsAccess: result.contactsAccess,
          allGranted: result.allGranted,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // CONNECTION METHODS
  // ============================================

  /**
   * Check Google connection status
   */
  async checkGoogleConnection(userId: string): Promise<ApiResult<ConnectionStatus>> {
    try {
      const result = await window.api.system.checkGoogleConnection(userId);
      return {
        success: true,
        data: {
          connected: result.connected,
          email: result.email,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check Microsoft connection status
   */
  async checkMicrosoftConnection(
    userId: string
  ): Promise<ApiResult<ConnectionStatus>> {
    try {
      const result = await window.api.system.checkMicrosoftConnection(userId);
      return {
        success: true,
        data: {
          connected: result.connected,
          email: result.email,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check all email provider connections
   */
  async checkAllConnections(userId: string): Promise<ApiResult<AllConnections>> {
    try {
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        return {
          success: true,
          data: {
            google: result.google,
            microsoft: result.microsoft,
          },
        };
      }
      return { success: false, error: "Failed to check connections" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Run health check for a provider
   */
  async healthCheck(
    userId: string,
    provider: OAuthProvider
  ): Promise<ApiResult<HealthCheck>> {
    try {
      const result = await window.api.system.healthCheck(userId, provider);
      return {
        success: true,
        data: {
          healthy: result.healthy,
          provider: result.provider,
          issues: result.issues,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // SECURE STORAGE METHODS
  // ============================================

  /**
   * Get secure storage (keychain) status
   */
  async getSecureStorageStatus(): Promise<ApiResult<SecureStorageStatus>> {
    try {
      const result = await window.api.system.getSecureStorageStatus();
      if (result.success) {
        return {
          success: true,
          data: {
            available: result.available,
            platform: result.platform,
            guidance: result.guidance,
          },
        };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Initialize secure storage (keychain)
   */
  async initializeSecureStorage(): Promise<ApiResult<SecureStorageStatus>> {
    try {
      const result = await window.api.system.initializeSecureStorage();
      if (result.success) {
        return {
          success: true,
          data: {
            available: result.available,
            platform: result.platform,
            guidance: result.guidance,
          },
        };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check if encryption key store exists
   */
  async hasEncryptionKeyStore(): Promise<ApiResult<{ hasKeyStore: boolean }>> {
    try {
      const result = await window.api.system.hasEncryptionKeyStore();
      if (result.success) {
        return { success: true, data: { hasKeyStore: result.hasKeyStore } };
      }
      return { success: false, error: "Failed to check key store" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // DATABASE METHODS
  // ============================================

  /**
   * Initialize the database
   */
  async initializeDatabase(): Promise<ApiResult> {
    try {
      const result = await window.api.system.initializeDatabase();
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check if database is initialized
   */
  async isDatabaseInitialized(): Promise<ApiResult<{ initialized: boolean }>> {
    try {
      const result = await window.api.system.isDatabaseInitialized();
      if (result.success) {
        return { success: true, data: { initialized: result.initialized } };
      }
      return { success: false, error: "Failed to check database status" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // SUPPORT METHODS
  // ============================================

  /**
   * Contact support with optional error details
   */
  async contactSupport(errorDetails?: string): Promise<ApiResult> {
    try {
      const result = await window.api.system.contactSupport(errorDetails);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get system diagnostics
   */
  async getDiagnostics(): Promise<ApiResult<Diagnostics>> {
    try {
      const result = await window.api.system.getDiagnostics();
      if (result.success && result.diagnostics) {
        return { success: true, data: { diagnostics: result.diagnostics } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export default systemService;
