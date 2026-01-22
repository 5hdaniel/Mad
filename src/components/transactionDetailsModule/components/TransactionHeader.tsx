/**
 * TransactionHeader Component
 * Header for transaction details modal with dynamic styling and action buttons
 */
import React from "react";
import type { Transaction } from "@/types";

interface TransactionHeaderProps {
  transaction: Transaction;
  isPendingReview: boolean;
  isRejected: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  isRestoring: boolean;
  onClose: () => void;
  onShowRejectReasonModal: () => void;
  onShowEditModal: () => void;
  onApprove: () => void;
  onRestore: () => void;
  onShowExportModal: () => void;
  onShowDeleteConfirm: () => void;
  onShowSubmitModal?: () => void;
  isSubmitting?: boolean;
}

export function TransactionHeader({
  transaction,
  isPendingReview,
  isRejected,
  isApproving,
  isRejecting,
  isRestoring,
  onClose,
  onShowRejectReasonModal,
  onShowEditModal,
  onApprove,
  onRestore,
  onShowExportModal,
  onShowDeleteConfirm,
  onShowSubmitModal,
  isSubmitting = false,
}: TransactionHeaderProps): React.ReactElement {
  // Determine header style based on state
  const getHeaderStyle = () => {
    if (isPendingReview) return "bg-gradient-to-r from-amber-500 to-orange-500";
    if (isRejected) return "bg-gradient-to-r from-red-500 to-red-600";
    return "bg-gradient-to-r from-green-500 to-teal-600";
  };

  const getHeaderTextStyle = () => {
    if (isPendingReview) return "text-amber-100";
    if (isRejected) return "text-red-100";
    return "text-green-100";
  };

  const getHeaderTitle = () => {
    if (isPendingReview) return "Review Transaction";
    if (isRejected) return "Rejected Transaction";
    return "Transaction Details";
  };

  // Close button component to avoid duplication
  const CloseButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={onClose}
      className={`text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all ${className}`}
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
  );

  return (
    <div
      className={`flex-shrink-0 px-6 py-4 rounded-t-xl ${getHeaderStyle()}`}
    >
      {/* Container: column on mobile, row on md+ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-2">
        {/* Top row: Title/Address + Close button (mobile only) */}
        <div className="flex items-center justify-between md:flex-1">
          {/* Left side: Title + Address */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">{getHeaderTitle()}</h3>
              {isPendingReview && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/20 text-white">
                  Pending Review
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/20 text-white">
                  Rejected
                </span>
              )}
            </div>
            <p className={`text-sm ${getHeaderTextStyle()}`}>
              {transaction.property_address}
            </p>
          </div>

          {/* Close button: visible on mobile in top row, hidden on md+ */}
          <CloseButton className="md:hidden" />
        </div>

        {/* Bottom row (mobile) / Right side (desktop): Action buttons */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {isPendingReview ? (
            <PendingReviewActions
              isRejecting={isRejecting}
              isApproving={isApproving}
              onShowRejectReasonModal={onShowRejectReasonModal}
              onShowEditModal={onShowEditModal}
              onApprove={onApprove}
            />
          ) : isRejected ? (
            <RejectedActions
              isRestoring={isRestoring}
              onRestore={onRestore}
              onShowDeleteConfirm={onShowDeleteConfirm}
            />
          ) : (
            <ActiveActions
              transaction={transaction}
              isRejecting={isRejecting}
              isSubmitting={isSubmitting}
              onShowRejectReasonModal={onShowRejectReasonModal}
              onShowExportModal={onShowExportModal}
              onShowDeleteConfirm={onShowDeleteConfirm}
              onShowSubmitModal={onShowSubmitModal}
            />
          )}

          {/* Close button: hidden on mobile, visible on md+ */}
          <CloseButton className="hidden md:block" />
        </div>
      </div>
    </div>
  );
}

// Sub-components for different action sets
function PendingReviewActions({
  isRejecting,
  isApproving,
  onShowRejectReasonModal,
  onShowEditModal,
  onApprove,
}: {
  isRejecting: boolean;
  isApproving: boolean;
  onShowRejectReasonModal: () => void;
  onShowEditModal: () => void;
  onApprove: () => void;
}) {
  return (
    <>
      {/* Reject Button */}
      <button
        onClick={onShowRejectReasonModal}
        disabled={isRejecting}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-red-600 hover:bg-opacity-90 shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isRejecting ? (
          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        Reject
      </button>
      {/* Edit Button */}
      <button
        onClick={onShowEditModal}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-amber-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>
      {/* Approve Button */}
      <button
        onClick={onApprove}
        disabled={isApproving}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isApproving ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        Approve
      </button>
    </>
  );
}

function RejectedActions({
  isRestoring,
  onRestore,
  onShowDeleteConfirm,
}: {
  isRestoring: boolean;
  onRestore: () => void;
  onShowDeleteConfirm: () => void;
}) {
  return (
    <>
      {/* Restore to Active Button */}
      <button
        onClick={onRestore}
        disabled={isRestoring}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isRestoring ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        Restore to Active
      </button>
      {/* Delete Button */}
      <button
        onClick={onShowDeleteConfirm}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-red-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </>
  );
}

function ActiveActions({
  transaction,
  isRejecting,
  isSubmitting,
  onShowRejectReasonModal,
  onShowExportModal,
  onShowDeleteConfirm,
  onShowSubmitModal,
}: {
  transaction: Transaction;
  isRejecting: boolean;
  isSubmitting: boolean;
  onShowRejectReasonModal: () => void;
  onShowExportModal: () => void;
  onShowDeleteConfirm: () => void;
  onShowSubmitModal?: () => void;
}) {
  // Check if transaction can be submitted
  const canSubmit = transaction.submission_status === "not_submitted" ||
    transaction.submission_status === "needs_changes" ||
    !transaction.submission_status;

  const isResubmit = transaction.submission_status === "needs_changes";

  return (
    <>
      {/* Submit for Review Button */}
      {onShowSubmitModal && canSubmit && (
        <button
          onClick={onShowSubmitModal}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {isResubmit ? "Resubmit" : "Submit for Review"}
        </button>
      )}
      {/* Reject Button */}
      <button
        onClick={onShowRejectReasonModal}
        disabled={isRejecting}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-orange-600 hover:bg-opacity-90 shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isRejecting ? (
          <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        )}
        Reject
      </button>
      {/* Export Button */}
      <button
        onClick={onShowExportModal}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-green-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export
      </button>
      {/* Delete Button */}
      <button
        onClick={onShowDeleteConfirm}
        className="px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 bg-white text-red-600 hover:bg-opacity-90 shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </>
  );
}
