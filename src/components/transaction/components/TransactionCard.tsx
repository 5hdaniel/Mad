import React from "react";
import type { Transaction } from "@/types";
import { ManualEntryBadge } from "./TransactionStatusWrapper";

// ============================================
// TRANSACTION CARD COMPONENT
// ============================================

export interface TransactionCardProps {
  /** The transaction data to display */
  transaction: Transaction;
  /** Whether selection mode is active */
  selectionMode: boolean;
  /** Whether this transaction is currently selected */
  isSelected: boolean;
  /** Handler for clicking the transaction card */
  onTransactionClick: () => void;
  /** Handler for clicking the selection checkbox */
  onCheckboxClick: (e: React.MouseEvent) => void;
  /** Function to format currency values */
  formatCurrency: (amount: number | null | undefined) => string;
  /** Function to format date values */
  formatDate: (dateString: string | Date | null | undefined) => string;
}

/**
 * TransactionCard Component
 *
 * Renders a single transaction card with:
 * - Selection checkbox (in selection mode)
 * - Property address with manual entry badge
 * - Transaction type, price, and closing date
 * - Email count and confidence indicator
 * - Arrow indicator for navigation
 *
 * This component is used inside TransactionStatusWrapper
 * which provides the status header styling.
 */
function TransactionCard({
  transaction,
  selectionMode,
  isSelected,
  onTransactionClick,
  onCheckboxClick,
  formatCurrency,
  formatDate,
}: TransactionCardProps): React.ReactElement {
  return (
    <div
      className={`bg-white p-6 hover:shadow-xl transition-all cursor-pointer ${
        selectionMode && isSelected ? "bg-blue-50" : ""
      }`}
      onClick={onTransactionClick}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Selection checkbox */}
        {selectionMode && (
          <div
            className="flex-shrink-0 mt-1"
            onClick={onCheckboxClick}
          >
            <div
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? "bg-blue-500 border-blue-500"
                  : "border-gray-300 hover:border-blue-400"
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
            {/* Manual badge for manually entered transactions */}
            <ManualEntryBadge source={transaction.detection_source} />
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
        {/* Arrow indicator */}
        <div className="flex items-center">
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

export default TransactionCard;
