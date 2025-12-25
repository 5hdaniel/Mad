/**
 * Detection Badge Components
 * Visual indicators for AI-detected transactions and confidence levels
 */
import React from "react";

// ============================================
// DETECTION SOURCE BADGE
// ============================================

interface DetectionSourceBadgeProps {
  source: "auto" | "manual" | "hybrid" | undefined;
}

/**
 * Badge showing whether transaction was AI-detected or manually created
 */
export function DetectionSourceBadge({
  source,
}: DetectionSourceBadgeProps): React.ReactElement | null {
  if (!source || source === "manual") {
    return null; // Don't show badge for manual transactions
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

// ============================================
// CONFIDENCE PILL
// ============================================

interface ConfidencePillProps {
  confidence: number | undefined;
}

/**
 * Confidence pill with color scale based on confidence level
 * Red (<60%), Yellow (60-80%), Green (>80%)
 */
export function ConfidencePill({
  confidence,
}: ConfidencePillProps): React.ReactElement | null {
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

// ============================================
// PENDING REVIEW BADGE
// ============================================

/**
 * Warning badge for transactions pending user review
 */
export function PendingReviewBadge(): React.ReactElement {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500 text-white">
      Pending Review
    </span>
  );
}
