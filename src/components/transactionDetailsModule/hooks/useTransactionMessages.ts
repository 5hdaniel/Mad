/**
 * useTransactionMessages Hook
 * Fetches and manages text messages (SMS/iMessage) linked to a transaction
 */
import { useState, useEffect, useCallback } from "react";
import type { Transaction, Communication } from "@/types";

interface UseTransactionMessagesResult {
  /** Text messages linked to the transaction (SMS and iMessage only) */
  messages: Communication[];
  /** Whether messages are currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh the messages list */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching text messages linked to a transaction.
 * Filters communications to only include SMS and iMessage channels.
 *
 * @param transaction - The transaction to fetch messages for
 * @returns Messages data, loading state, error state, and refresh function
 */
export function useTransactionMessages(
  transaction: Transaction
): UseTransactionMessagesResult {
  const [messages, setMessages] = useState<Communication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load messages from transaction details
   * Uses transactions.getDetails endpoint and filters for text messages
   */
  const loadMessages = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success && result.transaction) {
        const allCommunications: Communication[] =
          result.transaction.communications || [];

        // Filter for text messages only (SMS and iMessage, exclude email)
        const textMessages = allCommunications.filter(
          (comm: Communication) =>
            comm.channel === "sms" || comm.channel === "imessage"
        );

        setMessages(textMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError("Failed to load messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  /**
   * Load messages when transaction changes
   */
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return {
    messages,
    loading,
    error,
    refresh: loadMessages,
  };
}
