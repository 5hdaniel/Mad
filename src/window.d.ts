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
  // Add main API types here if needed
  // (Currently most code uses window.electron, not window.api)
}

// Augment the global Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
    api: MainAPI;
  }
}

export {};
