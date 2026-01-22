/**
 * Custom hook for managing transaction list data
 * Handles loading, filtering, searching, and count calculations
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import type { Transaction } from "@/types";

/**
 * Filter counts for transaction status tabs
 */
export interface FilterCounts {
  all: number;
  pending: number;
  active: number;
  closed: number;
  rejected: number;
}

/**
 * Filter type for transaction status
 */
export type TransactionFilter = "all" | "pending" | "active" | "closed" | "rejected";

/**
 * Return type for useTransactionList hook
 */
export interface UseTransactionListResult {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  loading: boolean;
  error: string | null;
  filterCounts: FilterCounts;
  refetch: () => Promise<void>;
  setError: (error: string | null) => void;
}

/**
 * Custom hook for managing transaction list data
 * @param userId - User ID to fetch transactions for
 * @param filter - Current filter status
 * @param searchQuery - Search query string
 * @returns Transaction data, filtered results, loading state, and utility functions
 */
export function useTransactionList(
  userId: string,
  filter: TransactionFilter,
  searchQuery: string
): UseTransactionListResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load transactions from the API
   */
  const loadTransactions = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getAll(userId);

      if (result.success) {
        setTransactions(result.transactions || []);
      } else {
        setError(result.error || "Failed to load transactions");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load transactions on mount
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  /**
   * Compute filter counts for status tabs
   */
  const filterCounts = useMemo<FilterCounts>(
    () => ({
      all: transactions.length,
      pending: transactions.filter(
        (t) => t.detection_status === "pending" || t.status === "pending"
      ).length,
      active: transactions.filter(
        (t) =>
          t.status === "active" &&
          t.detection_status !== "pending" &&
          t.detection_status !== "rejected"
      ).length,
      closed: transactions.filter((t) => t.status === "closed").length,
      rejected: transactions.filter((t) => t.detection_status === "rejected")
        .length,
    }),
    [transactions]
  );

  /**
   * Filter transactions based on filter and search query
   */
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = t.property_address
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

      let matchesFilter = false;
      switch (filter) {
        case "all":
          matchesFilter = true;
          break;
        case "pending":
          // Pending = detection_status is pending OR status is pending
          matchesFilter = t.detection_status === "pending" || t.status === "pending";
          break;
        case "active":
          // Active = status is active AND not pending review AND not rejected
          matchesFilter =
            t.status === "active" &&
            t.detection_status !== "pending" &&
            t.detection_status !== "rejected";
          break;
        case "closed":
          matchesFilter = t.status === "closed";
          break;
        case "rejected":
          matchesFilter = t.detection_status === "rejected";
          break;
      }

      return matchesSearch && matchesFilter;
    });
  }, [transactions, filter, searchQuery]);

  return {
    transactions,
    filteredTransactions,
    loading,
    error,
    filterCounts,
    refetch: loadTransactions,
    setError,
  };
}

export default useTransactionList;
