import React from "react";
import type { Transaction } from "@/types";
import { LicenseGate } from "@/components/common/LicenseGate";
import { useLicense } from "@/contexts/LicenseContext";

// ============================================
// DETECTION BADGE COMPONENTS
// ============================================

/**
 * Badge showing manual entry - only shown for manually created transactions
 * when the user has AI add-on (otherwise all transactions are manual by default)
 */
export function ManualEntryBadge({
  source,
}: {
  source: "auto" | "manual" | "hybrid" | undefined;
}) {
  const { hasAIAddon } = useLicense();

  // Don't show badge if no AI add-on - no distinction needed
  if (!hasAIAddon) {
    return null;
  }

  // Only show badge for manually entered transactions
  if (source !== "manual") {
    return null;
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500 text-white">
      Manual
    </span>
  );
}

/**
 * Confidence indicator bar with color gradient
 * Only shown for pending transactions
 */
export function ConfidenceBar({ confidence }: { confidence: number | undefined }) {
  if (confidence === undefined || confidence === null) {
    return null;
  }

  const percentage =
    confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  let barColor: string;
  if (percentage < 60) {
    barColor = "bg-red-500";
  } else if (percentage < 80) {
    barColor = "bg-amber-500";
  } else {
    barColor = "bg-emerald-500";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-600">{percentage}%</span>
    </div>
  );
}

// ============================================
// UNIFIED TRANSACTION STATUS WRAPPER
// ============================================

export type TransactionStatusType = "pending" | "active" | "closed" | "rejected";

export interface StatusConfig {
  label: string;
  headerBg: string;
  headerBorder: string;
  textColor: string;
  buttonBg: string;
  buttonHover: string;
  buttonText: string;
  icon: React.ReactNode;
  showConfidence: boolean;
}

/**
 * Get status configuration based on transaction state
 * @param transaction - The transaction to get status for
 * @param hasAIAddon - Whether the user has the AI add-on (affects rejected status display)
 */
export function getStatusConfig(transaction: Transaction, hasAIAddon: boolean = true): StatusConfig {
  const detectionStatus = transaction.detection_status;
  const status = transaction.status;

  // Pending Review - Amber
  // Show pending styling if EITHER detection_status OR status is "pending"
  // Note: Without AI add-on, pending status is still possible for manual workflow
  if (detectionStatus === "pending" || status === "pending") {
    return {
      label: "Pending Review",
      headerBg: "bg-gradient-to-r from-amber-50 to-orange-50",
      headerBorder: "border-amber-300",
      textColor: "text-amber-800",
      buttonBg: "bg-amber-500",
      buttonHover: "hover:bg-amber-600",
      buttonText: "Review & Edit",
      icon: (
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
      ),
      showConfidence: true,
    };
  }

  // Rejected - Red (AI add-on only)
  // Without AI add-on, treat rejected transactions as Active
  // (Rejected is an AI concept - false positive from auto-detection)
  if (detectionStatus === "rejected" && hasAIAddon) {
    return {
      label: "Rejected",
      headerBg: "bg-gradient-to-r from-red-50 to-rose-50",
      headerBorder: "border-red-300",
      textColor: "text-red-800",
      buttonBg: "bg-red-500",
      buttonHover: "hover:bg-red-600",
      buttonText: "Restore",
      icon: (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      showConfidence: false,
    };
  }

  // Closed - Gray
  if (status === "closed") {
    return {
      label: "Closed",
      headerBg: "bg-gradient-to-r from-gray-50 to-slate-50",
      headerBorder: "border-gray-300",
      textColor: "text-gray-700",
      buttonBg: "bg-gray-500",
      buttonHover: "hover:bg-gray-600",
      buttonText: "Export",
      icon: (
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      showConfidence: false,
    };
  }

  // Active - Green (default)
  return {
    label: "Active",
    headerBg: "bg-gradient-to-r from-green-50 to-emerald-50",
    headerBorder: "border-green-300",
    textColor: "text-green-800",
    buttonBg: "bg-green-500",
    buttonHover: "hover:bg-green-600",
    buttonText: "Export",
    icon: (
      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    showConfidence: false,
  };
}

export interface TransactionStatusWrapperProps {
  transaction: Transaction;
  onActionClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

/**
 * Unified wrapper component for ALL transaction statuses
 * Provides consistent "packaging" look with status-appropriate styling
 */
function TransactionStatusWrapper({
  transaction,
  onActionClick,
  children,
}: TransactionStatusWrapperProps) {
  const { hasAIAddon } = useLicense();
  const config = getStatusConfig(transaction, hasAIAddon);

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onActionClick(e);
  };

  return (
    <div className="relative">
      {/* Status Header */}
      <div className={`${config.headerBg} border-2 ${config.headerBorder} border-b-0 rounded-t-xl px-4 py-3`}>
        <div className="flex items-center justify-between">
          {/* Left: Status Label with Icon */}
          <div className="flex items-center gap-2">
            {config.icon}
            <span className={`text-sm font-semibold ${config.textColor}`}>
              {config.label}
            </span>
          </div>

          {/* Center: Confidence (only for pending) */}
          {config.showConfidence && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                Confidence
              </span>
              <ConfidenceBar confidence={transaction.detection_confidence} />
            </div>
          )}

          {/* Right: Action Button */}
          {/* Export button - Individual license only */}
          {config.buttonText === "Export" ? (
            <LicenseGate requires="individual">
              <button
                onClick={handleActionClick}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${config.buttonBg} ${config.buttonHover} text-white shadow-sm hover:shadow flex items-center gap-1.5`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {config.buttonText}
              </button>
            </LicenseGate>
          ) : (
            <button
              onClick={handleActionClick}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${config.buttonBg} ${config.buttonHover} text-white shadow-sm hover:shadow flex items-center gap-1.5`}
            >
              {config.buttonText === "Review & Edit" && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              )}
              {config.buttonText === "Restore" && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {config.buttonText}
            </button>
          )}
        </div>
      </div>

      {/* Transaction Card Content */}
      <div className={`border-2 ${config.headerBorder} border-t-0 rounded-b-xl overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}

export default TransactionStatusWrapper;
