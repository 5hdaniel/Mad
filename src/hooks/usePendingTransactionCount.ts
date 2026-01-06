import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import type { Transaction } from "../types";

interface UsePendingTransactionCountResult {
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and track the count of pending auto-detected transactions.
 *
 * Uses the transactions.getAll API and filters client-side for
 * detection_status === 'pending'. This is acceptable for dashboard
 * display purposes where we only need the count.
 *
 * The hook handles:
 * - Initial fetch on mount (when user is authenticated)
 * - Memoization of the pending count
 * - Loading and error states
 * - Refetch capability for manual refresh
 */
export function usePendingTransactionCount(): UsePendingTransactionCountResult {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!currentUser?.id) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.transactions.getAll(currentUser.id);
      if (result.success && result.transactions) {
        setTransactions(result.transactions);
      } else {
        setError(result.error || "Failed to fetch transactions");
        setTransactions([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  // Fetch on mount and when user changes
  useEffect(() => {
    if (currentUser?.id) {
      fetchTransactions();
    }
  }, [currentUser?.id, fetchTransactions]);

  // Memoize the pending count calculation
  const pendingCount = useMemo(() => {
    return transactions.filter((t) => t.detection_status === "pending").length;
  }, [transactions]);

  return {
    pendingCount,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}

export default usePendingTransactionCount;
