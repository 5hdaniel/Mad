/**
 * Message Service
 *
 * Service abstraction for message-related API calls (iMessage/macOS Messages).
 * Centralizes all window.api.messages calls and provides type-safe wrappers.
 */

import { getErrorMessage } from "./index";

/**
 * Message import status
 */
export interface MessageImportStatus {
  isRunning: boolean;
  progress?: number;
  total?: number;
  error?: string;
}

/**
 * Conversation data from messages
 */
export interface ConversationData {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageDate?: string;
  messageCount?: number;
}

/**
 * Message service - wraps window.api.messages methods
 */
export const messageService = {
  /**
   * Get conversations from macOS Messages
   */
  async getConversations(
    userId: string,
    options?: Record<string, unknown>
  ): Promise<{ success: boolean; conversations?: ConversationData[]; error?: string }> {
    try {
      if (!window.api.messages) {
        return { success: false, error: "Messages API not available" };
      }
      return await window.api.messages.getConversations(userId, options);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get import count (number of messages available for import)
   */
  async getImportCount(
    userId: string
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      if (!window.api.messages) {
        return { success: false, error: "Messages API not available" };
      }
      return await window.api.messages.getImportCount(userId);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get current import status
   */
  async getImportStatus(): Promise<MessageImportStatus> {
    try {
      if (!window.api.messages) {
        return { isRunning: false };
      }
      return await window.api.messages.getImportStatus();
    } catch {
      return { isRunning: false };
    }
  },

  /**
   * Import macOS Messages for a user
   */
  async importMacOSMessages(
    userId: string,
    options?: Record<string, unknown>
  ): Promise<{ success: boolean; imported?: number; error?: string }> {
    try {
      if (!window.api.messages) {
        return { success: false, error: "Messages API not available" };
      }
      return await window.api.messages.importMacOSMessages(userId, options);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Export conversations
   */
  async exportConversations(
    options: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!window.api.messages) {
        return { success: false, error: "Messages API not available" };
      }
      return await window.api.messages.exportConversations(options);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get message attachments in batch
   */
  async getMessageAttachmentsBatch(
    messageIds: string[]
  ): Promise<{ success: boolean; attachments?: Record<string, unknown>[]; error?: string }> {
    try {
      if (!window.api.messages) {
        return { success: false, error: "Messages API not available" };
      }
      return await window.api.messages.getMessageAttachmentsBatch(messageIds);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Register callback for import progress events
   */
  onImportProgress(
    callback: (progress: { current: number; total: number; phase?: string }) => void
  ): (() => void) | undefined {
    if (!window.api.messages) return undefined;
    return window.api.messages.onImportProgress(callback);
  },
};
