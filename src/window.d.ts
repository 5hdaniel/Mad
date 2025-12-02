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

  // iPhone Integration
  iphoneGetPlatform: () => Promise<{
    platform: string;
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    backupLocations: string[];
  }>;
  iphoneDiscoverBackups: () => Promise<{
    success: boolean;
    backups?: Array<{
      id: string;
      udid: string;
      deviceName: string;
      productVersion?: string;
      lastBackupDate: string;
      backupPath: string;
      isEncrypted: boolean;
      size?: number;
    }>;
    error?: string;
  }>;
  iphoneCheckBackupAvailable: () => Promise<{
    success: boolean;
    available: boolean;
    hasUnencrypted?: boolean;
    backupCount?: number;
    message?: string;
    error?: string;
  }>;
  iphoneGetContacts: (backupId: string) => Promise<{
    success: boolean;
    contacts?: Array<{
      id: string;
      firstName?: string;
      lastName?: string;
      organization?: string;
      displayName: string;
      phoneNumbers: Array<{ label?: string; value: string }>;
      emailAddresses: Array<{ label?: string; value: string }>;
    }>;
    count?: number;
    error?: string;
  }>;
  iphoneGetConversations: (backupId: string) => Promise<{
    success: boolean;
    conversations?: Array<{
      id: string;
      chatIdentifier: string;
      displayName?: string;
      participants: Array<{ id: string; identifier: string; displayName?: string }>;
      isGroupChat: boolean;
      messageCount: number;
      lastMessageDate?: string;
    }>;
    count?: number;
    error?: string;
  }>;
  iphoneGetMessages: (backupId: string, conversationId: string) => Promise<{
    success: boolean;
    messages?: Array<{
      id: string;
      conversationId: string;
      text?: string;
      date: string;
      isFromMe: boolean;
      sender?: string;
      hasAttachments: boolean;
      isRead: boolean;
      messageType: 'sms' | 'imessage';
    }>;
    count?: number;
    error?: string;
  }>;
  iphoneStreamContactMessages: (backupId: string, contactIds: string[]) => Promise<{
    success: boolean;
    contactCount?: number;
    messageCount?: number;
    error?: string;
  }>;
  iphoneExportData: (
    backupId: string,
    contactIds: string[],
    options: { includeMessages: boolean; format: 'txt' | 'json' }
  ) => Promise<{
    success: boolean;
    exportPath?: string;
    contactCount?: number;
    messageCount?: number;
    filesCreated?: string[];
    error?: string;
    canceled?: boolean;
  }>;
  iphoneOpenBackupLocation: () => Promise<{
    success: boolean;
    path?: string;
    error?: string;
    expectedLocations?: string[];
  }>;
  iphoneGetBackupDetails: (backupId: string) => Promise<{
    success: boolean;
    backup?: {
      id: string;
      udid: string;
      deviceName: string;
      productVersion?: string;
      lastBackupDate: string;
      backupPath: string;
      isEncrypted: boolean;
      size?: number;
    };
    error?: string;
  }>;
  onIphoneSyncProgress: (callback: (progress: {
    status: string;
    stage?: string;
    current?: number;
    total?: number;
    message?: string;
    error?: string;
  }) => void) => () => void;
  onIphoneContactData: (callback: (data: {
    contact: unknown;
    messages: unknown[];
    messageCount: number;
  }) => void) => () => void;
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
