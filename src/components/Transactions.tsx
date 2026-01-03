/**
 * Transactions Component
 * Main transaction management interface for Magic Audit
 *
 * This component serves as the coordinator for transaction listing,
 * filtering, bulk operations, and navigation to detail views.
 *
 * Extracted components:
 * - DetectionBadges (DetectionSourceBadge, ConfidencePill, PendingReviewBadge)
 * - TransactionDetails (modal for viewing/editing transaction details)
 * - EditTransactionModal (modal for editing transactions)
 */
import React, { useState, useEffect } from "react";
import AuditTransactionModal from "./AuditTransactionModal";
import ExportModal from "./ExportModal";
import {
  BulkActionBar,
  BulkDeleteConfirmModal,
  BulkExportModal,
} from "./BulkActionBar";
import { useSelection } from "../hooks/useSelection";
import { useAppStateMachine } from "../appCore";
import {
  TransactionDetails,
  TransactionListCard,
  TransactionsToolbar,
} from "./transaction";
import type { Transaction } from "../../electron/types/models";

// ============================================
// TYPES
// ============================================

interface ScanProgress {
  step: string;
  message: string;
}

interface TransactionsProps {
  userId: string;
  provider?: string; // Optional - will auto-detect if not provided
  onClose: () => void;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (amount: number | undefined): string => {
  if (!amount) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string | Date | undefined): string => {
  if (!dateString) return "N/A";
  const date =
    typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ============================================
// TRANSACTIONS COMPONENT
// ============================================

/**
 * Transactions Component
 * Main transaction management interface
 * Lists transactions, triggers scans, shows progress
 */
function Transactions({
  userId,
  provider,
  onClose,
}: TransactionsProps): React.ReactElement {
  // Database initialization guard (belt-and-suspenders defense)
  const { isDatabaseInitialized } = useAppStateMachine();

  // Core state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "closed" | "all">(
    "active"
  );
  const [showAuditCreate, setShowAuditCreate] = useState<boolean>(false);
  const [quickExportTransaction, setQuickExportTransaction] =
    useState<Transaction | null>(null);
  const [quickExportSuccess, setQuickExportSuccess] = useState<string | null>(
    null
  );

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
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(
    null
  );
  const [selectionMode, setSelectionMode] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================

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

  // DEFENSIVE CHECK: Return loading state if database not initialized
  // Should never trigger if AppShell gate works, but prevents errors if bypassed
  if (!isDatabaseInitialized) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Waiting for database...</p>
        </div>
      </div>
    );
  }

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getAll(userId);

      if (result.success) {
        setTransactions((result.transactions as Transaction[]) || []);
      } else {
        setError(result.error || "Failed to load transactions");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load transactions";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SCAN HANDLERS
  // ============================================

  const handleScanProgress = (progress: unknown) => {
    setScanProgress(progress as ScanProgress);
  };

  const startScan = async () => {
    try {
      setScanning(true);
      setError(null);
      setScanProgress({ step: "starting", message: "Starting scan..." });

      const result = await window.api.transactions.scan(userId, {});

      if (result.success) {
        setScanProgress({
          step: "complete",
          message: `Found ${result.transactionsFound} transactions from ${result.emailsScanned} emails!`,
        });
        await loadTransactions();
      } else {
        setError(result.error || "Scan failed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Scan failed";
      if (!errorMessage.includes("cancelled")) {
        setError(errorMessage);
      }
    } finally {
      setScanning(false);
      setTimeout(() => setScanProgress(null), 3000);
    }
  };

  const stopScan = async () => {
    try {
      await window.api.transactions.cancelScan(userId);
      setScanProgress(null);
    } catch (err) {
      console.error("Failed to stop scan:", err);
    }
  };

  // ============================================
  // FILTERING
  // ============================================

  const filteredTransactions = transactions.filter((t: Transaction) => {
    const matchesSearch = t.property_address
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && t.status === "active") ||
      (statusFilter === "closed" && t.status === "closed");
    return matchesSearch && matchesStatus;
  });

  // ============================================
  // SELECTION HANDLERS
  // ============================================

  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      deselectAll();
      setSelectionMode(false);
    } else {
      setSelectionMode(true);
    }
  };

  const handleCloseBulkEdit = () => {
    deselectAll();
    setSelectionMode(false);
  };

  const handleTransactionClick = (transaction: Transaction) => {
    if (selectionMode) {
      toggleSelection(transaction.id);
    } else {
      setSelectedTransaction(transaction);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent, transactionId: string) => {
    e.stopPropagation();
    toggleSelection(transactionId);
  };

  const handleSelectAll = () => {
    selectAll(filteredTransactions);
  };

  // ============================================
  // EXPORT HANDLERS
  // ============================================

  const handleQuickExport = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickExportTransaction(transaction);
  };

  const handleQuickExportComplete = (result: unknown) => {
    const exportResult = result as { path?: string };
    setQuickExportTransaction(null);
    setQuickExportSuccess(
      exportResult.path || "Export completed successfully!"
    );
    setTimeout(() => setQuickExportSuccess(null), 5000);
    loadTransactions();
  };

  // ============================================
  // BULK ACTION HANDLERS
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;

    setIsBulkDeleting(true);
    try {
      const result = await window.api.transactions.bulkDelete(
        Array.from(selectedIds)
      );

      if (result.success) {
        setBulkActionSuccess(
          `Successfully deleted ${result.deletedCount || selectedCount} transaction${(result.deletedCount || selectedCount) > 1 ? "s" : ""}`
        );
        deselectAll();
        setSelectionMode(false);
        await loadTransactions();
      } else {
        setError(result.error || "Failed to delete transactions");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete transactions";
      setError(errorMessage);
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  const handleBulkExport = async (format: string) => {
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
            { exportFormat: format }
          );
          if (result.success) {
            successCount++;
          } else {
            errors.push(result.error || `Failed to export transaction`);
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : "Export failed");
        }
      }

      if (successCount > 0) {
        setBulkActionSuccess(
          `Successfully exported ${successCount} transaction${successCount > 1 ? "s" : ""}${errors.length > 0 ? ` (${errors.length} failed)` : ""}`
        );
        deselectAll();
        setSelectionMode(false);
        await loadTransactions();
      } else {
        setError("Failed to export transactions");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to export transactions";
      setError(errorMessage);
    } finally {
      setIsBulkExporting(false);
      setShowBulkExportModal(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  const handleBulkStatusChange = async (
    status: "pending" | "active" | "closed" | "rejected"
  ) => {
    if (selectedCount === 0) return;

    setIsBulkUpdating(true);
    try {
      const result = await window.api.transactions.bulkUpdateStatus(
        Array.from(selectedIds),
        status
      );

      if (result.success) {
        setBulkActionSuccess(
          `Successfully updated ${result.updatedCount || selectedCount} transaction${(result.updatedCount || selectedCount) > 1 ? "s" : ""} to ${status}`
        );
        deselectAll();
        setSelectionMode(false);
        await loadTransactions();
      } else {
        setError(result.error || "Failed to update transactions");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update transactions";
      setError(errorMessage);
    } finally {
      setIsBulkUpdating(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col overflow-hidden">
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
      <TransactionsToolbar
        transactionCount={transactions.length}
        transactions={transactions}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectionMode={selectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
        onNewTransaction={() => setShowAuditCreate(true)}
        onStartScan={startScan}
        onStopScan={stopScan}
        scanning={scanning}
        scanProgress={scanProgress}
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
            {filteredTransactions.map((transaction: Transaction) => (
              <TransactionListCard
                key={transaction.id}
                transaction={transaction}
                selectionMode={selectionMode}
                isSelected={isSelected(transaction.id)}
                onTransactionClick={handleTransactionClick}
                onCheckboxClick={handleCheckboxClick}
                onQuickExport={handleQuickExport}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <TransactionDetails
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onTransactionUpdated={loadTransactions}
        />
      )}

      {/* Audit Transaction Creation Modal */}
      {showAuditCreate && (
        <AuditTransactionModal
          userId={userId}
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
          onClose={handleCloseBulkEdit}
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

export default Transactions;
