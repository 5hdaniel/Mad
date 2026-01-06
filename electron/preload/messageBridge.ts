/**
 * Message Bridge
 * iMessage conversation methods for macOS
 */

import { ipcRenderer } from "electron";

/**
 * Progress event from macOS message import
 */
export interface ImportProgress {
  current: number;
  total: number;
  percent: number;
}

/**
 * Result of macOS message import
 */
export interface MacOSImportResult {
  success: boolean;
  messagesImported: number;
  messagesSkipped: number;
  duration: number;
  error?: string;
}

export const messageBridge = {
  /**
   * Gets iMessage conversations from Messages database
   * @returns List of conversations
   */
  getConversations: () => ipcRenderer.invoke("get-conversations"),

  /**
   * Gets messages for a specific chat
   * @param chatId - Chat ID to get messages for
   * @returns List of messages
   */
  getMessages: (chatId: string) => ipcRenderer.invoke("get-messages", chatId),

  /**
   * Exports conversations to text files
   * @param conversationIds - Array of conversation IDs to export
   * @returns Export result
   */
  exportConversations: (conversationIds: string[]) =>
    ipcRenderer.invoke("export-conversations", conversationIds),

  /**
   * Import messages from macOS Messages app into the app database
   * This enables linking messages to transactions on macOS
   * @param userId - User ID to associate messages with
   * @returns Import result with counts
   */
  importMacOSMessages: (userId: string): Promise<MacOSImportResult> =>
    ipcRenderer.invoke("messages:import-macos", userId),

  /**
   * Get count of messages available for import from macOS Messages
   * @returns Count of available messages
   */
  getImportCount: (): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke("messages:get-import-count"),

  /**
   * Listen for import progress updates
   * @param callback - Called with progress updates during import
   * @returns Cleanup function to remove listener
   */
  onImportProgress: (callback: (progress: ImportProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ImportProgress) => {
      callback(progress);
    };
    ipcRenderer.on("messages:import-progress", handler);
    return () => {
      ipcRenderer.removeListener("messages:import-progress", handler);
    };
  },
};
