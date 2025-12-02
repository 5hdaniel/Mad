/**
 * Window API type definitions
 * Extends the global Window interface with Electron IPC APIs
 */

import type { GetConversationsResult } from './hooks/useConversations';

/**
 * Legacy electron namespace (maintained for backward compatibility)
 * Exposed via contextBridge in preload.js
 */
interface ElectronAPI {
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
  exportConversations: (conversationIds: string[]) => Promise<{ success: boolean; exportPath?: string }>;

  // Transactions
  transactions: {
    scan: () => Promise<{ success: boolean }>;
    getAll: () => Promise<unknown[]>;
    update: (id: string, data: unknown) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
  };
  onTransactionScanProgress: (callback: (progress: unknown) => void) => () => void;

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
  outlookExportEmails: (contacts: Array<{
    name: string;
    chatId?: string;
    emails?: string[];
    phones?: string[];
  }>) => Promise<{ success: boolean; error?: string; canceled?: boolean; exportPath?: string; results?: Array<{
    contactName: string;
    success: boolean;
    textMessageCount: number;
    emailCount?: number;
    error: string | null;
  }> }>;
  outlookSignout: () => Promise<{ success: boolean }>;
  onDeviceCode: (callback: (info: unknown) => void) => () => void;
  onExportProgress: (callback: (progress: unknown) => void) => () => void;
}

/**
 * Main API namespace (preferred for new code)
 * Exposed via contextBridge in preload.js
 */
interface MainAPI {
  auth: {
    googleLogin: () => Promise<{ success: boolean; authUrl?: string; error?: string }>;
    googleCompleteLogin: (code: string) => Promise<{
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }>;
    googleConnectMailbox: (userId: string) => Promise<{ success: boolean; error?: string }>;
    microsoftLogin: () => Promise<{ success: boolean; authUrl?: string; scopes?: string[]; error?: string }>;
    microsoftConnectMailbox: (userId: string) => Promise<{ success: boolean; error?: string }>;
    logout: (sessionToken: string) => Promise<{ success: boolean; error?: string }>;
    validateSession: (sessionToken: string) => Promise<{ valid: boolean; user?: unknown; error?: string }>;
    getCurrentUser: () => Promise<{
      success: boolean;
      user?: unknown;
      sessionToken?: string;
      provider?: string;
      subscription?: unknown;
      isNewUser?: boolean;
      error?: string;
    }>;
    acceptTerms: (userId: string) => Promise<{ success: boolean; user?: unknown; error?: string }>;
    completeEmailOnboarding: (userId: string) => Promise<{ success: boolean; error?: string }>;
    checkEmailOnboarding: (userId: string) => Promise<{ success: boolean; completed: boolean; error?: string }>;
  };
  system: {
    checkAllConnections: (userId: string) => Promise<{
      success: boolean;
      google?: { connected: boolean; email?: string };
      microsoft?: { connected: boolean; email?: string };
      error?: string;
    }>;
    healthCheck: (userId: string, provider: string) => Promise<{
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
    contactSupport: (errorDetails?: string) => Promise<{ success: boolean; error?: string }>;
    getDiagnostics: () => Promise<{ success: boolean; diagnostics?: string; error?: string }>;
  };
  onGoogleMailboxConnected: (callback: (result: { success: boolean }) => void) => () => void;
  onMicrosoftMailboxConnected: (callback: (result: { success: boolean }) => void) => () => void;

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
        phase: 'preparing' | 'transferring' | 'finishing' | 'extracting';
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

    /** Cancel an in-progress backup */
    cancel: () => Promise<{ success: boolean }>;

    /** List all existing backups */
    list: () => Promise<Array<{
      path: string;
      deviceUdid: string;
      createdAt: Date;
      size: number;
      isEncrypted: boolean;
      iosVersion: string | null;
      deviceName: string | null;
    }>>;

    /** Delete a specific backup */
    delete: (backupPath: string) => Promise<{ success: boolean; error?: string }>;

    /** Clean up old backups */
    cleanup: (keepCount?: number) => Promise<{ success: boolean; error?: string }>;

    /** Extract only HomeDomain files and delete the rest (reduces 20-60 GB to ~1-2 GB) */
    extractHomeDomain: (backupPath: string) => Promise<{
      success: boolean;
      filesKept: number;
      filesDeleted: number;
      spaceFreed: number;
      error?: string;
    }>;

    /** Subscribe to backup progress updates */
    onProgress: (callback: (progress: {
      phase: 'preparing' | 'transferring' | 'finishing' | 'extracting';
      percentComplete: number;
      currentFile: string | null;
      filesTransferred: number;
      totalFiles: number | null;
      bytesTransferred: number;
      totalBytes: number | null;
      estimatedTimeRemaining: number | null;
    }) => void) => () => void;

    /** Subscribe to backup completion events */
    onComplete: (callback: (result: {
      success: boolean;
      backupPath: string | null;
      error: string | null;
      duration: number;
      deviceUdid: string;
      isIncremental: boolean;
      backupSize: number;
    }) => void) => () => void;

    /** Subscribe to backup error events */
    onError: (callback: (error: { message: string }) => void) => () => void;
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
