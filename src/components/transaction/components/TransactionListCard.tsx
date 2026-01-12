/**
 * TransactionListCard Component
 * Card display for a single transaction in the transaction list
 * Includes detection badges, quick export, and selection checkbox
 */
import React from "react";
import type { Transaction } from "../../../../electron/types/models";
import {
  DetectionSourceBadge,
  ConfidencePill,
  PendingReviewBadge,
} from "./DetectionBadges";
import { formatCommunicationCounts } from "./TransactionCard";

// ============================================
// TYPES
// ============================================

export interface TransactionListCardProps {
  transaction: Transaction;
  selectionMode: boolean;
  isSelected: boolean;
  onTransactionClick: (transaction: Transaction) => void;
  onCheckboxClick: (e: React.MouseEvent, transactionId: string) => void;
  onQuickExport: (transaction: Transaction, e: React.MouseEvent) => void;
  formatCurrency: (amount: number | undefined) => string;
  formatDate: (dateString: string | Date | undefined) => string;
}

// ============================================
// TRANSACTION LIST CARD COMPONENT
// ============================================

/**
 * TransactionListCard
 * Renders a single transaction card with selection, badges, and quick export
 */
export function TransactionListCard({
  transaction,
  selectionMode,
  isSelected,
  onTransactionClick,
  onCheckboxClick,
  onQuickExport,
  formatCurrency,
  formatDate,
}: TransactionListCardProps): React.ReactElement {
  return (
    <div
      className={`bg-white border-2 rounded-xl p-6 transition-all cursor-pointer transform hover:scale-[1.01] ${
        selectionMode && isSelected
          ? "border-purple-500 bg-purple-50 shadow-lg"
          : "border-gray-200 hover:border-blue-400 hover:shadow-xl"
      }`}
      onClick={() => onTransactionClick(transaction)}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Selection Checkbox */}
        {selectionMode && (
          <div
            className="flex-shrink-0 mt-1"
            onClick={(e) => onCheckboxClick(e, transaction.id)}
          >
            <div
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? "bg-purple-500 border-purple-500"
                  : "border-gray-300 hover:border-purple-400"
              }`}
            >
              {isSelected && (
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
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">
              {transaction.property_address}
            </h3>
            {/* Detection Status Badges */}
            <div className="flex items-center gap-1.5">
              <DetectionSourceBadge source={transaction.detection_source} />
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
              {formatCommunicationCounts(
                transaction.email_count || 0,
                transaction.text_count || 0
              )}
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
            onClick={(e) => onQuickExport(transaction, e)}
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
  );
}

export default TransactionListCard;
