/**
 * RejectReasonModal Component
 * Modal for entering rejection reason when rejecting a transaction
 */
import React from "react";

interface RejectReasonModalProps {
  rejectReason: string;
  onRejectReasonChange: (reason: string) => void;
  isRejecting: boolean;
  onCancel: () => void;
  onReject: () => void;
}

export function RejectReasonModal({
  rejectReason,
  onRejectReasonChange,
  isRejecting,
  onCancel,
  onReject,
}: RejectReasonModalProps): React.ReactElement {
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Reject Transaction</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure this is not a valid real estate transaction?
        </p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for rejection (optional)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            placeholder="e.g., Not a real estate transaction, duplicate entry..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            rows={3}
          />
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isRejecting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onReject}
            disabled={isRejecting}
            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isRejecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Rejecting...
              </>
            ) : (
              "Reject Transaction"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
