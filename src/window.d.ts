/**
 * Window API type definitions
 * Extends the global Window interface with Electron IPC APIs
 */

import type { GetConversationsResult } from "./hooks/useConversations";
import type { iOSDevice, BackupProgress } from "./types/iphone";
import type { Transaction } from "../electron/types/models";

/**
 * Backup progress details from idevicebackup2
 */
interface BackupProgressDetails {
  phase: string;
  percentComplete: number;
  currentFile: string | null;
  filesTransferred: number;
  totalFiles: number | null;
  bytesTransferred: number;
  totalBytes: number | null;
  estimatedTimeRemaining: number | null;
}

/**
 * Sync progress information
 */
interface SyncProgress {
  phase: string;
  phaseProgress: number;
  overallProgress: number;
  message?: string;
  /** Detailed backup progress from idevicebackup2 */
  backupProgress?: BackupProgressDetails;
  /** Estimated total backup size in bytes (for progress calculation) */
  estimatedTotalBytes?: number;
}

/**
 * Sync operation result
 */
interface SyncResult {
  success: boolean;
  messages: unknown[];
  contacts: unknown[];
  conversations: unknown[];
  error?: string;
  duration: number;
}

/**
 * Unified sync status (TASK-904)
 * Aggregates status from backup and sync orchestrator
 */
interface UnifiedSyncStatus {
  /** True if any backup/sync operation is currently running */
  isAnyOperationRunning: boolean;
  /** True if an iPhone backup is in progress */
  backupInProgress: boolean;
  /** True if email/message sync is in progress (not backup) */
  emailSyncInProgress: boolean;
  /** Human-readable label for the current operation, or null if idle */
  currentOperation: string | null;
  /** Current sync phase from orchestrator */
  syncPhase: "idle" | "backup" | "decrypting" | "parsing-contacts" | "parsing-messages" | "resolving" | "cleanup" | "complete" | "error";
}

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
    bulkUpdateStatus: (transactionIds: string[], status: "pending" | "active" | "closed" | "rejected") => Promise<{ success: boolean; updatedCount?: number; error?: string }>;
  };
  onTransactionScanProgress: (
    callback: (progress: unknown) => void,
  ) => () => void;
  onExportFolderProgress: (
    callback: (progress: { stage: string; current: number; total: number; message: string }) => void,
  ) => () => void;

  // File System
  openFolder: (folderPath: string) => Promise<{ success: boolean }>;

  // Auto-Update Event Listeners
  onUpdateAvailable: (callback: (info: unknown) => void) => () => void;
  onUpdateProgress: (callback: (progress: unknown) => void) => () => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => () => void;
  installUpdate: () => void;
  checkForUpdates: () => Promise<{
    updateAvailable: boolean;
    version?: string;
    currentVersion: string;
    error?: string;
  }>;

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
    /** Check backup status for a specific device (last sync time, size, etc.) */
    checkStatus?: (udid: string) => Promise<{
      success: boolean;
      exists?: boolean;
      isComplete?: boolean;
      isCorrupted?: boolean;
      lastSyncTime?: string | null;
      sizeBytes?: number;
      error?: string;
    }>;
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
/**
 * Progress event from macOS message import (TASK-1710)
 * Enhanced with querying phase and elapsed time for ETA calculation
 */
interface MacOSImportProgress {
  phase: "querying" | "deleting" | "importing" | "attachments";
  current: number;
  total: number;
  percent: number;
  /** Milliseconds elapsed since import started */
  elapsedMs: number;
}

/**
 * Result of macOS message import
 */
interface MacOSImportResult {
  success: boolean;
  messagesImported: number;
  messagesSkipped: number;
  attachmentsImported: number;
  attachmentsSkipped: number;
  duration: number;
  error?: string;
}

/**
 * Attachment info for display (TASK-1012)
 */
interface MessageAttachmentInfo {
  id: string;
  message_id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  /** Base64-encoded file content for inline display */
  data: string | null;
}

