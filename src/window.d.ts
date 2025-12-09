/**
 * Window API type definitions
 * Extends the global Window interface with Electron IPC APIs
 */

import type { GetConversationsResult } from "./hooks/useConversations";
import type { iOSDevice, BackupProgress } from "./types/iphone";
import type { Transaction } from "../electron/types/models";

/**
 * iOS Device information from libimobiledevice
 */
interface iOSDeviceInfo {
  /** Unique Device Identifier (40-character hex string) */
  udid: string;
  /** User-defined device name (e.g., "John's iPhone") */
  name: string;
  /** Device model identifier (e.g., "iPhone14,2") */
  productType: string;
  /** iOS version (e.g., "17.0") */
  productVersion: string;
  /** Device serial number */
  serialNumber: string;
  /** Whether the device is currently connected */
  isConnected: boolean;
}

/**
 * Legacy electron namespace (maintained for backward compatibility)
 * Exposed via contextBridge in preload.js
 */
interface ElectronAPI {
  // Platform detection
  platform: "darwin" | "win32" | "linux" | string;

  // App Info
  getAppInfo: () => Promise<{ version: string; name: string }>;
  getMacOSVersion: () => Promise<{ version: string }>;
  checkAppLocation: () => Promise<{ inApplications: boolean; path: string }>;

  // Permissions
  checkPermissions: () => Promise<Record<string, unknown>>;
  triggerFullDiskAccess: () => Promise<{ granted: boolean }>;
  requestPermissions: () => Promise<Record<string, unknown>>;
  requestContactsPermission: () => Promise<{ granted: boolean }>;
  openSystemSettings: () => Promise<{ success: boolean }>;

  // Conversations (iMessage)
  getConversations: () => Promise<GetConversationsResult>;
  getMessages: (chatId: string) => Promise<unknown[]>;
  exportConversations: (
    conversationIds: string[],
  ) => Promise<{ success: boolean; exportPath?: string }>;

  // Transactions
  transactions: {
    scan: () => Promise<{ success: boolean }>;
    getAll: () => Promise<unknown[]>;
    update: (id: string, data: unknown) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    bulkDelete: (transactionIds: string[]) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
    bulkUpdateStatus: (transactionIds: string[], status: string) => Promise<{ success: boolean; updatedCount?: number; error?: string }>;
  };
  onTransactionScanProgress: (
    callback: (progress: unknown) => void,
  ) => () => void;

  // File System
  openFolder: (folderPath: string) => Promise<{ success: boolean }>;

