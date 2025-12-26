/**
 * TransactionDetailsTab Component
 * Details tab content showing transaction info and communications
 */
import React from "react";
import type { Transaction } from "@/types";
import type { Communication } from "../types";

interface TransactionDetailsTabProps {
  transaction: Transaction;
  communications: Communication[];
  loading: boolean;
  unlinkingCommId: string | null;
  onViewEmail: (comm: Communication) => void;
  onShowUnlinkConfirm: (comm: Communication) => void;
}

export function TransactionDetailsTab({
  transaction,
  communications,
  loading,
  unlinkingCommId,
  onViewEmail,
  onShowUnlinkConfirm,
}: TransactionDetailsTabProps): React.ReactElement {
  return (
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
              {communications.map((comm) => (
                <CommunicationCard
                  key={comm.id}
                  communication={comm}
                  isUnlinking={unlinkingCommId === comm.id}
                  onClick={() => onViewEmail(comm)}
                  onUnlink={() => onShowUnlinkConfirm(comm)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Sub-component for individual communication cards
function CommunicationCard({
  communication,
  isUnlinking,
  onClick,
  onUnlink,
}: {
  communication: Communication;
  isUnlinking: boolean;
  onClick: () => void;
  onUnlink: () => void;
}) {
  return (
    <div
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-semibold text-gray-900 flex-1 pr-4">
          {communication.subject || "(No Subject)"}
        </h5>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {communication.sent_at
              ? new Date(communication.sent_at).toLocaleDateString()
              : "Unknown date"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnlink();
            }}
            disabled={isUnlinking}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="Remove this email from transaction"
          >
            {isUnlinking ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
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
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-2">
        From: {communication.sender || "Unknown"}
      </p>
      {communication.body_plain && (
        <p className="text-sm text-gray-700 line-clamp-3">
          {communication.body_plain.substring(0, 200)}...
        </p>
      )}
    </div>
  );
}
