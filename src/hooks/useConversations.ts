/**
 * Custom hook for managing conversations data
 * Handles loading conversations from the electron backend
 */
import { useState, useEffect } from 'react';

/**
 * Conversation structure from iMessage database
 * This represents a single conversation/chat thread
 */
export interface Conversation {
  id: string;
  chat_identifier: string;
  display_name?: string;
  participants?: string[];
  last_message_date?: number;
  message_count?: number;
  [key: string]: unknown; // Allow additional properties from the database
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
 * Custom hook for managing conversations data
 * Loads iMessage conversations from the electron backend
 * @returns Conversations state and reload function
 */
export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result: GetConversationsResult = await window.electron.getConversations();

      if (result.success) {
        setConversations(result.conversations || []);
      } else {
        setError(result.error || 'Failed to load contacts');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return {
    conversations,
    isLoading,
    error,
    reload: loadConversations
  };
}
