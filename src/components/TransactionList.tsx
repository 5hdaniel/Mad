import React, { useState, useEffect, useMemo } from "react";
import type { Transaction, OAuthProvider } from "@/types";
import AuditTransactionModal from "./AuditTransactionModal";
import ExportModal from "./ExportModal";
import TransactionDetails from "./TransactionDetails";
import {
  BulkActionBar,
  BulkDeleteConfirmModal,
  BulkExportModal,
} from "./BulkActionBar";
import { useSelection } from "../hooks/useSelection";

interface ScanProgress {
  step: string;
  message: string;
}

// ============================================
// DETECTION BADGE COMPONENTS
// ============================================

/**
 * Badge showing manual entry - only shown for manually created transactions
 * (AI-detected is the default, no badge needed)
 */
function ManualEntryBadge({
  source,
}: {
  source: "auto" | "manual" | "hybrid" | undefined;
}) {
  // Only show badge for manually entered transactions
  if (source !== "manual") {
    return null;
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500 text-white">
      Manual
    </span>
  );
}

/**
 * Confidence indicator bar with color gradient
 */
function ConfidenceBar({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined || confidence === null) {
    return null;
  }

  const percentage =
    confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  let barColor: string;
  if (percentage < 60) {
    barColor = "bg-red-500";
  } else if (percentage < 80) {
    barColor = "bg-amber-500";
  } else {
    barColor = "bg-emerald-500";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600">{percentage}%</span>
    </div>
  );
}

// ============================================
// PENDING REVIEW WRAPPER COMPONENT
// ============================================

interface PendingReviewWrapperProps {
  transaction: Transaction;
  onReviewClick: () => void;
  children: React.ReactNode;
}

/**
 * Wrapper component for pending transactions - like product packaging
 * Displays review header above the transaction card with:
 * - Left: Confidence bar
 * - Center: "Pending Review" label
 * - Right: "Review & Edit" button
 */
