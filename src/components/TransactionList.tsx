import React, { useState, useEffect } from "react";
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
import { useAppStateMachine } from "../appCore";
import {
  // Components
  TransactionStatusWrapper,
  TransactionCard,
  TransactionToolbar,
  // Hooks
  useTransactionList,
  useTransactionScan,
  useBulkActions,
  // Types
  type TransactionFilter,
} from "./transaction";

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
  // Database initialization guard (belt-and-suspenders defense)
  const { isDatabaseInitialized } = useAppStateMachine();

  // UI state for search and filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filter, setFilter] = useState<TransactionFilter>(() => {
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

  // Transaction data management via hook
  const {
    transactions,
    filteredTransactions,
    loading,
    error,
    filterCounts,
    refetch: loadTransactions,
    setError,
  } = useTransactionList(userId, filter, searchQuery);

  // Scan functionality via hook
  const { scanning, scanProgress, startScan, stopScan } = useTransactionScan(
    userId,
    loadTransactions,
    setError
  );

  // Modal state
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [pendingReviewTransaction, setPendingReviewTransaction] =
    useState<Transaction | null>(null);
  const [showAuditCreate, setShowAuditCreate] = useState<boolean>(false);
  const [quickExportTransaction, setQuickExportTransaction] =
    useState<Transaction | null>(null);
  const [quickExportSuccess, setQuickExportSuccess] = useState<string | null>(
    null,
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

  // Bulk action UI state
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Bulk action handlers via hook
  const handleExitSelectionMode = () => {
    deselectAll();
    setSelectionMode(false);
  };

  const {
    isBulkDeleting,
    isBulkExporting,
    isBulkUpdating,
    handleBulkDelete,
    handleBulkExport,
    handleBulkStatusChange,
  } = useBulkActions(selectedIds, selectedCount, {
    onComplete: loadTransactions,
    showSuccess: (msg) => {
      setBulkActionSuccess(msg);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    },
    showError: setError,
    exitSelectionMode: handleExitSelectionMode,
    closeBulkDeleteModal: () => setShowBulkDeleteConfirm(false),
    closeBulkExportModal: () => setShowBulkExportModal(false),
  });

  // Toast notifications - lifted from TransactionDetails so toasts persist after modal close
  const { toasts, showSuccess, showError, removeToast } = useToast();

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

  // DEFENSIVE CHECK: Return loading state if database not initialized
  // Should never trigger if AppShell gate works, but prevents errors if bypassed
  if (!isDatabaseInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Waiting for database...</p>
        </div>
      </div>
    );
  }

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
