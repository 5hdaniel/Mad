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
import { ToastContainer } from "./Toast";
import { useSelection } from "../hooks/useSelection";
import { useToast } from "../hooks/useToast";
import TransactionStatusWrapper from "./transaction/TransactionStatusWrapper";
import TransactionCard from "./transaction/TransactionCard";
import TransactionToolbar from "./transaction/TransactionToolbar";

interface ScanProgress {
  step: string;
  message: string;
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

  // Toast notifications - lifted from TransactionDetails so toasts persist after modal close
  const { toasts, showSuccess, showError, removeToast } = useToast();

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
      {/* Header and Toolbar */}
      <TransactionToolbar
        transactionCount={transactions.length}
        onClose={onClose}
        filter={filter}
        onFilterChange={setFilter}
        filterCounts={filterCounts}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        scanning={scanning}
        scanProgress={scanProgress}
        onStartScan={startScan}
        onStopScan={stopScan}
        selectionMode={selectionMode}
        onToggleSelectionMode={handleToggleBulkEdit}
        showStatusInfo={showStatusInfo}
        onToggleStatusInfo={() => setShowStatusInfo(!showStatusInfo)}
        onNewTransaction={() => setShowAuditCreate(true)}
        error={error}
        quickExportSuccess={quickExportSuccess}
        bulkActionSuccess={bulkActionSuccess}
      />

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
              const isRejected = transaction.detection_status === "rejected";

              // Handle wrapper action button click based on status
              const handleWrapperAction = (e: React.MouseEvent<HTMLButtonElement>) => {
                if (isPending) {
                  // Open review modal for pending
                  setPendingReviewTransaction(transaction);
                } else if (isRejected) {
                  // Open details to restore for rejected
                  setSelectedTransaction(transaction);
                } else {
                  // Open export modal for active/closed
                  handleQuickExport(transaction, e);
                }
              };

              // Wrap ALL transactions with the unified status wrapper
              return (
                <TransactionStatusWrapper
                  key={transaction.id}
                  transaction={transaction}
                  onActionClick={handleWrapperAction}
                >
                  <TransactionCard
                    transaction={transaction}
                    selectionMode={selectionMode}
                    isSelected={isSelected(transaction.id)}
                    onTransactionClick={() => handleTransactionClick(transaction)}
                    onCheckboxClick={(e) => handleCheckboxClick(e, transaction.id)}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                  />
                </TransactionStatusWrapper>
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
          userId={userId}
          onShowSuccess={showSuccess}
          onShowError={showError}
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
          onShowSuccess={showSuccess}
          onShowError={showError}
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

      {/* Toast Notifications - persists after modal close */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default TransactionList;
