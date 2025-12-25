/**
 * System Bridge
 * System-level operations including permissions, connections, and health checks
 */

import { ipcRenderer } from "electron";

export const systemBridge = {
  /**
   * Gets secure storage status without triggering keychain prompt
   * Used to check if encryption is already available (user already authorized)
   * @returns Status result
   */
  getSecureStorageStatus: () =>
    ipcRenderer.invoke("system:get-secure-storage-status"),

  /**
   * Initializes secure storage (triggers keychain prompt on macOS)
   * Should be called after user login and terms acceptance
   * @returns Initialization result
   */
  initializeSecureStorage: () =>
    ipcRenderer.invoke("system:initialize-secure-storage"),

  /**
   * Checks if the database encryption key store file exists
   * Used to determine if this is a new user (needs secure storage setup) vs returning user
   * @returns Key store check result
   */
  hasEncryptionKeyStore: () =>
    ipcRenderer.invoke("system:has-encryption-key-store"),

  /**
   * Initializes the database after secure storage setup
   * Should be called after the user has authorized keychain access (new users only)
   * @returns Database initialization result
   */
  initializeDatabase: () => ipcRenderer.invoke("system:initialize-database"),

  /**
   * Checks if the database is initialized and ready for operations
   * Used to determine if we can save user data after OAuth
   * @returns Database initialization status
   */
  isDatabaseInitialized: () =>
    ipcRenderer.invoke("system:is-database-initialized"),

  /**
   * Runs the complete permission setup flow for onboarding
   * @returns Setup result
   */
  runPermissionSetup: () => ipcRenderer.invoke("system:run-permission-setup"),

  /**
   * Requests macOS contacts permission
   * @returns Permission request result
   */
  requestContactsPermission: () =>
    ipcRenderer.invoke("system:request-contacts-permission"),

  /**
   * Initiates Full Disk Access setup process
   * @returns Setup result
   */
  setupFullDiskAccess: () =>
    ipcRenderer.invoke("system:setup-full-disk-access"),

  /**
   * Opens macOS System Preferences to a specific privacy pane
   * @param pane - Privacy pane identifier (e.g., 'Privacy_AllFiles', 'Privacy_Contacts')
   * @returns Open result
   */
  openPrivacyPane: (pane: string) =>
    ipcRenderer.invoke("system:open-privacy-pane", pane),

  /**
   * Checks current Full Disk Access status
   * @returns Status check result
   */
  checkFullDiskAccessStatus: () =>
    ipcRenderer.invoke("system:check-full-disk-access-status"),

  /**
   * Checks if app has Full Disk Access permission
   * @returns Permission status
   */
  checkFullDiskAccess: () =>
    ipcRenderer.invoke("system:check-full-disk-access"),

  /**
   * Checks if app has Contacts permission
   * @returns Permission status
   */
  checkContactsPermission: () =>
    ipcRenderer.invoke("system:check-contacts-permission"),

  /**
   * Checks all required system permissions
   * @returns All permission statuses
   */
  checkAllPermissions: () =>
    ipcRenderer.invoke("system:check-all-permissions"),

  /**
   * Checks Google account connection and token validity
   * @param userId - User ID to check
   * @returns Connection status
   */
  checkGoogleConnection: (userId: string) =>
    ipcRenderer.invoke("system:check-google-connection", userId),

  /**
   * Checks Microsoft account connection and token validity
   * @param userId - User ID to check
   * @returns Connection status
   */
  checkMicrosoftConnection: (userId: string) =>
    ipcRenderer.invoke("system:check-microsoft-connection", userId),

  /**
   * Checks all email provider connections
   * @param userId - User ID to check
   * @returns All connection statuses
   */
  checkAllConnections: (userId: string) =>
    ipcRenderer.invoke("system:check-all-connections", userId),

  /**
   * Runs comprehensive health check for a provider
   * @param userId - User ID
   * @param provider - Provider to check ('google' or 'microsoft')
   * @returns Health check result
   */
  healthCheck: (userId: string, provider: string) =>
    ipcRenderer.invoke("system:health-check", userId, provider),

  /**
   * Opens support email with pre-filled content
   * @param errorDetails - Optional error details to include
   * @returns Result
   */
  contactSupport: (errorDetails?: string) =>
    ipcRenderer.invoke("system:contact-support", errorDetails),

  /**
   * Gets diagnostic information for support requests
   * @returns Diagnostic data
   */
  getDiagnostics: () => ipcRenderer.invoke("system:get-diagnostics"),
};
