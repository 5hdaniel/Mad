/**
 * TransactionsToolbar Component
 * Toolbar for the transactions page with filters, search, and actions
 */
import React from "react";
import type { Transaction } from "../../../../electron/types/models";

// ============================================
// TYPES
// ============================================

interface ScanProgress {
  step: string;
  message: string;
}

export interface TransactionsToolbarProps {
  // Transaction count
  transactionCount: number;
  transactions: Transaction[];

  // Filter
  statusFilter: "active" | "closed" | "all";
  onStatusFilterChange: (filter: "active" | "closed" | "all") => void;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Selection mode
  selectionMode: boolean;
  onToggleSelectionMode: () => void;

  // Actions
  onNewTransaction: () => void;
  onStartScan: () => void;
  onStopScan: () => void;
  scanning: boolean;
  scanProgress: ScanProgress | null;

  // Alerts
  error: string | null;
  quickExportSuccess: string | null;
  bulkActionSuccess: string | null;
}

// ============================================
// TRANSACTIONS TOOLBAR COMPONENT
// ============================================

export function TransactionsToolbar({
  transactionCount,
  transactions,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  selectionMode,
  onToggleSelectionMode,
  onNewTransaction,
  onStartScan,
  onStopScan,
  scanning,
  scanProgress,
  error,
  quickExportSuccess,
  bulkActionSuccess,
}: TransactionsToolbarProps): React.ReactElement {
  const activeCount = transactions.filter(
    (t: Transaction) => t.status === "active"
  ).length;
  const closedCount = transactions.filter(
    (t: Transaction) => t.status === "closed"
  ).length;

  return (
    <div className="flex-shrink-0 p-6 bg-white shadow-md">
      {/* Status Filter Toggle */}
      <div className="inline-flex items-center bg-gray-200 rounded-lg p-1 mb-3">
        <button
          onClick={() => onStatusFilterChange("active")}
          className={`px-4 py-2 rounded-md font-medium transition-all ${
            statusFilter === "active"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => onStatusFilterChange("closed")}
          className={`px-4 py-2 rounded-md font-medium transition-all ${
            statusFilter === "closed"
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Closed ({closedCount})
        </button>
        <button
          onClick={() => onStatusFilterChange("all")}
          className={`px-4 py-2 rounded-md font-medium transition-all ${
            statusFilter === "all"
              ? "bg-white text-purple-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All ({transactionCount})
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by address..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
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

        {/* Edit Mode Button */}
        <button
          onClick={onToggleSelectionMode}
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
          {selectionMode ? "Done" : "Edit"}
        </button>

        {/* Audit New Transaction Button */}
        <button
          onClick={onNewTransaction}
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
            onClick={onStopScan}
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
            onClick={onStartScan}
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
  );
}

export default TransactionsToolbar;
