/**
 * Message Bridge
 * iMessage conversation methods for macOS
 */

import { ipcRenderer } from "electron";

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
};
