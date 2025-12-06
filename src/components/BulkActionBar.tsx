/**
 * BulkActionBar Component
 * A floating toolbar that appears when multiple items are selected
 * Provides bulk actions like delete, export, and status change
 */
import React, { useState } from "react";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onBulkStatusChange: (status: "active" | "closed") => void;
  isDeleting?: boolean;
  isExporting?: boolean;
  isUpdating?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkExport,
  onBulkStatusChange,
  isDeleting = false,
  isExporting = false,
  isUpdating = false,
}: BulkActionBarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const isProcessing = isDeleting || isExporting || isUpdating;

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-3 pr-4 border-r border-gray-700">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-full">
            <span className="font-bold text-lg">{selectedCount}</span>
          </div>
          <div className="text-sm">
            <p className="font-medium">
              {selectedCount} selected
            </p>
            <p className="text-gray-400 text-xs">
              of {totalCount} transactions
            </p>
          </div>
        </div>

        {/* Selection Actions */}
        <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              disabled={isProcessing}
              className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Select All
            </button>
          )}
          <button
            onClick={onDeselectAll}
            disabled={isProcessing}
            className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Deselect All
          </button>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={onBulkExport}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
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
                <span>Export</span>
              </>
            )}
          </button>

          {/* Status Change Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Change Status</span>
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
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </>
              )}
            </button>

            {/* Status Dropdown Menu */}
            {showStatusDropdown && !isProcessing && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 min-w-[160px]">
                <button
                  onClick={() => {
                    onBulkStatusChange("active");
                    setShowStatusDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Mark as Active
                </button>
                <button
                  onClick={() => {
                    onBulkStatusChange("closed");
                    setShowStatusDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                >
                  <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                  Mark as Closed
                </button>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={onBulkDelete}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Deleting...</span>
              </>
            ) : (
              <>
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
                <span>Delete</span>
              </>
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onDeselectAll}
          disabled={isProcessing}
          className="ml-2 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
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
    </div>
  );
}

/**
 * BulkDeleteConfirmModal Component
 * Confirmation modal for bulk delete operation
 */
interface BulkDeleteConfirmModalProps {
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function BulkDeleteConfirmModal({
  selectedCount,
  onConfirm,
  onCancel,
  isDeleting = false,
}: BulkDeleteConfirmModalProps) {
  return (
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
            Delete {selectedCount} Transaction{selectedCount > 1 ? "s" : ""}?
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Are you sure you want to delete {selectedCount} selected transaction
          {selectedCount > 1 ? "s" : ""}? This will permanently remove:
        </p>
        <ul className="text-sm text-gray-600 mb-6 ml-6 list-disc">
          <li>All transaction details</li>
          <li>All contact assignments</li>
          <li>All related communications</li>
        </ul>
        <p className="text-sm text-red-600 font-semibold mb-6">
          This action cannot be undone.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Deleting...
              </>
            ) : (
              <>Delete {selectedCount} Transaction{selectedCount > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * BulkExportModal Component
 * Modal for selecting export options for multiple transactions
 */
interface BulkExportModalProps {
  selectedCount: number;
  onConfirm: (format: string) => void;
  onCancel: () => void;
  isExporting?: boolean;
}

export function BulkExportModal({
  selectedCount,
  onConfirm,
  onCancel,
  isExporting = false,
}: BulkExportModalProps) {
  const [exportFormat, setExportFormat] = useState("pdf");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Export {selectedCount} Transaction{selectedCount > 1 ? "s" : ""}
          </h3>
          <button
            onClick={onCancel}
            disabled={isExporting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
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

        <p className="text-sm text-gray-600 mb-4">
          Select an export format for the selected transactions. Each transaction will be exported as a separate file.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Export Format
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setExportFormat("pdf")}
              className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                exportFormat === "pdf"
                  ? "bg-purple-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <div className="font-semibold">PDF Report</div>
              <div className="text-xs opacity-80">Transaction report</div>
            </button>
            <button
              onClick={() => setExportFormat("excel")}
              className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                exportFormat === "excel"
                  ? "bg-purple-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <div className="font-semibold">Excel (.xlsx)</div>
              <div className="text-xs opacity-80">Spreadsheet format</div>
            </button>
            <button
              onClick={() => setExportFormat("csv")}
              className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                exportFormat === "csv"
                  ? "bg-purple-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <div className="font-semibold">CSV</div>
              <div className="text-xs opacity-80">Comma-separated values</div>
            </button>
            <button
              onClick={() => setExportFormat("json")}
              className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                exportFormat === "json"
                  ? "bg-purple-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <div className="font-semibold">JSON</div>
              <div className="text-xs opacity-80">Structured data</div>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(exportFormat)}
            disabled={isExporting}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>Export {selectedCount} Transaction{selectedCount > 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkActionBar;
