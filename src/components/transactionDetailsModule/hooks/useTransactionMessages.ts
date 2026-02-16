/**
 * useTransactionMessages Hook
 * Filters pre-loaded communications to text messages (SMS/iMessage).
 * PERF: No longer calls getDetails — receives communications from useTransactionDetails.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import type { Transaction, Communication } from "@/types";

interface UseTransactionMessagesResult {
  /** Text messages linked to the transaction (SMS and iMessage only) */
  messages: Communication[];
  /** Whether messages are currently being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh the messages list (re-fetches from backend) */
  refresh: () => Promise<void>;
}

/**
 * Hook for text messages linked to a transaction.
 * Filters pre-loaded communications to SMS/iMessage channels.
 * Falls back to fetching from backend if communications aren't provided.
 *
 * @param transaction - The transaction to fetch messages for
 * @param communications - Pre-loaded communications from useTransactionDetails (avoids duplicate getDetails call)
 * @returns Messages data, loading state, error state, and refresh function
 */
export function useTransactionMessages(
  transaction: Transaction,
  communications?: Communication[],
): UseTransactionMessagesResult {
  // If communications are provided, filter locally (no IPC call)
  const derivedMessages = useMemo(() => {
    if (!communications) return null;
    return communications.filter(
      (comm: Communication) =>
        comm.channel === "sms" ||
        comm.channel === "imessage" ||
        comm.communication_type === "text" ||
        comm.communication_type === "imessage"
    );
  }, [communications]);

  // Fallback state for when communications aren't provided or for refresh
  const [fetchedMessages, setFetchedMessages] = useState<Communication[]>([]);
  const [loading, setLoading] = useState<boolean>(!communications);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch messages from backend (used for refresh or fallback)
   */
  const loadMessages = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success && result.transaction) {
        const allCommunications: Communication[] =
          result.transaction.communications || [];

        const textMessages = allCommunications.filter(
          (comm: Communication) =>
            comm.channel === "sms" ||
            comm.channel === "imessage" ||
            comm.communication_type === "text" ||
            comm.communication_type === "imessage"
        );

        setFetchedMessages(textMessages);
      } else {
        setFetchedMessages([]);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError("Failed to load messages");
      setFetchedMessages([]);
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  // Only fetch from backend if communications aren't provided
  useEffect(() => {
    if (!communications) {
      loadMessages();
    }
  }, [communications, loadMessages]);

  // Update loading state when communications arrive
  useEffect(() => {
    if (communications) {
      setLoading(false);
    }
  }, [communications]);

  return {
    messages: derivedMessages ?? fetchedMessages,
    loading: communications ? false : loading,
    error,
    refresh: loadMessages,
  };
}
