/**
 * Submission Status Badge Component
 *
 * Displays the current submission status with appropriate styling.
 * Part of BACKLOG-391: Submit for Review UI.
 */
import React from "react";
import type { SubmissionStatus } from "@/types";

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  SubmissionStatus,
  {
    label: string;
    bgColor: string;
    textColor: string;
    icon?: React.ReactNode;
  }
> = {
  not_submitted: {
    label: "Not Submitted",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
    icon: null,
  },
  submitted: {
    label: "Submitted",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  under_review: {
    label: "Under Review",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  needs_changes: {
    label: "Changes Requested",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  resubmitted: {
    label: "Resubmitted",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  approved: {
    label: "Approved",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  rejected: {
    label: "Rejected",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

export function SubmissionStatusBadge({
  status,
  className = "",
}: SubmissionStatusBadgeProps): React.ReactElement {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_submitted;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

export default SubmissionStatusBadge;
