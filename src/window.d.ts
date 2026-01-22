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
 * Progress event from macOS message import
 */
interface MacOSImportProgress {
  current: number;
  total: number;
  percent: number;
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
    getImportCount: () => Promise<{ success: boolean; count?: number; error?: string }>;
    /** Listen for import progress updates */
    onImportProgress: (callback: (progress: MacOSImportProgress) => void) => () => void;
    /** Get attachments for a message with base64 data (TASK-1012) */
    getMessageAttachments: (messageId: string) => Promise<MessageAttachmentInfo[]>;
    /** Get attachments for multiple messages at once (TASK-1012) */
    getMessageAttachmentsBatch: (messageIds: string[]) => Promise<Record<string, MessageAttachmentInfo[]>>;
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
  };

  // Shell operations
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean }>;
    openFolder: (folderPath: string) => Promise<{ success: boolean }>;
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
    unlinkMessages: (messageIds: string[]) => Promise<{
      success: boolean;
      error?: string;
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
  };

  // Transaction scan progress event
  onTransactionScanProgress: (
    callback: (progress: { step: string; message: string }) => void,
  ) => () => void;

  // Folder export progress event
  onExportFolderProgress: (
    callback: (progress: { stage: string; current: number; total: number; message: string }) => void,
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
