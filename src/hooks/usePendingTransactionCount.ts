import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface UsePendingTransactionCountResult {
  pendingCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and track the count of pending auto-detected transactions.
 *
 * BACKLOG-1124: Uses the dedicated getPendingCount IPC handler that runs
 * a SQL COUNT query server-side, instead of fetching all transactions
 * and filtering client-side (which serialized the entire array over IPC).
 *
 * The hook handles:
 * - Initial fetch on mount (when user is authenticated)
 * - Loading and error states
 * - Refetch capability for manual refresh
 */
export function usePendingTransactionCount(): UsePendingTransactionCountResult {
  const { currentUser } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingCount = useCallback(async () => {
    if (!currentUser?.id) {
      setPendingCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.api.transactions.getPendingCount(currentUser.id);
      if (result.success && result.count !== undefined) {
        setPendingCount(result.count);
      } else {
        setError(result.error || "Failed to fetch pending count");
        setPendingCount(0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setPendingCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  // Fetch on mount and when user changes
  useEffect(() => {
    if (currentUser?.id) {
      fetchPendingCount();
    }
  }, [currentUser?.id, fetchPendingCount]);

  return {
    pendingCount,
    isLoading,
    error,
    refetch: fetchPendingCount,
  };
}

export default usePendingTransactionCount;