  // Auto-Update Event Listeners
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateProgress: (callback: (progress: unknown) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  installUpdate: () => void;

  // Outlook Integration
  outlookInitialize: () => Promise<{ success: boolean; error?: string }>;
  outlookAuthenticate: () => Promise<{ success: boolean; error?: string }>;
  outlookIsAuthenticated: () => Promise<boolean>;
  outlookGetUserEmail: () => Promise<string | null>;
  outlookExportEmails: (
    contacts: Array<{
      name: string;
      chatId?: string;
      emails?: string[];
      phones?: string[];
    }>,
  ) => Promise<{
    success: boolean;
    error?: string;
    canceled?: boolean;
    exportPath?: string;
    results?: Array<{
      contactName: string;
      success: boolean;
      textMessageCount: number;
      emailCount?: number;
      error: string | null;
    }>;
  }>;
  outlookSignout: () => Promise<{ success: boolean }>;
  onDeviceCode: (callback: (info: unknown) => void) => () => void;
  onExportProgress: (callback: (progress: unknown) => void) => () => void;

  // iOS Device Detection (Windows only)
  device?: {
    startDetection: () => void;
    stopDetection: () => void;
    onConnected: (
      callback: (device: iOSDevice) => void,
    ) => (() => void) | undefined;
    onDisconnected: (callback: () => void) => (() => void) | undefined;
  };

  // iOS Backup Management (Windows only)
  backup?: {
    start: (options: { udid: string }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    submitPassword: (options: { udid: string; password: string }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    cancel: () => Promise<void>;
    onProgress: (
      callback: (progress: BackupProgress) => void,
    ) => (() => void) | undefined;
  };

  // Apple Driver Management (Windows only)
  drivers: {
    /** Check if Apple Mobile Device Support drivers are installed */
    checkApple: () => Promise<{
      installed: boolean;
      version?: string;
      serviceRunning: boolean;
      error?: string;
    }>;
    /** Check if bundled Apple drivers are available in the app */
    hasBundled: () => Promise<{ hasBundled: boolean }>;
    /** Install Apple Mobile Device Support drivers (requires user consent) */
    installApple: () => Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      rebootRequired?: boolean;
    }>;
    /** Open iTunes in Microsoft Store for manual installation */
    openITunesStore: () => Promise<{ success: boolean; error?: string }>;
    /** Check if a driver update is available */
    checkUpdate: () => Promise<{
      updateAvailable: boolean;
      installedVersion: string | null;
      bundledVersion: string | null;
    }>;
  };
}

/**
 * Main API namespace (preferred for new code)
 * Exposed via contextBridge in preload.js
 */
interface MainAPI {
  auth: {
    googleLogin: () => Promise<{
      success: boolean;
      authUrl?: string;
      error?: string;
    }>;
    googleCompleteLogin: (code: string) => Promise<{
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }>;
    googleConnectMailbox: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    microsoftLogin: () => Promise<{
      success: boolean;
      authUrl?: string;
      scopes?: string[];
      error?: string;
    }>;
    microsoftConnectMailbox: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    logout: (
      sessionToken: string,
    ) => Promise<{ success: boolean; error?: string }>;
    validateSession: (
      sessionToken: string,
    ) => Promise<{ valid: boolean; user?: unknown; error?: string }>;
    getCurrentUser: () => Promise<{
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      provider?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }>;
    acceptTerms: (
      userId: string,
    ) => Promise<{ success: boolean; user?: unknown; error?: string }>;
    completeEmailOnboarding: (
      userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    checkEmailOnboarding: (
      userId: string,
    ) => Promise<{ success: boolean; completed: boolean; error?: string }>;
    // Complete pending login after keychain setup
    completePendingLogin: (oauthData: unknown) => Promise<{
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }>;
    // Pre-DB mailbox connection (returns tokens instead of saving to DB)
    googleConnectMailboxPending: (
      emailHint?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    microsoftConnectMailboxPending: (
      emailHint?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    // Save pending mailbox tokens after DB initialization
    savePendingMailboxTokens: (data: {
      userId: string;
      provider: "google" | "microsoft";
      email: string;
      tokens: {
        access_token: string;
        refresh_token: string | null;
        expires_at: string;
        scopes: string;
      };
    }) => Promise<{ success: boolean; error?: string }>;
  };
  system: {
    getSecureStorageStatus: () => Promise<{
      success: boolean;
      available: boolean;
      platform?: string;
      guidance?: string;
      error?: string;
    }>;
    initializeSecureStorage: () => Promise<{
      success: boolean;
      available: boolean;
      platform?: string;
      guidance?: string;
      error?: string;
    }>;
    hasEncryptionKeyStore: () => Promise<{
      success: boolean;
      hasKeyStore: boolean;
    }>;
    initializeDatabase: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    isDatabaseInitialized: () => Promise<{
      success: boolean;
      initialized: boolean;
    }>;
    checkAllConnections: (userId: string) => Promise<{
      success: boolean;
      google?: { connected: boolean; email?: string };
      microsoft?: { connected: boolean; email?: string };
      error?: string;
    }>;
    healthCheck: (
      userId: string,
      provider: string,
    ) => Promise<{
      healthy: boolean;
      issues?: Array<{
        severity?: string;
        title?: string;
        message?: string;
        userMessage?: string;
        details?: string;
        action?: string;
        actionHandler?: string;
      }>;
    }>;
    openPrivacyPane: (pane: string) => Promise<void>;
    contactSupport: (
      errorDetails?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    getDiagnostics: () => Promise<{
      success: boolean;
      diagnostics?: string;
      error?: string;
    }>;
  };
  device: {
    /** Lists all currently connected iOS devices */
    list: () => Promise<{
      success: boolean;
      devices?: iOSDeviceInfo[];
      error?: string;
    }>;
    /** Starts device detection polling */
    startDetection: () => Promise<{ success: boolean; error?: string }>;
    /** Stops device detection polling */
    stopDetection: () => Promise<{ success: boolean; error?: string }>;
    /** Checks if libimobiledevice tools are available */
    checkAvailability: () => Promise<{
      success: boolean;
      available?: boolean;
      error?: string;
    }>;
    /** Subscribes to device connected events */
    onConnected: (callback: (device: iOSDeviceInfo) => void) => () => void;
    /** Subscribes to device disconnected events */
    onDisconnected: (callback: (device: iOSDeviceInfo) => void) => () => void;
  };

  // Event listeners for login completion
  onGoogleLoginComplete: (
    callback: (result: {
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }) => void,
  ) => () => void;
  onGoogleLoginPending: (
    callback: (result: {
      success: boolean;
      pendingLogin?: boolean;
      oauthData?: unknown;
      error?: string;
    }) => void,
  ) => () => void;
  onGoogleLoginCancelled: (callback: () => void) => () => void;
  onMicrosoftLoginComplete: (
    callback: (result: {
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }) => void,
  ) => () => void;
  onMicrosoftLoginPending: (
    callback: (result: {
      success: boolean;
      pendingLogin?: boolean;
      oauthData?: unknown;
      error?: string;
    }) => void,
  ) => () => void;
  onMicrosoftLoginCancelled: (callback: () => void) => () => void;
  onGoogleMailboxConnected: (
    callback: (result: { success: boolean }) => void,
  ) => () => void;
  onMicrosoftMailboxConnected: (
    callback: (result: { success: boolean }) => void,
  ) => () => void;
  onGoogleMailboxCancelled: (callback: () => void) => () => void;
  onMicrosoftMailboxCancelled: (callback: () => void) => () => void;

  // Pre-DB mailbox connection events (for collecting tokens before DB init)
  onGoogleMailboxPendingConnected: (
    callback: (result: {
      success: boolean;
      email?: string;
      tokens?: {
        access_token: string;
        refresh_token: string | null;
        expires_at: string;
        scopes: string;
      };
      error?: string;
    }) => void,
  ) => () => void;
  onGoogleMailboxPendingCancelled: (callback: () => void) => () => void;
  onMicrosoftMailboxPendingConnected: (
    callback: (result: {
      success: boolean;
      email?: string;
      tokens?: {
        access_token: string;
        refresh_token: string | null;
        expires_at: string;
        scopes: string;
      };
      error?: string;
    }) => void,
  ) => () => void;
  onMicrosoftMailboxPendingCancelled: (callback: () => void) => () => void;

  /**
   * Backup API for iPhone data extraction
   * Note: Domain filtering is NOT supported - see docs/BACKUP_RESEARCH.md
   */
  backup: {
    /** Get backup system capabilities */
    getCapabilities: () => Promise<{
      supportsDomainFiltering: boolean;
      supportsIncremental: boolean;
      supportsSkipApps: boolean;
      supportsEncryption: boolean;
      availableDomains: string[];
    }>;

    /** Get current backup status */
    getStatus: () => Promise<{
      isRunning: boolean;
      currentDeviceUdid: string | null;
      progress: {
        phase: "preparing" | "transferring" | "finishing" | "extracting";
        percentComplete: number;
        currentFile: string | null;
        filesTransferred: number;
        totalFiles: number | null;
        bytesTransferred: number;
        totalBytes: number | null;
        estimatedTimeRemaining: number | null;
      } | null;
    }>;

    /** Start a backup operation */
    start: (options: {
      udid: string;
      outputDir?: string;
      forceFullBackup?: boolean;
      skipApps?: boolean;
    }) => Promise<{
      success: boolean;
      backupPath: string | null;
      error: string | null;
      duration: number;
      deviceUdid: string;
      isIncremental: boolean;
      backupSize: number;
    }>;

    /** Start a backup with password (for encrypted backups) */
    startWithPassword?: (options: {
      udid: string;
      password: string;
      outputPath?: string;
    }) => Promise<{
      success: boolean;
      backupPath?: string;
      error?: string;
      errorCode?: string;
    }>;

    /** Check if a device requires encrypted backup */
    checkEncryption?: (udid: string) => Promise<{
      success: boolean;
      isEncrypted?: boolean;
      needsPassword?: boolean;
      error?: string;
    }>;

    /** Verify a backup password */
    verifyPassword?: (
      backupPath: string,
      password: string,
    ) => Promise<{
      success: boolean;
      valid?: boolean;
      error?: string;
    }>;

    /** Check if an existing backup is encrypted */
    isEncrypted?: (backupPath: string) => Promise<{
      success: boolean;
      isEncrypted?: boolean;
      error?: string;
    }>;

    /** Cancel an in-progress backup */
    cancel: () => Promise<{ success: boolean }>;

    /** List all existing backups */
    list: () => Promise<
      Array<{
        path: string;
        deviceUdid: string;
        createdAt: Date;
        size: number;
        isEncrypted: boolean;
        iosVersion: string | null;
        deviceName: string | null;
      }>
    >;

    /** Delete a specific backup */
    delete: (
      backupPath: string,
    ) => Promise<{ success: boolean; error?: string }>;

    /** Clean up old backups */
    cleanup: (
      keepCount?: number,
    ) => Promise<{ success: boolean; error?: string }>;

    /** Subscribe to backup progress updates */
    onProgress: (
      callback: (progress: {
        phase: "preparing" | "transferring" | "finishing" | "extracting";
        percentComplete: number;
        currentFile: string | null;
        filesTransferred: number;
        totalFiles: number | null;
        bytesTransferred: number;
        totalBytes: number | null;
        estimatedTimeRemaining: number | null;
      }) => void,
    ) => () => void;

    /** Subscribe to backup completion events */
    onComplete: (
      callback: (result: {
        success: boolean;
        backupPath: string | null;
        error: string | null;
        duration: number;
        deviceUdid: string;
        isIncremental: boolean;
        backupSize: number;
      }) => void,
    ) => () => void;

    /** Subscribe to backup error events */
    onError: (callback: (error: { message: string }) => void) => () => void;
  };

  // Transactions API
  transactions: {
    getAll: (
      userId: string,
    ) => Promise<{
      success: boolean;
      transactions?: Transaction[];
      error?: string;
    }>;
    scan: (
      userId: string,
      options?: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transactionsFound?: number;
      emailsScanned?: number;
      error?: string;
    }>;
    cancelScan: (
      userId: string,
    ) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
    create: (
      userId: string,
      transactionData: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      error?: string;
    }>;
    createAudited: (
      userId: string,
      transactionData: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      error?: string;
    }>;
    get: (transactionId: string) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      error?: string;
    }>;
    getDetails: (transactionId: string) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      error?: string;
    }>;
    getWithContacts: (transactionId: string) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      contacts?: Array<Record<string, unknown>>;
      error?: string;
    }>;
    getCommunications: (transactionId: string) => Promise<{
      success: boolean;
      communications?: unknown[];
      error?: string;
    }>;
    getContacts: (transactionId: string) => Promise<{
      success: boolean;
      contacts?: unknown[];
      error?: string;
    }>;
    update: (
      transactionId: string,
      updates: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      error?: string;
    }>;
    delete: (transactionId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    assignContact: (
      transactionId: string,
      contactId: string,
      role: string,
      roleCategory: string,
      isPrimary: boolean,
      notes?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    removeContact: (
      transactionId: string,
      contactId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    unlinkCommunication: (
      communicationId: string,
      reason?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    reanalyze: (
      userId: string,
      provider: string,
      propertyAddress: string,
      dateRange: { start: string; end: string },
    ) => Promise<{
      success: boolean;
      newCount?: number;
      updatedCount?: number;
      error?: string;
    }>;
    exportPDF: (
      transactionId: string,
      outputPath: string,
    ) => Promise<{
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
    exportEnhanced: (
      transactionId: string,
      options: Record<string, unknown>,
    ) => Promise<{
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
    bulkDelete: (transactionIds: string[]) => Promise<{
      success: boolean;
      deletedCount?: number;
      errors?: string[];
      error?: string;
    }>;
    bulkUpdateStatus: (
      transactionIds: string[],
      status: string,
    ) => Promise<{
      success: boolean;
      updatedCount?: number;
      errors?: string[];
      error?: string;
    }>;
  };

  // Transaction scan progress event
  onTransactionScanProgress: (
    callback: (progress: { step: string; message: string }) => void,
  ) => () => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow other properties for backwards compatibility
}

// Augment the global Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
    api: MainAPI;
  }
}

export {};
