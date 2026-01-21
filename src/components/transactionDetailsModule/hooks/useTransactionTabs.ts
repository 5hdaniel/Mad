/**
 * useTransactionTabs Hook
 * Manages tab state for transaction details view
 */
import { useState, useCallback } from "react";
import type { TransactionTab } from "../types";

interface UseTransactionTabsResult {
  activeTab: TransactionTab;
  setActiveTab: (tab: TransactionTab) => void;
  isDetailsTab: boolean;
}

/**
 * Hook for managing transaction details tab state
 */
export function useTransactionTabs(
  initialTab: TransactionTab = "overview"
): UseTransactionTabsResult {
  const [activeTab, setActiveTab] = useState<TransactionTab>(initialTab);

  const handleSetActiveTab = useCallback((tab: TransactionTab) => {
    setActiveTab(tab);
  }, []);

  return {
    activeTab,
    setActiveTab: handleSetActiveTab,
    isDetailsTab: activeTab === "overview",
  };
}
