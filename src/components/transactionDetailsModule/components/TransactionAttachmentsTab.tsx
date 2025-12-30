/**
 * TransactionAttachmentsTab Component
 * Attachments tab content showing email attachments linked to a transaction.
 */
import React from "react";
import type { TransactionAttachment } from "../hooks/useTransactionAttachments";
import { AttachmentCard } from "./AttachmentCard";

interface TransactionAttachmentsTabProps {
  /** Attachments linked to the transaction */
  attachments: TransactionAttachment[];
  /** Whether attachments are being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

/**
 * Group attachments by email for better organization
 */
function groupByEmail(
  attachments: TransactionAttachment[]
): Map<string, TransactionAttachment[]> {
  const groups = new Map<string, TransactionAttachment[]>();

  for (const attachment of attachments) {
    const key = attachment.emailId;
    const existing = groups.get(key) || [];
    existing.push(attachment);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Attachments tab content component.
 * Shows loading state, empty state, or list of attachments grouped by email.
 */
export function TransactionAttachmentsTab({
  attachments,
  loading,
  error,
}: TransactionAttachmentsTabProps): React.ReactElement {
  // Loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 mt-4">Loading attachments...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 text-red-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-red-600 mb-2">{error}</p>
        <p className="text-sm text-gray-500">
          Please try again or contact support if the issue persists.
        </p>
      </div>
    );
  }

  // Empty state
  if (attachments.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 text-gray-300 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
        <p className="text-gray-600 mb-2">No attachments found</p>
        <p className="text-sm text-gray-500">
          Attachments from emails linked to this transaction will appear here
        </p>
      </div>
    );
  }

  // Group attachments by email
  const groupedAttachments = groupByEmail(attachments);
  const emailGroups = Array.from(groupedAttachments.entries());

  return (
    <div>
      {/* Header with count */}
      <div className="flex items-center gap-2 mb-6">
        <svg
          className="w-5 h-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
        <h4 className="text-lg font-semibold text-gray-900">
          Email Attachments ({attachments.length})
        </h4>
      </div>

      {/* Attachments grouped by email */}
      <div className="space-y-6">
        {emailGroups.map(([emailId, emailAttachments]) => {
          const firstAttachment = emailAttachments[0];
          return (
            <div key={emailId} className="space-y-3">
              {/* Email header */}
              <div className="flex items-center gap-2 text-sm text-gray-600 border-b border-gray-100 pb-2">
                <svg
                  className="w-4 h-4 text-gray-400"
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
                <span className="font-medium truncate">
                  {firstAttachment.emailSubject}
                </span>
                <span className="text-gray-400">
                  ({emailAttachments.length} file
                  {emailAttachments.length === 1 ? "" : "s"})
                </span>
              </div>

              {/* Attachment cards */}
              <div className="grid gap-3 sm:grid-cols-2">
                {emailAttachments.map((attachment) => (
                  <AttachmentCard key={attachment.id} attachment={attachment} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info notice about download */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-500 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-blue-700">
            <p className="font-medium">Attachment Preview</p>
            <p className="mt-1">
              These attachments are from emails linked to this transaction. To
              access the files, open the original email in your email client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