interface MainAPI {
  // Messages API (iMessage/SMS - migrated from window.electron)
  messages: {
    getConversations: () => Promise<GetConversationsResult>;
    getMessages: (chatId: string) => Promise<unknown[]>;
    exportConversations: (
      conversationIds: string[],
    ) => Promise<{ success: boolean; exportPath?: string }>;
    /** Import messages from macOS Messages app into the app database (macOS only) */
    importMacOSMessages: (userId: string, forceReimport?: boolean) => Promise<MacOSImportResult>;
    /** Get count of messages available for import from macOS Messages */
    getImportCount: (filters?: { lookbackMonths?: number | null; maxMessages?: number | null }) => Promise<{ success: boolean; count?: number; filteredCount?: number; error?: string }>;
    /** Listen for import progress updates */
    onImportProgress: (callback: (progress: MacOSImportProgress) => void) => () => void;
    /** Get attachments for a message with base64 data (TASK-1012) */
    getMessageAttachments: (messageId: string) => Promise<MessageAttachmentInfo[]>;
    /** Get attachments for multiple messages at once (TASK-1012) */
    getMessageAttachmentsBatch: (messageIds: string[]) => Promise<Record<string, MessageAttachmentInfo[]>>;
    /** Cancel the current import operation (TASK-1710) */
    cancelImport: () => void;
    /** Get macOS messages import status (count and last import time) */
    getImportStatus: (userId: string) => Promise<{
      success: boolean;
      messageCount?: number;
      lastImportAt?: string | null;
      error?: string;
    }>;
  };

  // Outlook integration (migrated from window.electron)
  outlook: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    authenticate: () => Promise<{
      success: boolean;
      error?: string;
      userInfo?: { username?: string };
    }>;
    isAuthenticated: () => Promise<boolean>;
    getUserEmail: () => Promise<string | null>;
    exportEmails: (
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
    signout: () => Promise<{ success: boolean }>;
    onDeviceCode: (callback: (info: unknown) => void) => () => void;
    onExportProgress: (callback: (progress: unknown) => void) => () => void;
  };

  // Auto-update (migrated from window.electron)
  update: {
    onAvailable: (callback: (info: unknown) => void) => () => void;
    onProgress: (callback: (progress: unknown) => void) => () => void;
    onDownloaded: (callback: (info: unknown) => void) => () => void;
    install: () => void;
    checkForUpdates: () => Promise<{
      updateAvailable: boolean;
      version?: string;
      currentVersion: string;
      error?: string;
    }>;
  };

