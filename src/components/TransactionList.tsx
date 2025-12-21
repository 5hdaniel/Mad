import React, { useState, useEffect, useMemo } from "react";
import type { Transaction, OAuthProvider } from "@/types";
import AuditTransactionModal from "./AuditTransactionModal";
import ExportModal from "./ExportModal";
import TransactionDetails from "./TransactionDetails";

interface ScanProgress {
  step: string;
  message: string;
}

// ============================================
// DETECTION BADGE COMPONENTS
// ============================================

/**
 * Badge showing whether transaction was AI-detected or manually created
 */
function DetectionSourceBadge({
  source,
}: {
  source: "auto" | "manual" | "hybrid" | undefined;
}) {
  if (!source || source === "manual") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500 text-white">
        Manual
      </span>
    );
  }

  // AI-detected or hybrid shows the gradient badge
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
    >
      AI Detected
    </span>
  );
}

/**
 * Confidence pill with color scale based on confidence level
 * Red (<60%), Yellow (60-80%), Green (>80%)
 */
function ConfidencePill({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined || confidence === null) {
    return null;
  }

  // Convert from 0-1 to percentage if needed
  const percentage =
    confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  let bgColor: string;
  let textColor: string;

  if (percentage < 60) {
    bgColor = "bg-red-500";
    textColor = "text-white";
  } else if (percentage < 80) {
    bgColor = "bg-amber-500";
    textColor = "text-white";
  } else {
    bgColor = "bg-emerald-500";
    textColor = "text-white";
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}
    >
      {percentage}% confident
    </span>
  );
}

/**
 * Warning badge for transactions pending user review
 */
function PendingReviewBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500 text-white">
      Pending Review
    </span>
  );
}

// ============================================
// REJECT REASON MODAL COMPONENT
// ============================================

interface RejectReasonModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Modal for collecting rejection reason when user rejects an AI-detected transaction
 */
function RejectReasonModal({ onConfirm, onCancel }: RejectReasonModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Reject Transaction
        </h3>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why are you rejecting this transaction? (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="e.g., Not a real estate transaction, duplicate entry..."
            autoFocus
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              Reject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// TRANSACTION ACTIONS COMPONENT
// ============================================

interface TransactionActionsProps {
  transaction: Transaction;
  userId: string;
  onUpdate: () => void;
}

/**
 * Action buttons for approving/rejecting AI-detected pending transactions
 * Only renders for transactions with detection_status === 'pending'
 */
function TransactionActions({
  transaction,
  userId,
  onUpdate,
}: TransactionActionsProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Only show actions for pending AI-detected transactions
  if (transaction.detection_status !== "pending") {
    return null;
  }

  const handleApprove = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening transaction details
    setIsApproving(true);
    try {
      // Update transaction status to confirmed
      await window.api.transactions.update(transaction.id, {
        detection_status: "confirmed",
        reviewed_at: new Date().toISOString(),
      });

      // Record feedback for learning
      await window.api.feedback.recordTransaction(userId, {
        detectedTransactionId: transaction.id,
        action: "confirm",
      });

      onUpdate();
    } catch (error) {
      console.error("Failed to approve transaction:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (reason: string) => {
    setIsRejecting(true);
    try {
      // Update transaction status to rejected
      await window.api.transactions.update(transaction.id, {
        detection_status: "rejected",
        rejection_reason: reason || undefined,
        reviewed_at: new Date().toISOString(),
      });

      // Record feedback for learning
      await window.api.feedback.recordTransaction(userId, {
        detectedTransactionId: transaction.id,
        action: "reject",
        corrections: reason ? { reason } : undefined,
      });

      setShowRejectModal(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to reject transaction:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRejectClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent opening transaction details
    setShowRejectModal(true);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Approve Button */}
        <button
          onClick={handleApprove}
          disabled={isApproving}
          className="p-2 rounded-lg font-semibold transition-all bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Approve transaction"
        >
          {isApproving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>

        {/* Reject Button */}
        <button
          onClick={handleRejectClick}
          disabled={isRejecting}
          className="p-2 rounded-lg font-semibold transition-all bg-red-500 text-white hover:bg-red-600 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reject transaction"
        >
          {isRejecting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
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
          )}
        </button>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <RejectReasonModal
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
        />
      )}
    </>
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

  // Detection status filter - read initial value from URL params
  const [detectionFilter, setDetectionFilter] = useState<
    "all" | "confirmed" | "pending" | "rejected"
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("detection");
    if (
      filter === "confirmed" ||
      filter === "pending" ||
      filter === "rejected"
    ) {
      return filter;
    }
    return "all";
  });

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

  // Sync detection filter to URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (detectionFilter === "all") {
      params.delete("detection");
    } else {
      params.set("detection", detectionFilter);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [detectionFilter]);

  // Compute detection status counts
  const detectionCounts = useMemo(
    () => ({
      all: transactions.length,
      confirmed: transactions.filter((t) => t.detection_status === "confirmed")
        .length,
      pending: transactions.filter((t) => t.detection_status === "pending")
        .length,
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
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && t.status === "active") ||
      (statusFilter === "closed" && t.status === "closed");
    const matchesDetection =
      detectionFilter === "all" || t.detection_status === detectionFilter;
    return matchesSearch && matchesStatus && matchesDetection;
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
            Active ({transactions.filter((t) => t.status === "active").length})
          </button>
          <button
            onClick={() => setStatusFilter("closed")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              statusFilter === "closed"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Closed ({transactions.filter((t) => t.status === "closed").length})
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

        {/* Detection Status Filter Tabs */}
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 mb-3 ml-4">
          <button
            onClick={() => setDetectionFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              detectionFilter === "all"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            All
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-200">
              {detectionCounts.all}
            </span>
          </button>
          <button
            onClick={() => setDetectionFilter("confirmed")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              detectionFilter === "confirmed"
                ? "bg-white text-green-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Confirmed
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
              {detectionCounts.confirmed}
            </span>
          </button>
          <button
            onClick={() => setDetectionFilter("pending")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              detectionFilter === "pending"
                ? "bg-white text-amber-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Pending Review
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              {detectionCounts.pending}
            </span>
          </button>
          <button
            onClick={() => setDetectionFilter("rejected")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              detectionFilter === "rejected"
                ? "bg-white text-red-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Rejected
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
              {detectionCounts.rejected}
            </span>
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
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer transform hover:scale-[1.01]"
                onClick={() => setSelectedTransaction(transaction)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {transaction.property_address}
                      </h3>
                      {/* Detection Status Badges */}
                      <div className="flex items-center gap-1.5">
                        <DetectionSourceBadge
                          source={transaction.detection_source}
                        />
                        {transaction.detection_source === "auto" &&
                          transaction.detection_confidence !== undefined && (
                            <ConfidencePill
                              confidence={transaction.detection_confidence}
                            />
                          )}
                        {transaction.detection_status === "pending" && (
                          <PendingReviewBadge />
                        )}
                      </div>
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
                    {/* Approve/Reject Actions for pending transactions */}
                    <TransactionActions
                      transaction={transaction}
                      userId={userId}
                      onUpdate={loadTransactions}
                    />
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
    </div>
  );
}

export default TransactionList;
