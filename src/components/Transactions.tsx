import React, { useState, useEffect } from "react";
import AuditTransactionModal from "./AuditTransactionModal";
import ExportModal from "./ExportModal";
import ContactSelectModal from "./ContactSelectModal";
import {
  BulkActionBar,
  BulkDeleteConfirmModal,
  BulkExportModal,
} from "./BulkActionBar";
import { useSelection } from "../hooks/useSelection";
import {
  ROLE_TO_CATEGORY,
  AUDIT_WORKFLOW_STEPS,
} from "../constants/contactRoles";
import {
  filterRolesByTransactionType,
  getRoleDisplayName,
} from "../utils/transactionRoleUtils";
import type {
  Contact as BaseContact,
  Transaction,
} from "../../electron/types/models";

interface ExtendedContact extends BaseContact {
  address_mention_count?: number;
  last_communication_at?: string | Date;
}

// Type definitions
interface _LocalTransaction {
  id: string;
  user_id: string;
  property_address: string;
  transaction_type: "purchase" | "sale";
  status: "active" | "closed";
  representation_start_date?: string;
  closing_date?: string;
  sale_price?: number;
  listing_price?: number;
  total_communications_count?: number;
  extraction_confidence?: number;
}

interface Communication {
  id: string;
  subject?: string;
  sender?: string;
  sent_at?: string;
  body_plain?: string;
}

interface ContactAssignment {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  role?: string;
  specific_role?: string;
  is_primary: number;
  notes?: string;
}

interface _LocalContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface ScanProgress {
  step: string;
  message: string;
}

interface TransactionsProps {
  userId: string;
  provider?: string; // Optional - will auto-detect if not provided
  onClose: () => void;
}

/**
 * Transactions Component
 * Main transaction management interface
 * Lists transactions, triggers scans, shows progress
 */