  // Shell operations
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean }>;
    openPopup: (url: string, title?: string) => Promise<{ success: boolean }>;
    openFolder: (folderPath: string) => Promise<{ success: boolean }>;
  };

  // OS Notifications
  notification: {
    /** Check if notifications are supported on this platform */
    isSupported: () => Promise<{ success: boolean; supported: boolean }>;
    /** Send an OS notification */
    send: (title: string, body: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Apple Driver Management (Windows only)
  drivers: {
    checkApple: () => Promise<{
      installed: boolean;
      version?: string;
      serviceRunning: boolean;
      error?: string;
    }>;
    hasBundled: () => Promise<{ hasBundled: boolean }>;
    installApple: () => Promise<{
      success: boolean;
      cancelled?: boolean;
      error?: string;
      rebootRequired?: boolean;
    }>;
    openITunesStore: () => Promise<{ success: boolean; error?: string }>;
    checkUpdate: () => Promise<{
      updateAvailable: boolean;
      installedVersion: string | null;
      bundledVersion: string | null;
    }>;
  };

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
    forceLogout: () => Promise<{ success: boolean; error?: string }>;
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

    // TASK-1507: Deep link browser auth
    /**
     * Opens Supabase auth URL in the default browser
     * Used for deep-link authentication flow
     */
    openAuthInBrowser: () => Promise<{ success: boolean; error?: string }>;
    // TASK-2045: Sign out of all devices (global session invalidation)
    signOutAllDevices: () => Promise<{ success: boolean; error?: string }>;
  };
  system: {
    // Platform detection (migrated from window.electron.platform)
    platform: "darwin" | "win32" | "linux" | string;

    // App info (migrated from window.electron)
    getAppInfo: () => Promise<{ version: string; name: string }>;
    getMacOSVersion: () => Promise<{ version: string | number; name?: string }>;
    checkAppLocation: () => Promise<{
      inApplications?: boolean;
      shouldPrompt?: boolean;
      appPath?: string;
      path?: string;
    }>;

    // Permission checks (migrated from window.electron)
    checkPermissions: () => Promise<{
      hasPermission?: boolean;
      fullDiskAccess?: boolean;
      contacts?: boolean;
    }>;
    triggerFullDiskAccess: () => Promise<{ granted: boolean }>;
    requestPermissions: () => Promise<Record<string, unknown>>;
    openSystemSettings: () => Promise<{ success: boolean }>;

    // Existing system methods
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
      google?: {
        connected: boolean;
        email?: string;
        error?: {
          type: string;
          userMessage: string;
          action?: string;
          actionHandler?: string;
        } | null;
      };
      microsoft?: {
        connected: boolean;
        email?: string;
        error?: {
          type: string;
          userMessage: string;
          action?: string;
          actionHandler?: string;
        } | null;
      };
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
    setupFullDiskAccess: () => Promise<void>;
    checkFullDiskAccess: () => Promise<{ granted: boolean }>;
    checkContactsPermission: () => Promise<{ granted: boolean }>;
    checkAllPermissions: () => Promise<{
      allGranted: boolean;
      permissions: {
        fullDiskAccess?: { hasPermission: boolean; error?: string };
        contacts?: { hasPermission: boolean; error?: string };
      };
      errors: Array<{ hasPermission: boolean; error?: string }>;
    }>;
    contactSupport: (
      errorDetails?: string,
    ) => Promise<{ success: boolean; error?: string }>;
    getDiagnostics: () => Promise<{
      success: boolean;
      diagnostics?: string;
      error?: string;
    }>;
    showInFolder: (filePath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    /** Reindex database for performance optimization */
    reindexDatabase: () => Promise<{
      success: boolean;
      indexesRebuilt?: number;
      durationMs?: number;
      error?: string;
    }>;
    /**
     * Check if a user exists in the local database
     * BACKLOG-611: Used to determine if secure-storage step should be shown
     * even on machines with previous installs (different user)
     */
    checkUserInLocalDb: (userId: string) => Promise<{
      success: boolean;
      exists: boolean;
      error?: string;
    }>;
    /**
     * Verify user exists in local database, creating if needed.
     * Called by AccountVerificationStep after DB init and before email connection.
     * @returns User verification result with userId on success
     */
    verifyUserInLocalDb: () => Promise<{
      success: boolean;
      userId?: string;
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

  /**
   * Sync API for iPhone message/contact synchronization
   */
  sync: {
    /** Start a sync operation */
    start: (options: {
      udid: string;
      password?: string;
      forceFullBackup?: boolean;
    }) => Promise<SyncResult>;

    /** Cancel current sync operation */
    cancel: () => Promise<{ success: boolean }>;

    /** Get current sync status */
    getStatus: () => Promise<{
      isRunning: boolean;
      phase: string;
    }>;

    /**
     * Get unified sync status (aggregates backup + orchestrator state)
     * TASK-904: Use this to check if any sync operation is running
     */
    getUnifiedStatus: () => Promise<UnifiedSyncStatus>;

    /** Get connected devices */
    getDevices: () => Promise<iOSDeviceInfo[]>;

    /** Start device detection polling */
    startDetection: (intervalMs?: number) => Promise<{ success: boolean }>;

    /** Stop device detection polling */
    stopDetection: () => Promise<{ success: boolean }>;

    /**
     * Process existing backup without running new backup (for testing/recovery)
     * @param options - Processing options including device UDID and optional password
     */
    processExisting: (options: {
      udid: string;
      password?: string;
    }) => Promise<SyncResult>;

    /** Subscribe to sync progress updates */
    onProgress: (callback: (progress: SyncProgress) => void) => () => void;

    /** Subscribe to sync phase changes */
    onPhase: (callback: (phase: string) => void) => () => void;

    /** Subscribe to device connected events */
    onDeviceConnected: (callback: (device: iOSDeviceInfo) => void) => () => void;

    /** Subscribe to device disconnected events */
    onDeviceDisconnected: (callback: (device: iOSDeviceInfo) => void) => () => void;

    /** Subscribe to password required events */
    onPasswordRequired: (callback: () => void) => () => void;

    /** Subscribe to passcode waiting events (user needs to enter passcode on iPhone) */
    onWaitingForPasscode: (callback: () => void) => () => void;

    /** Subscribe to passcode entered events (user entered passcode, backup starting) */
    onPasscodeEntered: (callback: () => void) => () => void;

    /** Subscribe to sync error events */
    onError: (callback: (error: { message: string }) => void) => () => void;

    /** Subscribe to sync completion events */
    onComplete: (callback: (result: SyncResult) => void) => () => void;

    /** Subscribe to storage completion events (after messages saved to DB) */
    onStorageComplete: (
      callback: (result: {
        messagesStored: number;
        contactsStored: number;
        duration: number;
      }) => void
    ) => () => void;

    /** Subscribe to storage error events */
    onStorageError: (callback: (error: { error: string }) => void) => () => void;
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

    /** Check backup status for a specific device (last sync time, size, etc.) */
    checkStatus: (udid: string) => Promise<{
      success: boolean;
      exists?: boolean;
      isComplete?: boolean;
      isCorrupted?: boolean;
      lastSyncTime?: string | null;
      sizeBytes?: number;
      error?: string;
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

  // Contacts API
  contacts: {
    getAll: (userId: string) => Promise<{
      success: boolean;
      contacts?: unknown[];
      error?: string;
    }>;
    getAvailable: (userId: string) => Promise<{
      success: boolean;
      contacts?: unknown[];
      contactsStatus?: unknown;
      error?: string;
    }>;
    import: (userId: string, contactsToImport: unknown[]) => Promise<{
      success: boolean;
      contacts?: unknown[];
      error?: string;
    }>;
    getSortedByActivity: (userId: string, propertyAddress?: string) => Promise<{
      success: boolean;
      contacts?: unknown[];
      error?: string;
    }>;
    create: (userId: string, contactData: unknown) => Promise<{
      success: boolean;
      contact?: unknown;
      error?: string;
    }>;
    update: (contactId: string, updates: unknown) => Promise<{
      success: boolean;
      contact?: unknown;
      error?: string;
    }>;
    checkCanDelete: (contactId: string) => Promise<{
      success: boolean;
      canDelete?: boolean;
      transactions?: unknown[];
      count?: number;
      error?: string;
    }>;
    delete: (contactId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    remove: (contactId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getNamesByPhones: (phones: string[]) => Promise<{
      success: boolean;
      names: Record<string, string>;
      error?: string;
    }>;
    /**
     * Search contacts at database level (for selection modal)
     * Enables searching beyond the initial LIMIT 200 contacts
     * @param userId - User ID to search contacts for
     * @param query - Search query (name, email, phone, company)
     * @returns Matching contacts sorted by relevance
     */
    searchContacts: (userId: string, query: string) => Promise<{
      success: boolean;
      contacts?: unknown[];
      error?: string;
    }>;
    onImportProgress: (
      callback: (progress: { current: number; total: number; percent: number }) => void
    ) => () => void;
    /**
     * Sync external contacts from macOS Contacts app (TASK-1773)
     * @param userId - User ID to sync contacts for
     * @returns Sync result with inserted/deleted/total counts
     */
    syncExternal: (userId: string) => Promise<{
      success: boolean;
      inserted?: number;
      deleted?: number;
      total?: number;
      error?: string;
    }>;
    /**
     * Get external contacts sync status (TASK-1773)
     * @param userId - User ID to check status for
     * @returns Sync status (lastSyncAt, isStale, contactCount)
     */
    getExternalSyncStatus: (userId: string) => Promise<{
      success: boolean;
      lastSyncAt?: string | null;
      isStale?: boolean;
      contactCount?: number;
      error?: string;
    }>;
    /** Sync Outlook contacts to external_contacts table */
    syncOutlookContacts: (userId: string) => Promise<{
      success: boolean;
      count?: number;
      reconnectRequired?: boolean;
      error?: string;
    }>;
    /** Force re-import: wipe ALL external contacts then return */
    forceReimport: (userId: string) => Promise<{
      success: boolean;
      cleared: number;
      error?: string;
    }>;
    /** Get contact source stats - per-source counts */
    getSourceStats: (userId: string) => Promise<{
      success: boolean;
      stats?: Record<string, number>;
      error?: string;
    }>;
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

    /**
     * Get earliest communication date for a set of contacts (TASK-1974)
     * Used by audit wizard to auto-detect transaction start date
     * @param contactIds - Array of contact IDs to search
     * @param userId - User ID who owns the communications
     * @returns Earliest communication date (ISO string) or null
     */
    getEarliestCommunicationDate: (
      contactIds: string[],
      userId: string,
    ) => Promise<{
      success: boolean;
      date?: string | null;
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
      transaction?: Transaction & {
        communications?: unknown[];
        contact_assignments?: unknown[];
      };
      error?: string;
    }>;
    getWithContacts: (transactionId: string) => Promise<{
      success: boolean;
      transaction?: Record<string, unknown>;
      contacts?: Array<Record<string, unknown>>;
      error?: string;
    }>;
    /**
     * PERF: Lightweight overview - contacts only, no communications.
     * Use this for initial load; fetch full details only when needed.
     */
    getOverview: (transactionId: string) => Promise<{
      success: boolean;
      transaction?: Transaction & {
        contact_assignments?: unknown[];
      };
      error?: string;
    }>;
    /**
     * PERF: Filtered communications - only emails or only texts.
     * Much faster than getDetails when transaction has many communications.
     */
    getCommunications: (transactionId: string, channelFilter?: "email" | "text") => Promise<{
      success: boolean;
      transaction?: Transaction & {
        communications?: unknown[];
        contact_assignments?: unknown[];
      };
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
    /**
     * Batch update contact assignments for a transaction
     * Performs multiple add/remove operations in a single atomic transaction
     */
    batchUpdateContacts: (
      transactionId: string,
      operations: Array<{
        action: "add" | "remove";
        contactId: string;
        role?: string;
        roleCategory?: string;
        specificRole?: string;
        isPrimary?: boolean;
        notes?: string;
      }>,
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
      options: {
        exportFormat?: string;
        contentType?: "text" | "email" | "both";
        representationStartDate?: string;
        closingDate?: string;
        startDate?: string;
        endDate?: string;
        summaryOnly?: boolean;
      },
    ) => Promise<{
      success: boolean;
      filePath?: string;
      path?: string;
      error?: string;
    }>;
    /**
     * Export transaction to an organized folder structure
     * Creates: Summary_Report.pdf, emails/, texts/, attachments/
     */
    exportFolder: (
      transactionId: string,
      options?: {
        includeEmails?: boolean;
        includeTexts?: boolean;
        includeAttachments?: boolean;
        emailExportMode?: "thread" | "individual";
      },
    ) => Promise<{
      success: boolean;
      path?: string;
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
      status: "pending" | "active" | "closed" | "rejected",
    ) => Promise<{
      success: boolean;
      updatedCount?: number;
      errors?: string[];
      error?: string;
    }>;
    /**
     * Gets unlinked messages (SMS/iMessage not attached to any transaction)
     */
    getUnlinkedMessages: (userId: string) => Promise<{
      success: boolean;
      messages?: unknown[];
      error?: string;
    }>;
    /**
     * Gets unlinked emails (not attached to any transaction)
     * Supports server-side search with query, date range, and pagination (TASK-1993)
     */
    getUnlinkedEmails: (
      userId: string,
      options?: {
        query?: string;
        after?: string;
        before?: string;
        maxResults?: number;
        skip?: number;
        transactionId?: string;
      },
    ) => Promise<{
      success: boolean;
      emails?: Array<{
        id: string;
        subject: string | null;
        sender: string | null;
        sent_at: string | null;
        body_preview?: string | null;
        email_thread_id?: string | null;
        has_attachments?: boolean;
      }>;
      error?: string;
    }>;
    /**
     * Gets distinct contacts with unlinked message counts
     */
    getMessageContacts: (userId: string) => Promise<{
      success: boolean;
      contacts?: unknown[];
      error?: string;
    }>;
    /**
     * Gets unlinked messages for a specific contact
     */
    getMessagesByContact: (userId: string, contact: string) => Promise<{
      success: boolean;
      messages?: unknown[];
      error?: string;
    }>;
    /**
     * Links messages to a transaction
     */
    linkMessages: (
      messageIds: string[],
      transactionId: string,
    ) => Promise<{
      success: boolean;
      error?: string;
    }>;
    /**
     * Unlinks messages from a transaction (sets transaction_id to null)
     */
    unlinkMessages: (messageIds: string[], transactionId?: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    /**
     * Link emails to a transaction
     */
    linkEmails: (emailIds: string[], transactionId: string) => Promise<{
      success: boolean;
      linked?: number;
      error?: string;
    }>;
    /**
     * Auto-links text messages to a transaction based on assigned contacts
     */
    autoLinkTexts: (transactionId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    /**
     * Sync emails from provider (Gmail/Outlook) for a transaction.
     * Fetches NEW emails from connected email provider based on
     * contact email addresses, stores them, then runs auto-link.
     */
    syncAndFetchEmails: (transactionId: string) => Promise<{
      success: boolean;
      provider?: "gmail" | "outlook";
      emailsFetched?: number;
      emailsStored?: number;
      totalEmailsLinked?: number;
      totalMessagesLinked?: number;
      totalAlreadyLinked?: number;
      totalErrors?: number;
      error?: string;
      message?: string;
    }>;
    /**
     * Re-syncs auto-link communications for all contacts on a transaction.
     * Useful when contacts have been updated with new email/phone info.
     */
    resyncAutoLink: (transactionId: string) => Promise<{
      success: boolean;
      contactsProcessed?: number;
      totalEmailsLinked?: number;
      totalMessagesLinked?: number;
      totalAlreadyLinked?: number;
      totalErrors?: number;
      message?: string;
      error?: string;
    }>;

    // ============================================
    // SUBMISSION METHODS (BACKLOG-391)
    // ============================================

    /**
     * Submit transaction to broker portal for review
     */
    submit: (transactionId: string) => Promise<{
      success: boolean;
      submissionId?: string;
      messagesCount?: number;
      attachmentsCount?: number;
      attachmentsFailed?: number;
      error?: string;
    }>;

    /**
     * Resubmit transaction (creates new version)
     */
    resubmit: (transactionId: string) => Promise<{
      success: boolean;
      submissionId?: string;
      messagesCount?: number;
      attachmentsCount?: number;
      attachmentsFailed?: number;
      error?: string;
    }>;

    /**
     * Get submission status from cloud
     */
    getSubmissionStatus: (submissionId: string) => Promise<{
      success: boolean;
      status?: string;
      reviewNotes?: string;
      reviewedBy?: string;
      reviewedAt?: string;
      error?: string;
    }>;

    /**
     * Listen for submission progress updates
     */
    onSubmitProgress: (callback: (progress: {
      stage: string;
      stageProgress: number;
      overallProgress: number;
      currentItem?: string;
    }) => void) => () => void;

    // ============================================
    // SYNC METHODS (BACKLOG-395)
    // ============================================

    /**
     * Trigger manual sync of submission statuses
     */
    syncSubmissions: () => Promise<{
      success: boolean;
      updated?: number;
      failed?: number;
      details?: Array<{
        transactionId: string;
        propertyAddress: string;
        oldStatus: string;
        newStatus: string;
        reviewNotes?: string;
      }>;
      error?: string;
    }>;

    /**
     * Sync a specific transaction's submission status
     */
    syncSubmission: (transactionId: string) => Promise<{
      success: boolean;
      updated?: boolean;
      error?: string;
    }>;

    /**
     * Listen for submission status change events
     */
    onSubmissionStatusChanged: (callback: (data: {
      transactionId: string;
      propertyAddress: string;
      oldStatus: string;
      newStatus: string;
      reviewNotes?: string;
      title: string;
      message: string;
    }) => void) => () => void;

    // ============================================
    // EMAIL ATTACHMENT METHODS (TASK-1776)
    // ============================================

    /**
     * Backfill missing email attachments (runs in background after login)
     * Downloads attachments for emails that have has_attachments=true but no DB records
     */
    backfillAttachments: (userId: string) => Promise<{
      success: boolean;
      error?: string;
    }>;

    /**
     * Get attachments for a specific email
     * @param emailId - Email ID to get attachments for
     * @returns Array of attachment records
     */
    getEmailAttachments: (emailId: string) => Promise<{
      success: boolean;
      data?: Array<{
        id: string;
        filename: string;
        mime_type: string | null;
        file_size_bytes: number | null;
        storage_path: string | null;
      }>;
      error?: string;
    }>;

    /**
     * Open attachment with system viewer
     * @param storagePath - Path to attachment file
     * @returns Success/error result
     */
    openAttachment: (storagePath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;

    /**
     * Get attachment counts from actual attachments table (TASK-1781)
     * Returns counts matching what submission service will upload
     * @param transactionId - Transaction ID
     * @param auditStart - Optional audit start date (ISO string)
     * @param auditEnd - Optional audit end date (ISO string)
     * @returns Counts for text and email attachments
     */
    getAttachmentCounts: (
      transactionId: string,
      auditStart?: string,
      auditEnd?: string
    ) => Promise<{
      success: boolean;
      data?: {
        textAttachments: number;
        emailAttachments: number;
        total: number;
      };
      error?: string;
    }>;

    /**
     * Get attachment data as base64 data URL for preview
     * TASK-1778: Returns data: URL for images/PDFs
     * @param storagePath - Path to attachment file
     * @param mimeType - MIME type for the data URL
     * @returns Success/error result with data URL in data field
     */
    getAttachmentData: (storagePath: string, mimeType: string) => Promise<{
      success: boolean;
      data?: string;
      error?: string;
    }>;

    /**
     * Get attachment buffer as raw base64 (for DOCX conversion)
     * TASK-1783: Returns raw base64 without data: URL prefix for mammoth.js
     * @param storagePath - Path to attachment file
     * @returns Success/error result with base64 data in data field
     */
    getAttachmentBuffer: (storagePath: string) => Promise<{
      success: boolean;
      data?: string;
      error?: string;
    }>;
  };

  // Transaction scan progress event
  onTransactionScanProgress: (
    callback: (progress: { step: string; message: string }) => void,
  ) => () => void;

  // Folder export progress event
  onExportFolderProgress: (
    callback: (progress: { stage: string; current: number; total: number; message: string }) => void,
  ) => () => void;

  // ==========================================
  // DEEP LINK AUTH EVENTS (TASK-1500, enhanced TASK-1507)
  // ==========================================

  /**
   * Listen for deep link auth callback with tokens and license status
   * Fired when app receives magicaudit://callback and auth/license validation succeeds
   * TASK-1507: Enhanced to include user, license, and device data
   */
  onDeepLinkAuthCallback: (
    callback: (data: {
      accessToken: string;
      refreshToken: string;
      userId?: string;
      user?: {
        id: string;
        email?: string;
        name?: string;
      };
      licenseStatus?: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        trialDaysRemaining?: number;
        transactionCount: number;
        transactionLimit: number;
        canCreateTransaction: boolean;
        deviceCount: number;
        deviceLimit: number;
        aiEnabled: boolean;
        blockReason?: string;
      };
      device?: {
        id: string;
        device_id: string;
        device_name: string | null;
      };
    }) => void,
  ) => () => void;

  /**
   * Listen for deep link auth errors
   * Fired when callback URL is invalid, tokens are missing, or auth fails
   */
  onDeepLinkAuthError: (
    callback: (data: { error: string; code: "MISSING_TOKENS" | "INVALID_URL" | "INVALID_TOKENS" | "UNKNOWN_ERROR" }) => void,
  ) => () => void;

  /**
   * Listen for deep link license blocked events (TASK-1507)
   * Fired when user authenticates successfully but license is expired/suspended
   */
  onDeepLinkLicenseBlocked: (
    callback: (data: {
      accessToken: string;
      refreshToken: string;
      userId: string;
      blockReason: string;
      licenseStatus: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        blockReason?: string;
      };
    }) => void,
  ) => () => void;

  /**
   * Listen for deep link device limit events (TASK-1507)
   * Fired when user authenticates successfully but device registration fails due to limit
   */
  onDeepLinkDeviceLimit: (
    callback: (data: {
      accessToken: string;
      refreshToken: string;
      userId: string;
      licenseStatus: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        deviceCount: number;
        deviceLimit: number;
      };
    }) => void,
  ) => () => void;

  // User preferences API
  user: {
    /**
     * Gets user's mobile phone type preference from local database
     * @param userId - User ID to get phone type for
     * @returns Phone type result
     */
    getPhoneType: (
      userId: string
    ) => Promise<{
      success: boolean;
      phoneType: "iphone" | "android" | null;
      error?: string;
    }>;

    /**
     * Sets user's mobile phone type preference in local database
     * @param userId - User ID to set phone type for
     * @param phoneType - Phone type ('iphone' | 'android')
     * @returns Set result
     */
    setPhoneType: (
      userId: string,
      phoneType: "iphone" | "android"
    ) => Promise<{ success: boolean; error?: string }>;

    /**
     * Gets user's phone type from Supabase cloud storage
     * TASK-1600: Pre-DB phone type retrieval (available before local DB init)
     * @param userId - User ID to get phone type for
     * @returns Phone type result from Supabase user_preferences
     */
    getPhoneTypeCloud: (
      userId: string
    ) => Promise<{
      success: boolean;
      phoneType?: "iphone" | "android";
      error?: string;
    }>;

    /**
     * Sets user's phone type in Supabase cloud storage
     * TASK-1600: Pre-DB phone type storage (always available after auth)
     * @param userId - User ID to set phone type for
     * @param phoneType - Phone type ('iphone' | 'android')
     * @returns Set result
     */
    setPhoneTypeCloud: (
      userId: string,
      phoneType: "iphone" | "android"
    ) => Promise<{ success: boolean; error?: string }>;

    /**
     * Syncs user's phone type from Supabase cloud to local database
     * Used by DataSyncStep to ensure local DB has phone_type before FDA step
     * @param userId - User ID to sync phone type for
     * @returns Sync result
     */
    syncPhoneTypeFromCloud: (
      userId: string
    ) => Promise<{ success: boolean; error?: string }>;
  };

  // Error Logging API (TASK-1800)
  errorLogging: {
    /**
     * Submit an error report to Supabase
     * @param payload - Error details and optional user feedback
     * @returns Result with success status and error ID
     */
    submit: (payload: {
      errorType: string;
      errorCode?: string;
      errorMessage: string;
      stackTrace?: string;
      currentScreen?: string;
      userFeedback?: string;
      breadcrumbs?: Record<string, unknown>[];
      appState?: Record<string, unknown>;
    }) => Promise<{
      success: boolean;
      errorId?: string;
      error?: string;
    }>;
    /**
     * Process queued errors (call when connection restored)
     * @returns Number of errors successfully processed
     */
    processQueue: () => Promise<{
      success: boolean;
      processedCount?: number;
      error?: string;
    }>;
    /**
     * Get current queue size (for diagnostics)
     * @returns Queue size
     */
    getQueueSize: () => Promise<{
      success: boolean;
      queueSize?: number;
      error?: string;
    }>;
  };

  // App Reset API (TASK-1802)
  app: {
    /**
     * Perform a complete app data reset
     * WARNING: This is a destructive operation that will:
     * - Delete all local data (database, preferences, cached data)
     * - Restart the app fresh
     *
     * Cloud data (Supabase) is NOT affected.
     *
     * @returns Result with success status
     */
    reset: () => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  // License API
  license: {
    /** Get current user's license information */
    get: () => Promise<{
      success: boolean;
      license?: {
        license_type: "individual" | "team" | "enterprise";
        ai_detection_enabled: boolean;
        organization_id?: string;
      };
      error?: string;
    }>;
    /** Refresh license data from database */
    refresh: () => Promise<{
      success: boolean;
      license?: {
        license_type: "individual" | "team" | "enterprise";
        ai_detection_enabled: boolean;
        organization_id?: string;
      };
      error?: string;
    }>;

    // ============================================
    // SPRINT-062: License Validation Methods
    // ============================================

    /** Validates the user's license status */
    validate: (userId: string) => Promise<{
      isValid: boolean;
      licenseType: "trial" | "individual" | "team";
      trialStatus?: "active" | "expired" | "converted";
      trialDaysRemaining?: number;
      transactionCount: number;
      transactionLimit: number;
      canCreateTransaction: boolean;
      deviceCount: number;
      deviceLimit: number;
      aiEnabled: boolean;
      blockReason?: "expired" | "limit_reached" | "no_license" | "suspended";
    }>;

    /** Creates a trial license for a new user */
    create: (userId: string) => Promise<{
      isValid: boolean;
      licenseType: "trial" | "individual" | "team";
      trialStatus?: "active" | "expired" | "converted";
      trialDaysRemaining?: number;
      transactionCount: number;
      transactionLimit: number;
      canCreateTransaction: boolean;
      deviceCount: number;
      deviceLimit: number;
      aiEnabled: boolean;
      blockReason?: "expired" | "limit_reached" | "no_license" | "suspended";
    }>;

    /** Increments the user's transaction count */
    incrementTransactionCount: (userId: string) => Promise<number>;

    /** Clears the license cache (call on logout) */
    clearCache: () => Promise<void>;

    /** Checks if an action is allowed based on license status */
    canPerformAction: (
      status: {
        isValid: boolean;
        licenseType: "trial" | "individual" | "team";
        transactionCount: number;
        transactionLimit: number;
        canCreateTransaction: boolean;
        deviceCount: number;
        deviceLimit: number;
        aiEnabled: boolean;
        blockReason?: "expired" | "limit_reached" | "no_license" | "suspended";
      },
      action: "create_transaction" | "use_ai" | "export"
    ) => Promise<boolean>;

    // ============================================
    // SPRINT-062: Device Registration Methods
    // ============================================

    /** Registers the current device for the user */
    registerDevice: (userId: string) => Promise<{
      success: boolean;
      device?: {
        id: string;
        user_id: string;
        device_id: string;
        device_name: string | null;
        os: string | null;
        platform: "macos" | "windows" | "linux" | null;
        app_version: string | null;
        is_active: boolean;
        last_seen_at: string;
        activated_at: string;
      };
      error?: "device_limit_reached" | "already_registered" | "unknown";
    }>;

    /** Lists all registered devices for a user */
    listRegisteredDevices: (userId: string) => Promise<Array<{
      id: string;
      user_id: string;
      device_id: string;
      device_name: string | null;
      os: string | null;
      platform: "macos" | "windows" | "linux" | null;
      app_version: string | null;
      is_active: boolean;
      last_seen_at: string;
      activated_at: string;
    }>>;

    /** Deactivates a device */
    deactivateDevice: (userId: string, deviceId: string) => Promise<void>;

    /** Deletes a device registration */
    deleteDevice: (userId: string, deviceId: string) => Promise<void>;

    /** Gets the current device's ID */
    getCurrentDeviceId: () => Promise<string>;

    /** Checks if the current device is registered */
    isDeviceRegistered: (userId: string) => Promise<boolean>;

    /** Sends a heartbeat to update device last_seen_at */
    deviceHeartbeat: (userId: string) => Promise<void>;
  };

  // Privacy / CCPA data export (TASK-2053)
  privacy: {
    /** Export all personal data as a JSON file (CCPA compliance) */
    exportData: (userId: string) => Promise<{
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
    /** Listen for export progress updates */
    onExportProgress: (callback: (progress: {
      category: string;
      progress: number;
    }) => void) => () => void;
  };

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
