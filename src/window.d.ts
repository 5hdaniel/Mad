/**
 * Window API type definitions
 * Extends the global Window interface with Electron IPC APIs
 */

import type { GetConversationsResult } from './hooks/useConversations';
import type { iOSDevice, BackupProgress } from './types/iphone';

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
  platform: 'darwin' | 'win32' | 'linux' | string;

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

  // iOS Device Detection (Windows only)
  device?: {
    startDetection: () => void;
    stopDetection: () => void;
    onConnected: (callback: (device: iOSDevice) => void) => (() => void) | undefined;
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
    onProgress: (callback: (progress: BackupProgress) => void) => (() => void) | undefined;
  };
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
  device: {
    /** Lists all currently connected iOS devices */
    list: () => Promise<{ success: boolean; devices?: iOSDeviceInfo[]; error?: string }>;
    /** Starts device detection polling */
    startDetection: () => Promise<{ success: boolean; error?: string }>;
    /** Stops device detection polling */
    stopDetection: () => Promise<{ success: boolean; error?: string }>;
    /** Checks if libimobiledevice tools are available */
    checkAvailability: () => Promise<{ success: boolean; available?: boolean; error?: string }>;
    /** Subscribes to device connected events */
    onConnected: (callback: (device: iOSDeviceInfo) => void) => () => void;
    /** Subscribes to device disconnected events */
    onDisconnected: (callback: (device: iOSDeviceInfo) => void) => () => void;
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