function Transactions({ userId, provider, onClose }: TransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "closed" | "all">(
    "active",
  );
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

  // Bulk action state
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);
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

  const handleScanProgress = (progress: unknown) => {
    setScanProgress(progress as ScanProgress);
  };

  const startScan = async () => {
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
      const errorMessage = err instanceof Error ? err.message : "Scan failed";
      // Don't show error if it was a cancellation
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
      // Clear progress immediately - no need to show "Scan stopped" message
      setScanProgress(null);
    } catch (err) {
      console.error("Failed to stop scan:", err);
    }
  };

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

  const handleQuickExport = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening transaction details
    setQuickExportTransaction(transaction);
  };

  const handleQuickExportComplete = (result: unknown) => {
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

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    if (selectionMode) {
      // Exiting selection mode - deselect all and close
      deselectAll();
      setSelectionMode(false);
    } else {
      // Entering selection mode
      setSelectionMode(true);
    }
  };

  // Close bulk edit mode (called by X button)
  const handleCloseBulkEdit = () => {
    deselectAll();
    setSelectionMode(false);
  };

  // Handle transaction card click (either select or open details)
  const handleTransactionClick = (transaction: Transaction) => {
    if (selectionMode) {
      toggleSelection(transaction.id);
    } else {
      setSelectedTransaction(transaction);
    }
  };

  // Handle checkbox click separately to prevent event bubbling
  const handleCheckboxClick = (e: React.MouseEvent, transactionId: string) => {
    e.stopPropagation();
    toggleSelection(transactionId);
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
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
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete transactions";
      setError(errorMessage);
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // Bulk export handler
  const handleBulkExport = async (format: string) => {
    if (selectedCount === 0) return;

    setIsBulkExporting(true);
    try {
      // Export each selected transaction
      const selectedTransactionIds = Array.from(selectedIds);
      let successCount = 0;
      const errors: string[] = [];

      for (const transactionId of selectedTransactionIds) {
        try {
          const result = await window.api.transactions.exportEnhanced(
            transactionId,
            format,
          );
          if (result.success) {
            successCount++;
          } else {
            errors.push(result.error || `Failed to export transaction`);
          }
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : "Export failed",
          );
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
      const errorMessage =
        err instanceof Error ? err.message : "Failed to export transactions";
      setError(errorMessage);
    } finally {
      setIsBulkExporting(false);
      setShowBulkExportModal(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // Bulk status change handler
  const handleBulkStatusChange = async (status: "active" | "closed") => {
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
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update transactions";
      setError(errorMessage);
    } finally {
      setIsBulkUpdating(false);
      setTimeout(() => setBulkActionSuccess(null), 5000);
    }
  };

  // Handle select all for filtered transactions
  const handleSelectAll = () => {
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
        {/* Status Filter Toggle */}
        <div className="inline-flex items-center bg-gray-200 rounded-lg p-1 mb-3">
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              statusFilter === "active"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Active (
            {
              transactions.filter((t: Transaction) => t.status === "active")
                .length
            }
            )
          </button>
          <button
            onClick={() => setStatusFilter("closed")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              statusFilter === "closed"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Closed (
            {
              transactions.filter((t: Transaction) => t.status === "closed")
                .length
            }
            )
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              statusFilter === "all"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All ({transactions.length})
          </button>
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

          {/* Bulk Edit Mode Button */}
          <button
            onClick={handleToggleSelectionMode}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              selectionMode
                ? "bg-purple-500 text-white hover:bg-purple-600 shadow-md"
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
            {selectionMode ? "Exit Bulk Edit" : "Bulk Edit"}
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
            {filteredTransactions.map((transaction: Transaction) => (
              <div
                key={transaction.id}
                className={`bg-white border-2 rounded-xl p-6 transition-all cursor-pointer transform hover:scale-[1.01] ${
                  selectionMode && isSelected(transaction.id)
                    ? "border-purple-500 bg-purple-50 shadow-lg"
                    : "border-gray-200 hover:border-blue-400 hover:shadow-xl"
                }`}
                onClick={() => handleTransactionClick(transaction)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div
                      className="flex-shrink-0 mt-1"
                      onClick={(e) => handleCheckboxClick(e, transaction.id)}
                    >
                      <div
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected(transaction.id)
                            ? "bg-purple-500 border-purple-500"
                            : "border-gray-300 hover:border-purple-400"
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
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {transaction.property_address}
                    </h3>
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
                    {/* Quick Export Button */}
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

/**
 * Transaction Details Modal
 * Shows full details of a single transaction
 */
interface TransactionDetailsProps {
  transaction: Transaction;
  onClose: () => void;
  onTransactionUpdated?: () => void;
}

function TransactionDetails({
  transaction,
  onClose,
  onTransactionUpdated,
}: TransactionDetailsProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [contactAssignments, setContactAssignments] = useState<
    ContactAssignment[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [showArchivePrompt, setShowArchivePrompt] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"details" | "contacts">("details");
  const [unlinkingCommId, setUnlinkingCommId] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<Communication | null>(null);
  const [viewingEmail, setViewingEmail] = useState<Communication | null>(null);

  useEffect(() => {
    loadDetails();
  }, [transaction.id]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success) {
        const txn = result.transaction as {
          communications?: Communication[];
          contact_assignments?: ContactAssignment[];
        };
        setCommunications(txn.communications || []);
        setContactAssignments(txn.contact_assignments || []);
      }
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkCommunication = async (comm: Communication): Promise<void> => {
    try {
      setUnlinkingCommId(comm.id);
      const result = await window.api.transactions.unlinkCommunication(comm.id);

      if (result.success) {
        // Remove the communication from the local state
        setCommunications((prev) => prev.filter((c) => c.id !== comm.id));
        setShowUnlinkConfirm(null);
      } else {
        console.error("Failed to unlink communication:", result.error);
        alert("Failed to unlink email. Please try again.");
      }
    } catch (err) {
      console.error("Failed to unlink communication:", err);
      alert("Failed to unlink email. Please try again.");
    } finally {
      setUnlinkingCommId(null);
    }
  };

  const handleExportComplete = (result: unknown) => {
    const exportResult = result as { path?: string };
    setShowExportModal(false);
    setExportSuccess(exportResult.path || "Export completed successfully!");
    // Auto-hide success message after 5 seconds
    setTimeout(() => setExportSuccess(null), 5000);

    // Show archive prompt if transaction is still active
    if (transaction.status === "active") {
      setShowArchivePrompt(true);
    }
  };

  const handleArchive = async () => {
    try {
      await window.api.transactions.update(transaction.id, {
        status: "closed",
      });
      setShowArchivePrompt(false);
      if (onTransactionUpdated) {
        onTransactionUpdated();
      }
    } catch (err) {
      console.error("Failed to archive transaction:", err);
    }
  };

  const handleDelete = async () => {
    try {
      await window.api.transactions.delete(transaction.id);
      setShowDeleteConfirm(false);
      onClose(); // Close the details modal
      if (onTransactionUpdated) {
        onTransactionUpdated(); // Refresh the transaction list
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      alert("Failed to delete transaction. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">
              Transaction Details
            </h3>
            <p className="text-green-100 text-sm">
              {transaction.property_address}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Edit Button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-blue-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-green-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
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
            {/* Delete Button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-red-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            >
              <svg
                className="w-6 h-6"
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
            </button>
          </div>
        </div>

        {/* Success Message */}
        {exportSuccess && (
          <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
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
                  PDF exported successfully!
                </p>
                <p className="text-xs text-green-700 mt-1 break-all">
                  {exportSuccess}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "details"
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Transaction Details
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "contacts"
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Roles & Contacts ({contactAssignments.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "details" && (
            <>
              {/* Transaction Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Sale Price</p>
                  <p className="text-xl font-bold text-gray-900">
                    {transaction.sale_price
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(transaction.sale_price)
                      : "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Closing Date</p>
                  <p className="text-xl font-bold text-gray-900">
                    {transaction.closing_date
                      ? new Date(transaction.closing_date).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Communications */}
              {communications.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">
                    Related Emails ({communications.length})
                  </h4>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {communications.map((comm: Communication) => (
                        <div
                          key={comm.id}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors"
                          onClick={() => setViewingEmail(comm)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold text-gray-900 flex-1 pr-4">
                              {comm.subject || "(No Subject)"}
                            </h5>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-gray-500">
                                {comm.sent_at
                                  ? new Date(comm.sent_at).toLocaleDateString()
                                  : "Unknown date"}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowUnlinkConfirm(comm);
                                }}
                                disabled={unlinkingCommId === comm.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Remove this email from transaction"
                              >
                                {unlinkingCommId === comm.id ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            From: {comm.sender || "Unknown"}
                          </p>
                          {comm.body_plain && (
                            <p className="text-sm text-gray-700 line-clamp-3">
                              {comm.body_plain.substring(0, 200)}...
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "contacts" && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Contact Assignments
              </h4>
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : contactAssignments.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No contacts assigned to this transaction
                </p>
              ) : (
                <div className="space-y-4">
                  {contactAssignments.map((assignment: ContactAssignment) => (
                    <div
                      key={assignment.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                              {assignment.specific_role ||
                                assignment.role ||
                                "Unknown Role"}
                            </span>
                            {assignment.is_primary === 1 && (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                                Primary
                              </span>
                            )}
                          </div>
                          <h5 className="font-semibold text-gray-900 text-lg">
                            {assignment.contact_name || "Unknown Contact"}
                          </h5>
                          {assignment.contact_email && (
                            <p className="text-sm text-gray-600 mt-1">
                              <svg
                                className="w-4 h-4 inline mr-1"
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
                              {assignment.contact_email}
                            </p>
                          )}
                          {assignment.contact_phone && (
                            <p className="text-sm text-gray-600 mt-1">
                              <svg
                                className="w-4 h-4 inline mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              {assignment.contact_phone}
                            </p>
                          )}
                          {assignment.contact_company && (
                            <p className="text-sm text-gray-600 mt-1">
                              <svg
                                className="w-4 h-4 inline mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                              {assignment.contact_company}
                            </p>
                          )}
                          {assignment.notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">
                              Note: {assignment.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          transaction={transaction}
          userId={transaction.user_id}
          onClose={() => setShowExportModal(false)}
          onExportComplete={handleExportComplete}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditTransactionModal
          transaction={transaction}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            if (onTransactionUpdated) {
              onTransactionUpdated();
            }
          }}
        />
      )}

      {/* Archive Prompt */}
      {showArchivePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              Archive Transaction?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Export completed! Would you like to mark this transaction as
              closed?
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowArchivePrompt(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Keep Active
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
              >
                Mark as Closed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
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
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Delete Transaction?
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Are you sure you want to delete this transaction? This will
              permanently remove:
            </p>
            <ul className="text-sm text-gray-600 mb-6 ml-6 list-disc">
              <li>
                Transaction details for{" "}
                <strong>{transaction.property_address}</strong>
              </li>
              <li>All contact assignments</li>
              <li>All related communications</li>
            </ul>
            <p className="text-sm text-red-600 font-semibold mb-6">
              This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-semibold transition-all"
              >
                Delete Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Email Confirmation */}
      {showUnlinkConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Remove Email from Transaction?
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Are you sure this email is not related to this transaction?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900 truncate">
                {showUnlinkConfirm.subject || "(No Subject)"}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                From: {showUnlinkConfirm.sender || "Unknown"}
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              This email will be removed from this transaction and won&apos;t be
              re-added during future email scans.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowUnlinkConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnlinkCommunication(showUnlinkConfirm)}
                disabled={unlinkingCommId === showUnlinkConfirm.id}
                className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {unlinkingCommId === showUnlinkConfirm.id ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Removing...
                  </>
                ) : (
                  "Remove Email"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Email View Modal */}
      {viewingEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            {/* Email Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h3 className="text-lg font-bold text-white">
                    {viewingEmail.subject || "(No Subject)"}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {viewingEmail.sent_at
                      ? new Date(viewingEmail.sent_at).toLocaleString()
                      : "Unknown date"}
                  </p>
                </div>
                <button
                  onClick={() => setViewingEmail(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
                >
                  <svg
                    className="w-6 h-6"
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
                </button>
              </div>
            </div>

            {/* Email Metadata */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-gray-500 w-16">From:</span>
                  <span className="text-sm text-gray-900">{viewingEmail.sender || "Unknown"}</span>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {viewingEmail.body_plain ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                    {viewingEmail.body_plain}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-500 italic text-center py-8">
                  No email content available
                </p>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setViewingEmail(null);
                    setShowUnlinkConfirm(viewingEmail);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Remove from Transaction
                </button>
                <button
                  onClick={() => setViewingEmail(null)}
                  className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Edit Transaction Modal
 * Allows editing transaction details and contact assignments
 */
interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

interface ContactAssignmentMap {
  [role: string]: Array<{
    contactId: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    contactCompany?: string;
    isPrimary: boolean;
    notes?: string;
    assignmentId?: string;
  }>;
}

function EditTransactionModal({
  transaction,
  onClose,
  onSuccess,
}: EditTransactionModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "contacts">("details");
  const [formData, setFormData] = useState({
    property_address: transaction.property_address || "",
    transaction_type: transaction.transaction_type || "purchase",
    representation_start_date: transaction.representation_start_date
      ? typeof transaction.representation_start_date === "string"
        ? transaction.representation_start_date
        : transaction.representation_start_date.toISOString().split("T")[0]
      : "",
    closing_date: transaction.closing_date
      ? typeof transaction.closing_date === "string"
        ? transaction.closing_date
        : transaction.closing_date.toISOString().split("T")[0]
      : "",
    sale_price: transaction.sale_price || "",
    listing_price: transaction.listing_price || "",
  });
  const [contactAssignments, setContactAssignments] =
    useState<ContactAssignmentMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing contact assignments
  useEffect(() => {
    loadContactAssignments();
  }, [transaction.id]);

  const loadContactAssignments = async () => {
    try {
      const result = await window.api.transactions.getDetails(transaction.id);
      const txn = result.transaction as {
        contact_assignments?: ContactAssignment[];
      };
      if (result.success && txn.contact_assignments) {
        // Group assignments by role
        const grouped: ContactAssignmentMap = {};
        txn.contact_assignments.forEach((assignment: ContactAssignment) => {
          const role = assignment.specific_role || assignment.role;
          if (!role) return;
          if (!grouped[role]) {
            grouped[role] = [];
          }
          grouped[role].push({
            contactId: assignment.contact_id,
            contactName: assignment.contact_name,
            contactEmail: assignment.contact_email,
            contactPhone: assignment.contact_phone,
            contactCompany: assignment.contact_company,
            isPrimary: assignment.is_primary === 1,
            notes: assignment.notes,
            assignmentId: assignment.id, // Keep track of existing assignment ID
          });
        });
        setContactAssignments(grouped);
      }
    } catch (err) {
      console.error("Failed to load contact assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  // Handle adding contact to a role
  const handleAssignContact = (
    role: string,
    contact: {
      contactId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      isPrimary: boolean;
      notes?: string;
    },
  ) => {
    setContactAssignments({
      ...contactAssignments,
      [role]: [...(contactAssignments[role] || []), contact],
    });
  };

  // Handle removing contact from a role
  const handleRemoveContact = (role: string, contactId: string) => {
    setContactAssignments({
      ...contactAssignments,
      [role]: (contactAssignments[role] || []).filter(
        (c) => c.contactId !== contactId,
      ),
    });
  };

  const handleSave = async () => {
    if (!formData.property_address.trim()) {
      setError("Property address is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Update transaction details
      const updates = {
        property_address: formData.property_address.trim(),
        transaction_type: formData.transaction_type,
        representation_start_date: formData.representation_start_date || null,
        closing_date: formData.closing_date || null,
        sale_price: formData.sale_price
          ? parseFloat(formData.sale_price as string)
          : null,
        listing_price: formData.listing_price
          ? parseFloat(formData.listing_price as string)
          : null,
      };

      await window.api.transactions.update(transaction.id, updates);

      // Update contact assignments
      // First, get all current assignments to determine what to delete
      const currentResult = await window.api.transactions.getDetails(
        transaction.id,
      );
      const currentAssignments = currentResult.success
        ? (
            currentResult.transaction as {
              contact_assignments?: ContactAssignment[];
            }
          ).contact_assignments || []
        : [];

      // Delete removed contacts
      for (const existing of currentAssignments) {
        const role = existing.specific_role || existing.role;
        if (!role) continue;
        const stillAssigned = (contactAssignments[role] || []).some(
          (c) => c.contactId === existing.contact_id,
        );
        if (!stillAssigned) {
          await window.api.transactions.removeContact(
            transaction.id,
            existing.contact_id,
          );
        }
      }

      // Add new contacts
      for (const [role, contacts] of Object.entries(contactAssignments)) {
        for (const contact of contacts) {
          // Check if this is a new assignment
          const isExisting = currentAssignments.some(
            (existing: ContactAssignment) =>
              existing.contact_id === contact.contactId &&
              (existing.specific_role || existing.role) === role,
          );

          if (!isExisting) {
            const roleCategory = ROLE_TO_CATEGORY[role] || "support";
            await window.api.transactions.assignContact(
              transaction.id,
              contact.contactId,
              role,
              roleCategory,
              contact.isPrimary,
              contact.notes,
            );
          }
        }
      }

      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update transaction";
      setError(errorMessage);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-xl font-bold text-white">Edit Transaction</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg
              className="w-6 h-6"
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
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "details"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Transaction Details
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "contacts"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Roles & Contacts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-4">
              {/* Property Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Address *
                </label>
                <input
                  type="text"
                  value={formData.property_address}
                  onChange={(e) =>
                    handleChange("property_address", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleChange("transaction_type", "purchase")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      formData.transaction_type === "purchase"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Purchase
                  </button>
                  <button
                    onClick={() => handleChange("transaction_type", "sale")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      formData.transaction_type === "sale"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Sale
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Representation Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.representation_start_date}
                    onChange={(e) =>
                      handleChange("representation_start_date", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Closing Date
                  </label>
                  <input
                    type="date"
                    value={formData.closing_date}
                    onChange={(e) =>
                      handleChange("closing_date", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    value={formData.sale_price}
                    onChange={(e) => handleChange("sale_price", e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Listing Price
                  </label>
                  <input
                    type="number"
                    value={formData.listing_price}
                    onChange={(e) =>
                      handleChange("listing_price", e.target.value)
                    }
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "contacts" && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading contacts...</p>
                </div>
              ) : (
                <EditContactAssignments
                  transactionType={formData.transaction_type}
                  contactAssignments={contactAssignments}
                  onAssignContact={handleAssignContact}
                  onRemoveContact={handleRemoveContact}
                  userId={transaction.user_id}
                  propertyAddress={formData.property_address}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              saving
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg"
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit Contact Assignments Component
 * Reusable component for editing contact assignments
 */
interface EditContactAssignmentsProps {
  transactionType: "purchase" | "sale";
  contactAssignments: ContactAssignmentMap;
  onAssignContact: (
    role: string,
    contact: {
      contactId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      isPrimary: boolean;
      notes?: string;
    },
  ) => void;
  onRemoveContact: (role: string, contactId: string) => void;
  userId: string;
  propertyAddress: string;
}

interface RoleConfig {
  role: string;
  required: boolean;
  multiple: boolean;
}

function EditContactAssignments({
  transactionType,
  contactAssignments,
  onAssignContact,
  onRemoveContact,
  userId,
  propertyAddress,
}: EditContactAssignmentsProps) {
  return (
    <div className="space-y-6">
      {AUDIT_WORKFLOW_STEPS.map(
        (
          step: { title: string; description: string; roles: RoleConfig[] },
          idx: number,
        ) => {
          const stepRoles = filterRolesByTransactionType(
            step.roles,
            transactionType,
            step.title,
          );
          if (stepRoles.length === 0) return null;

          return (
            <div key={idx}>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                {step.title}
              </h4>
              <p className="text-sm text-gray-600 mb-4">{step.description}</p>
              <div className="space-y-4">
                {stepRoles.map((roleConfig: RoleConfig) => (
                  <EditRoleAssignment
                    key={roleConfig.role}
                    role={roleConfig.role}
                    required={roleConfig.required}
                    multiple={roleConfig.multiple}
                    assignments={contactAssignments[roleConfig.role] || []}
                    onAssign={onAssignContact}
                    onRemove={onRemoveContact}
                    userId={userId}
                    propertyAddress={propertyAddress}
                    transactionType={transactionType}
                  />
                ))}
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}

/**
 * Edit Single Role Assignment Component
 */
interface EditRoleAssignmentProps {
  role: string;
  required: boolean;
  multiple: boolean;
  assignments: Array<{
    contactId: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    contactCompany?: string;
    isPrimary: boolean;
    notes?: string;
  }>;
  onAssign: (
    role: string,
    contact: {
      contactId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      isPrimary: boolean;
      notes?: string;
    },
  ) => void;
  onRemove: (role: string, contactId: string) => void;
  userId: string;
  propertyAddress: string;
  transactionType: "purchase" | "sale";
}

function EditRoleAssignment({
  role,
  required,
  multiple,
  assignments,
  onAssign,
  onRemove,
  userId,
  propertyAddress,
  transactionType,
}: EditRoleAssignmentProps) {
  const [contacts, setContacts] = React.useState<ExtendedContact[]>([]);
  const [_loading, setLoading] = React.useState<boolean>(true);
  const [_error, setError] = React.useState<string | null>(null);
  const [showContactSelect, setShowContactSelect] =
    React.useState<boolean>(false);

  React.useEffect(() => {
    loadContacts();
  }, [propertyAddress]);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use sorted API when property address is available, otherwise use regular API
      const result = propertyAddress
        ? await window.api.contacts.getSortedByActivity(userId, propertyAddress)
        : await window.api.contacts.getAll(userId);

      if (result.success) {
        setContacts(result.contacts || []);
      } else {
        setError(result.error || "Failed to load contacts");
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setError("Unable to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelected = (selectedContacts: ExtendedContact[]) => {
    selectedContacts.forEach((contact: ExtendedContact) => {
      onAssign(role, {
        contactId: contact.id,
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        contactCompany: contact.company,
        isPrimary: false,
        notes: undefined,
      });
    });
    setShowContactSelect(false);
  };

  const canAddMore = multiple || assignments.length === 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-900">
            {getRoleDisplayName(role, transactionType)}
          </label>
          {required && (
            <span className="text-xs text-red-500 font-semibold">*</span>
          )}
          {multiple && (
            <span className="text-xs text-gray-500">(can assign multiple)</span>
          )}
        </div>
        {canAddMore && (
          <button
            onClick={() => setShowContactSelect(true)}
            className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-all"
          >
            + Add Contact
          </button>
        )}
      </div>

      {/* Assigned contacts */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          {assignments.map(
            (assignment: {
              contactId: string;
              contactName: string;
              contactEmail?: string;
            }) => (
              <div
                key={assignment.contactId}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {assignment.contactName}
                  </p>
                  {assignment.contactEmail && (
                    <p className="text-xs text-gray-600">
                      {assignment.contactEmail}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(role, assignment.contactId)}
                  className="text-red-600 hover:text-red-800 p-1"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {/* Contact Select Modal */}
      {showContactSelect && (
        <ContactSelectModal
          contacts={contacts}
          excludeIds={
            assignments.map(
              (a: { contactId: string }): string => a.contactId,
            ) as never[]
          }
          multiple={multiple}
          onSelect={handleContactSelected}
          onClose={() => setShowContactSelect(false)}
          propertyAddress={propertyAddress}
        />
      )}
    </div>
  );
}

export default Transactions;
