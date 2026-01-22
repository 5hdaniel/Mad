/**
 * Bulk Submit Modal Component (BACKLOG-392)
 *
 * Modal for confirming and executing bulk submission of transactions
 * for broker review. Shows transaction list, progress during submission,
 * and results summary.
 */
import React from "react";
import type { Transaction, SubmissionStatus } from "@/types";
import { SubmissionStatusBadge } from "./transactionDetailsModule/components/SubmissionStatusBadge";

// ============================================
// TYPES
// ============================================

export interface BulkSubmitTransaction {
  id: string;
  property_address: string;
  submission_status?: SubmissionStatus;
  message_count: number;
  attachment_count: number;
  email_count?: number;
  text_count?: number;
}

export interface BulkSubmitResult {
  transactionId: string;
  propertyAddress: string;
  success: boolean;
  error?: string;
  submissionId?: string;
}

export interface BulkSubmitProgress {
  current: number;
  total: number;
  transactionProgress: {
    stage: "preparing" | "attachments" | "transaction" | "messages" | "complete" | "failed";
    stageProgress: number;
    overallProgress: number;
    currentItem?: string;
  } | null;
  results: BulkSubmitResult[];
}

interface BulkSubmitModalProps {
  transactions: BulkSubmitTransaction[];
  isSubmitting: boolean;
  progress: BulkSubmitProgress | null;
  onSubmit: () => void;
  onCancel: () => void;
  onCancelRemaining?: () => void;
  onRetryFailed?: () => void;
  onClose: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine if a transaction is eligible for submission
 */
function isEligibleForSubmit(status?: SubmissionStatus): boolean {
  return (
    status === undefined ||
    status === "not_submitted" ||
    status === "needs_changes" ||
    status === "rejected"
  );
}

/**
 * Get label for submission type
 */
function getSubmitTypeLabel(status?: SubmissionStatus): string {
  if (status === "needs_changes" || status === "rejected") {
    return "Resubmission";
  }
  return "New";
}

// ============================================
// COMPONENT
// ============================================

export function BulkSubmitModal({
  transactions,
  isSubmitting,
  progress,
  onSubmit,
  onCancel,
  onCancelRemaining,
  onRetryFailed,
  onClose,
}: BulkSubmitModalProps): React.ReactElement {
  const isComplete = progress && progress.results.length === progress.total;
  const successCount = progress?.results.filter((r) => r.success).length ?? 0;
  const failedCount = progress?.results.filter((r) => !r.success && r.error !== "Cancelled").length ?? 0;

  // Calculate totals
  const totalMessages = transactions.reduce((sum, t) => sum + t.message_count, 0);
  const totalAttachments = transactions.reduce((sum, t) => sum + t.attachment_count, 0);

  // Render pre-submit confirmation
  const renderConfirmation = () => (
    <>
      <p className="text-sm text-gray-600 mb-4">
        The following transactions will be submitted to your broker for review:
      </p>

      {/* Transaction List */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-64 overflow-y-auto">
        <div className="space-y-3">
          {transactions.map((transaction, idx) => (
            <div
              key={transaction.id}
              className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0 last:pb-0"
            >
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {transaction.property_address || "No address"}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{transaction.message_count} messages</span>
                  <span>{transaction.attachment_count} attachments</span>
                  <span className="text-blue-600 font-medium">
                    ({getSubmitTypeLabel(transaction.submission_status)})
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-700 font-medium">
            Total: {transactions.length} transactions
          </span>
          <span className="text-blue-600">
            {totalMessages} messages, {totalAttachments} attachments
          </span>
        </div>
      </div>
    </>
  );

  // Render progress during submission
  const renderProgress = () => {
    if (!progress) return null;

    return (
      <div className="mb-4">
        {/* Overall progress */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">
            Submitting {progress.current} of {progress.total}...
          </span>
          <span className="text-sm text-gray-500">
            {Math.round((progress.results.length / progress.total) * 100)}%
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(progress.results.length / progress.total) * 100}%` }}
          />
        </div>

        {/* Transaction list with status */}
        <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            {transactions.map((transaction, idx) => {
              const result = progress.results.find((r) => r.transactionId === transaction.id);
              const isCurrentTransaction = idx === progress.current - 1 && !result;

              return (
                <div
                  key={transaction.id}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    isCurrentTransaction ? "bg-blue-50 border border-blue-200" : ""
                  }`}
                >
                  {/* Status icon */}
                  {result ? (
                    result.success ? (
                      <svg
                        className="w-5 h-5 text-green-500 flex-shrink-0"
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
                    ) : (
                      <svg
                        className="w-5 h-5 text-red-500 flex-shrink-0"
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
                    )
                  ) : isCurrentTransaction ? (
                    <svg
                      className="w-5 h-5 text-blue-500 flex-shrink-0 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-300 flex-shrink-0" />
                  )}

                  {/* Transaction info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm truncate ${
                        isCurrentTransaction ? "font-medium text-blue-900" : "text-gray-700"
                      }`}
                    >
                      {transaction.property_address || "No address"}
                    </p>
                    {result && !result.success && result.error !== "Cancelled" && (
                      <p className="text-xs text-red-600 mt-0.5 truncate">
                        {result.error}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current transaction progress */}
        {progress.transactionProgress && progress.transactionProgress.stage !== "complete" && progress.transactionProgress.stage !== "failed" && (
          <div className="mt-3 text-xs text-gray-500">
            {progress.transactionProgress.currentItem || "Processing..."}
          </div>
        )}
      </div>
    );
  };

  // Render completion summary
  const renderComplete = () => {
    if (!progress || !isComplete) return null;

    return (
      <div className="mb-4">
        {/* Summary */}
        <div
          className={`p-4 rounded-lg mb-4 ${
            failedCount === 0 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {failedCount === 0 ? (
              <svg
                className="w-6 h-6 text-green-500 flex-shrink-0"
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
            ) : (
              <svg
                className="w-6 h-6 text-yellow-500 flex-shrink-0"
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
            <div>
              <p
                className={`text-sm font-semibold ${
                  failedCount === 0 ? "text-green-800" : "text-yellow-800"
                }`}
              >
                {failedCount === 0
                  ? "All submissions completed successfully!"
                  : `${successCount} of ${progress.total} submitted successfully`}
              </p>
              {failedCount > 0 && (
                <p className="text-sm text-yellow-700 mt-1">
                  {failedCount} submission{failedCount > 1 ? "s" : ""} failed
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Results list */}
        <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            {progress.results.map((result) => (
              <div
                key={result.transactionId}
                className="flex items-center gap-3 p-2"
              >
                {result.success ? (
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0"
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
                ) : (
                  <svg
                    className="w-5 h-5 text-red-500 flex-shrink-0"
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
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      result.success ? "text-gray-700" : "text-gray-900"
                    }`}
                  >
                    {result.propertyAddress}
                  </p>
                  {!result.success && result.error && result.error !== "Cancelled" && (
                    <p className="text-xs text-red-600 truncate">{result.error}</p>
                  )}
                </div>
                {result.success && (
                  <span className="text-xs text-green-600 font-medium">Submitted</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-6 h-6 text-blue-600"
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
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {isComplete
              ? "Submission Complete"
              : isSubmitting
              ? "Submitting Transactions..."
              : `Submit ${transactions.length} Transactions for Review`}
          </h3>
        </div>

        {/* Content */}
        {!isSubmitting && !isComplete && renderConfirmation()}
        {isSubmitting && !isComplete && renderProgress()}
        {isComplete && renderComplete()}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          {/* Pre-submit actions */}
          {!isSubmitting && !isComplete && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-semibold transition-all flex items-center gap-2"
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Submit All
              </button>
            </>
          )}

          {/* In-progress actions */}
          {isSubmitting && !isComplete && onCancelRemaining && (
            <button
              onClick={onCancelRemaining}
              className="px-4 py-2 text-red-700 hover:bg-red-50 rounded-lg font-medium transition-all"
            >
              Cancel Remaining
            </button>
          )}

          {/* Complete actions */}
          {isComplete && (
            <>
              {failedCount > 0 && onRetryFailed && (
                <button
                  onClick={onRetryFailed}
                  className="px-4 py-2 text-blue-700 hover:bg-blue-50 rounded-lg font-medium transition-all"
                >
                  Retry Failed
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-semibold transition-all"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkSubmitModal;
