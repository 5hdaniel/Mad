/**
 * Custom hook for managing conversations data
 * Handles loading conversations from the electron backend
 */
import { useState, useEffect } from "react";

/**
 * Conversation structure from iMessage database
 * This represents a single conversation/chat thread with contact info
 */
export interface Conversation {
  id: string;
  chatId?: string;
  name: string;
  contactId?: string;
  phones?: string[];
  emails?: string[];
  directChatCount: number;
  groupChatCount: number;
  directMessageCount: number;
  groupMessageCount: number;
  messageCount?: number;
  lastMessageDate: Date | string | number;
  showBothNameAndNumber?: boolean;
}

/**
 * Result structure from getConversations IPC call
 */
export interface GetConversationsResult {
  success: boolean;
  conversations?: Conversation[];
  error?: string;
}

/**
 * Return type for useConversations hook
 */
export interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Custom hook for managing conversations data.
 * Loads conversations from macOS chat.db or local messages table
 * depending on user's phone type (BACKLOG-1470).
 *
 * @param userId - Optional user ID; when provided, the backend checks
 *   mobile_phone_type and routes to the appropriate data source.
 * @returns Conversations state and reload function
 */
export function useConversations(userId?: string | null): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result: GetConversationsResult =
        await window.api.messages.getConversations(userId ?? undefined);

      if (result.success) {
        setConversations(result.conversations || []);
      } else {
        setError(result.error || "Failed to load contacts");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [userId]);

  return {
    conversations,
    isLoading,
    error,
    reload: loadConversations,
  };
}