function PendingReviewWrapper({
  transaction,
  onReviewClick,
  children,
}: PendingReviewWrapperProps) {
  const handleReviewClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onReviewClick();
  };

  return (
    <div className="relative">
      {/* Review Header - The "packaging" */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 border-b-0 rounded-t-xl px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Confidence */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
              Confidence
            </span>
            <ConfidenceBar confidence={transaction.detection_confidence} />
          </div>

          {/* Center: Pending Review Label */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-amber-800">
              Pending Review
            </span>
          </div>

          {/* Right: Review & Edit Button */}
          <button
            onClick={handleReviewClick}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all bg-amber-500 text-white hover:bg-amber-600 shadow-sm hover:shadow flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Review & Edit
          </button>
        </div>
      </div>

      {/* Transaction Card - The "product" */}
      <div className="border-2 border-amber-300 border-t-0 rounded-b-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

interface TransactionListComponentProps {
  userId: string;
  provider: OAuthProvider;
  onClose: () => void;
}

/**
 * TransactionList Component
 * Main transaction management interface
 * Lists transactions, triggers scans, shows progress
 */
function TransactionList({
  userId,
  provider,
  onClose,
}: TransactionListComponentProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [pendingReviewTransaction, setPendingReviewTransaction] =
    useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuditCreate, setShowAuditCreate] = useState<boolean>(false);
  const [quickExportTransaction, setQuickExportTransaction] =
    useState<Transaction | null>(null);
  const [quickExportSuccess, setQuickExportSuccess] = useState<string | null>(
    null,
  );

  // Consolidated filter - combines status and detection into one
  const [filter, setFilter] = useState<
    "all" | "pending" | "active" | "closed" | "rejected"
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilter = params.get("filter");
    if (
      urlFilter === "pending" ||
      urlFilter === "active" ||
      urlFilter === "closed" ||
      urlFilter === "rejected"
    ) {
      return urlFilter;
    }
    return "all";
  });

  // Selection state for bulk operations
  const {
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    isSelected,
    count: selectedCount,
  } = useSelection();

  // Bulk action state
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    loadTransactions();

    // Listen for scan progress
    let cleanup: (() => void) | undefined;
    if (window.api?.onTransactionScanProgress) {
      cleanup = window.api.onTransactionScanProgress(handleScanProgress);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Sync filter to URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [filter]);

  // Compute filter counts
  const filterCounts = useMemo(
    () => ({
      all: transactions.length,
      pending: transactions.filter((t) => t.detection_status === "pending")
        .length,
      active: transactions.filter(
        (t) => t.status === "active" && t.detection_status !== "pending" && t.detection_status !== "rejected"
      ).length,
      closed: transactions.filter((t) => t.status === "closed").length,
      rejected: transactions.filter((t) => t.detection_status === "rejected")
        .length,
    }),
    [transactions],
  );

  const loadTransactions = async (): Promise<void> => {
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
  };

  const handleScanProgress = (progress: unknown): void => {
    const scanProgress = progress as ScanProgress;
    setScanProgress(scanProgress);
  };

  const startScan = async (): Promise<void> => {
    try {
      setScanning(true);
      setError(null);
      setScanProgress({ step: "starting", message: "Starting scan..." });

      const result = await window.api.transactions.scan(userId, {
        // provider omitted - backend auto-detects all connected mailboxes
        // startDate and maxEmails are read from user preferences in the backend
      });

      if (result.success) {
        setScanProgress({
          step: "complete",
          message: `Found ${result.transactionsFound} transactions from ${result.emailsScanned} emails!`,
        });

        // Reload transactions
        await loadTransactions();
      } else {
        setError(result.error || "Scan failed");
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      // Don't show error if it was a cancellation
      if (!errorMessage.includes("cancelled")) {
        setError(errorMessage);
      }
    } finally {
      setScanning(false);
      setTimeout(() => setScanProgress(null), 3000);
    }
  };

  const stopScan = async (): Promise<void> => {
    try {
      await window.api.transactions.cancelScan(userId);
      // Clear scan progress immediately without showing a message
      setScanProgress(null);
    } catch (err) {
      console.error("Failed to stop scan:", err);
    }
  };

  const formatCurrency = (amount: number | null | undefined): string => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.property_address
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());

    let matchesFilter = false;
    switch (filter) {
      case "all":
        matchesFilter = true;
        break;
      case "pending":
        matchesFilter = t.detection_status === "pending";
        break;
      case "active":
        // Active = status is active AND not pending review AND not rejected
        matchesFilter = t.status === "active" &&
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

  const handleQuickExport = (
    transaction: Transaction,
    e: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    e.stopPropagation(); // Prevent opening transaction details
    setQuickExportTransaction(transaction);
  };

  const handleQuickExportComplete = (result: unknown): void => {
    const exportResult = result as { path?: string };
    setQuickExportTransaction(null);
    setQuickExportSuccess(
      exportResult.path || "Export completed successfully!",
    );
    // Auto-hide success message after 5 seconds
    setTimeout(() => setQuickExportSuccess(null), 5000);
    // Reload transactions to update export status
    loadTransactions();
  };

  // Toggle bulk edit mode
  const handleToggleBulkEdit = (): void => {
    if (selectionMode) {
      deselectAll();
      setSelectionMode(false);
    } else {
      setSelectionMode(true);
    }
  };

  // Handle transaction card click (either select or open details)
  const handleTransactionClick = (transaction: Transaction): void => {
    if (selectionMode) {
      toggleSelection(transaction.id);
    } else if (transaction.detection_status === "pending") {
      // Pending transactions open in review mode with approve/reject buttons
      setPendingReviewTransaction(transaction);
    } else {
      setSelectedTransaction(transaction);
    }
  };

  // Handle checkbox click separately to prevent event bubbling
  const handleCheckboxClick = (e: React.MouseEvent, transactionId: string): void => {
    e.stopPropagation();
    toggleSelection(transactionId);
  };

  // Bulk delete handler
  const handleBulkDelete = async (): Promise<void> => {
    if (selectedCount === 0) return;

    setIsBulkDeleting(true);
    try {
      const result = await (window.api.transactions as any).bulkDelete(
        Array.from(selectedIds),
      );

      if (result.success) {
        setBulkActionSuccess(
          `Successfully deleted ${result.deletedCount || selectedCount} transaction${(result.deletedCount || selectedCount) > 1 ? "s" : ""}`,
        );
        deselectAll();
        setSelectionMode(false);
        await loadTransactions();
      } else {
        setError(result.error || "Failed to delete transactions");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // Bulk export handler
  const handleBulkExport = async (format: string): Promise<void> => {
    if (selectedCount === 0) return;

    setIsBulkExporting(true);
    try {
      const selectedTransactionIds = Array.from(selectedIds);
      let successCount = 0;
      const errors: string[] = [];

      for (const transactionId of selectedTransactionIds) {
        try {
          const result = await window.api.transactions.exportEnhanced(
            transactionId,
            { exportFormat: format },
          );
          if (result.success) {
            successCount++;
          } else {
            errors.push(result.error || `Failed to export transaction`);
          }
        } catch (err) {
          errors.push((err as Error).message);
        }
      }

      if (successCount > 0) {
        setBulkActionSuccess(
          `Successfully exported ${successCount} transaction${successCount > 1 ? "s" : ""}${errors.length > 0 ? ` (${errors.length} failed)` : ""}`,
        );
        deselectAll();
        setSelectionMode(false);
        await loadTransactions();
      } else {
        setError("Failed to export transactions");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBulkExporting(false);
      setShowBulkExportModal(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async (status: "active" | "closed"): Promise<void> => {
    if (selectedCount === 0) return;

    setIsBulkUpdating(true);
    try {
      const result = await (window.api.transactions as any).bulkUpdateStatus(
        Array.from(selectedIds),
        status,
      );

      if (result.success) {
        setBulkActionSuccess(
          `Successfully updated ${result.updatedCount || selectedCount} transaction${(result.updatedCount || selectedCount) > 1 ? "s" : ""} to ${status}`,
        );
        deselectAll();
        setSelectionMode(false);
        await loadTransactions();
      } else {
        setError(result.error || "Failed to update transactions");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsBulkUpdating(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // Handle select all for filtered transactions
  const handleSelectAll = (): void => {
    selectAll(filteredTransactions);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-6 flex items-center justify-between shadow-lg">
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-all flex items-center gap-2 font-medium"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Dashboard
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-white">Transactions</h2>
          <p className="text-blue-100 text-sm">
            {transactions.length} properties found
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 p-6 bg-white shadow-md">
        {/* Consolidated Filter Tabs */}
        <div className="inline-flex items-center bg-gray-200 rounded-lg p-1 mb-3">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              filter === "all"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-300">
              {filterCounts.all}
            </span>
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              filter === "pending"
                ? "bg-white text-amber-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Pending Review
            {filterCounts.pending > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {filterCounts.pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              filter === "active"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Active
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {filterCounts.active}
            </span>
          </button>
          <button
            onClick={() => setFilter("closed")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              filter === "closed"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Closed
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-300">
              {filterCounts.closed}
            </span>
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              filter === "rejected"
                ? "bg-white text-red-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Rejected
            {filterCounts.rejected > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                {filterCounts.rejected}
              </span>
            )}
          </button>

          {/* Status Info Button */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowStatusInfo(!showStatusInfo)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              title="What do these statuses mean?"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Status Info Tooltip */}
            {showStatusInfo && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowStatusInfo(false)}
                />
                {/* Tooltip */}
                <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-20">
                  <h4 className="font-semibold text-gray-900 mb-3">Transaction Statuses</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="w-3 h-3 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Pending Review</p>
                        <p className="text-sm text-gray-600">Auto-detected transaction awaiting your approval</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Active</p>
                        <p className="text-sm text-gray-600">Confirmed real estate transaction in progress</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-3 h-3 rounded-full bg-gray-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Closed</p>
                        <p className="text-sm text-gray-600">Completed transaction (deal closed)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Rejected</p>
                        <p className="text-sm text-gray-600">Not a real transaction (false positive)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Bulk Edit Button */}
          <button
            onClick={handleToggleBulkEdit}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              selectionMode
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            {selectionMode ? "Cancel" : "Bulk Edit"}
          </button>

          {/* Audit New Transaction Button */}
          <button
            onClick={() => setShowAuditCreate(true)}
            className="px-4 py-2 rounded-lg font-semibold transition-all bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            New Transaction
          </button>

          {/* Scan/Stop Button */}
          {scanning ? (
            <button
              onClick={stopScan}
              className="px-4 py-2 rounded-lg font-semibold transition-all bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Stop Scan
              </span>
            </button>
          ) : (
            <button
              onClick={startScan}
              className="px-4 py-2 rounded-lg font-semibold transition-all bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md hover:shadow-lg"
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Auto Detect
              </span>
            </button>
          )}
        </div>

        {/* Scan Progress */}
        {scanProgress && (
          <div
            className={`mt-3 p-3 border rounded-lg ${
              scanProgress.step === "cancelled"
                ? "bg-orange-50 border-orange-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {scanProgress.step !== "complete" &&
                scanProgress.step !== "cancelled" && (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                )}
              {scanProgress.step === "complete" && (
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {scanProgress.step === "cancelled" && (
                <svg
                  className="w-5 h-5 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
              <span
                className={`text-sm font-medium ${
                  scanProgress.step === "cancelled"
                    ? "text-orange-900"
                    : "text-blue-900"
                }`}
              >
                {scanProgress.message}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Quick Export Success */}
        {quickExportSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  Export completed successfully!
                </p>
                <p className="text-xs text-green-700 mt-1 break-all">
                  {quickExportSuccess}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Success */}
        {bulkActionSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  {bulkActionSuccess}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading transactions...</p>
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery
                  ? "No matching transactions"
                  : "No transactions yet"}
              </h3>
              {searchQuery && (
                <p className="text-gray-600 mb-4">Try adjusting your search</p>
              )}
              {!searchQuery && (
                <button
                  onClick={() => setShowAuditCreate(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Audit new transaction
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredTransactions.map((transaction) => {
              const isPending = transaction.detection_status === "pending";

              // Transaction card content - reused for both pending and non-pending
              const cardContent = (
                <div
                  className={`bg-white p-6 hover:shadow-xl transition-all cursor-pointer ${
                    isPending
                      ? "" // No border/rounding when wrapped
                      : `border-2 rounded-xl transform hover:scale-[1.01] ${
                          selectionMode && isSelected(transaction.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-400"
                        }`
                  }`}
                  onClick={() => handleTransactionClick(transaction)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Selection checkbox */}
                    {selectionMode && (
                      <div
                        className="flex-shrink-0 mt-1"
                        onClick={(e) => handleCheckboxClick(e, transaction.id)}
                      >
                        <div
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected(transaction.id)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300 hover:border-blue-400"
                          }`}
                        >
                          {isSelected(transaction.id) && (
                            <svg
                              className="w-4 h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {transaction.property_address}
                        </h3>
                        {/* Manual badge for manually entered transactions */}
                        <ManualEntryBadge
                          source={transaction.detection_source}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {transaction.transaction_type && (
                          <span className="flex items-center gap-1">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                transaction.transaction_type === "purchase"
                                  ? "bg-green-500"
                                  : "bg-blue-500"
                              }`}
                            ></span>
                            {transaction.transaction_type === "purchase"
                              ? "Purchase"
                              : "Sale"}
                          </span>
                        )}
                        {transaction.sale_price && (
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(transaction.sale_price)}
                          </span>
                        )}
                        {transaction.closing_date && (
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            Closed: {formatDate(transaction.closing_date)}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          {transaction.total_communications_count || 0} emails
                        </span>
                        {transaction.extraction_confidence && (
                          <span className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{
                                  width: `${transaction.extraction_confidence}%`,
                                }}
                              ></div>
                            </div>
                            {transaction.extraction_confidence}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Quick Export Button - only for non-pending transactions */}
                      {!isPending && (
                        <button
                          onClick={(e) => handleQuickExport(transaction, e)}
                          className="px-3 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg"
                          title="Quick Export"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          Export
                        </button>
                      )}
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              );

              // Wrap pending transactions in the review wrapper
              return isPending ? (
                <PendingReviewWrapper
                  key={transaction.id}
                  transaction={transaction}
                  onReviewClick={() => setPendingReviewTransaction(transaction)}
                >
                  {cardContent}
                </PendingReviewWrapper>
              ) : (
                <div key={transaction.id}>{cardContent}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction Details Modal (regular) */}
      {selectedTransaction && (
        <TransactionDetails
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onTransactionUpdated={loadTransactions}
        />
      )}

      {/* Transaction Details Modal (pending review mode) */}
      {pendingReviewTransaction && (
        <TransactionDetails
          transaction={pendingReviewTransaction}
          onClose={() => setPendingReviewTransaction(null)}
          onTransactionUpdated={loadTransactions}
          isPendingReview={true}
          userId={userId}
        />
      )}

      {/* Audit Transaction Creation Modal */}
      {showAuditCreate && (
        <AuditTransactionModal
          userId={parseInt(userId)}
          provider={provider}
          onClose={() => setShowAuditCreate(false)}
          onSuccess={() => {
            setShowAuditCreate(false);
            loadTransactions();
          }}
        />
      )}

      {/* Quick Export Modal */}
      {quickExportTransaction && (
        <ExportModal
          transaction={quickExportTransaction}
          userId={quickExportTransaction.user_id}
          onClose={() => setQuickExportTransaction(null)}
          onExportComplete={handleQuickExportComplete}
        />
      )}

      {/* Bulk Action Bar */}
      {selectionMode && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={filteredTransactions.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={deselectAll}
          onBulkDelete={() => setShowBulkDeleteConfirm(true)}
          onBulkExport={() => setShowBulkExportModal(true)}
          onBulkStatusChange={handleBulkStatusChange}
          onClose={handleToggleBulkEdit}
          isDeleting={isBulkDeleting}
          isExporting={isBulkExporting}
          isUpdating={isBulkUpdating}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <BulkDeleteConfirmModal
          selectedCount={selectedCount}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          isDeleting={isBulkDeleting}
        />
      )}

      {/* Bulk Export Modal */}
      {showBulkExportModal && (
        <BulkExportModal
          selectedCount={selectedCount}
          onConfirm={handleBulkExport}
          onCancel={() => setShowBulkExportModal(false)}
          isExporting={isBulkExporting}
        />
      )}
    </div>
  );
}

export default TransactionList;
