/**
 * TransactionEmailsTab Component
 * TASK-1183: Emails tab content showing email threads linked to a transaction.
 * Now displays emails grouped into conversation threads for a natural viewing experience.
 * Moved from TransactionDetailsTab as part of TASK-1152.
 */
import React, { useState, useCallback, useMemo } from "react";
import type { Communication } from "../types";
import { AttachEmailsModal } from "./modals";
import {
  EmailThreadCard,
  processEmailThreads,
  type EmailThread,
} from "./EmailThreadCard";

interface TransactionEmailsTabProps {
  communications: Communication[];
  loading: boolean;
  unlinkingCommId: string | null;
  onViewEmail: (comm: Communication) => void;
  onShowUnlinkConfirm: (comm: Communication) => void;
  /** Callback to sync/re-link emails from contacts */
  onSyncCommunications?: () => Promise<void>;
  /** Whether sync is in progress */
  syncingCommunications?: boolean;
  /** Whether there are contacts assigned (to show appropriate help text) */
  hasContacts?: boolean;
  /** User ID for API calls */
  userId?: string;
  /** Transaction ID for API calls */
  transactionId?: string;
  /** Property address for display */
  propertyAddress?: string;
  /** Callback when emails are modified (attached/unlinked) */
  onEmailsChanged?: () => void;
  /** Toast handler for success messages */
  onShowSuccess?: (message: string) => void;
}

export function TransactionEmailsTab({
  communications,
  loading,
  unlinkingCommId,
  onViewEmail,
  onShowUnlinkConfirm,
  onSyncCommunications,
  syncingCommunications = false,
  hasContacts = false,
  userId,
  transactionId,
  propertyAddress,
  onEmailsChanged,
  onShowSuccess,
}: TransactionEmailsTabProps): React.ReactElement {
  const [showAttachModal, setShowAttachModal] = useState(false);

  // Process communications into email threads
  const emailThreads = useMemo(() => {
    return processEmailThreads(communications);
  }, [communications]);

  // Track which thread is being unlinked (by thread ID -> set of email IDs being unlinked)
  const unlinkingThreadId = useMemo(() => {
    if (!unlinkingCommId) return null;
    // Find which thread contains the email being unlinked
    for (const thread of emailThreads) {
      if (thread.emails.some((e) => e.id === unlinkingCommId)) {
        return thread.id;
      }
    }
    return null;
  }, [unlinkingCommId, emailThreads]);

  // Handle attach button click
  const handleAttachClick = useCallback(() => {
    setShowAttachModal(true);
  }, []);

  // Handle emails attached successfully
  const handleAttached = useCallback(() => {
    onEmailsChanged?.();
    onShowSuccess?.("Emails attached successfully");
  }, [onEmailsChanged, onShowSuccess]);

  // Handle thread unlink - unlinks all emails in the thread
  const handleUnlinkThread = useCallback(
    (thread: EmailThread) => {
      // For now, unlink the first email in the thread to trigger the confirmation
      // The UI will show the thread subject in the confirmation
      if (thread.emails.length > 0) {
        onShowUnlinkConfirm(thread.emails[0]);
      }
    },
    [onShowUnlinkConfirm]
  );

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 mt-4">Loading emails...</p>
      </div>
    );
  }

  // Empty state
  if (emailThreads.length === 0) {
    return (
      <div>
        {/* Action buttons */}
        <div className="flex justify-end gap-2 mb-4">
          {/* Attach Emails button */}
          {userId && transactionId && (
            <button
              onClick={handleAttachClick}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              data-testid="attach-emails-button"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Attach Emails
            </button>
          )}
          {/* Sync button */}
          {onSyncCommunications && hasContacts && (
            <button
              onClick={onSyncCommunications}
              disabled={syncingCommunications}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingCommunications ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Sync Emails
                </>
              )}
            </button>
          )}
        </div>

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
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-600 mb-2">No emails linked</p>
          <p className="text-sm text-gray-500">
            Click &quot;Attach Emails&quot; to manually select emails, or add
            contacts to auto-link
          </p>
        </div>

        {/* Attach Emails Modal */}
        {showAttachModal && userId && transactionId && (
          <AttachEmailsModal
            userId={userId}
            transactionId={transactionId}
            propertyAddress={propertyAddress}
            onClose={() => setShowAttachModal(false)}
            onAttached={handleAttached}
          />
        )}
      </div>
    );
  }

  // Calculate total email count
  const totalEmailCount = emailThreads.reduce(
    (sum, thread) => sum + thread.emailCount,
    0
  );

  return (
    <div>
      {/* Action buttons and summary */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          {emailThreads.length} conversation
          {emailThreads.length !== 1 ? "s" : ""}
          {totalEmailCount !== emailThreads.length && (
            <span className="ml-1">({totalEmailCount} emails total)</span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Attach Emails button */}
          {userId && transactionId && (
            <button
              onClick={handleAttachClick}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              data-testid="attach-emails-button"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Attach Emails
            </button>
          )}
          {/* Sync button */}
          {onSyncCommunications && hasContacts && (
            <button
              onClick={onSyncCommunications}
              disabled={syncingCommunications}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingCommunications ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Sync Emails
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Email thread list */}
      <div className="space-y-3">
        {emailThreads.map((thread) => (
          <EmailThreadCard
            key={thread.id}
            thread={thread}
            onViewEmail={onViewEmail}
            onUnlink={() => handleUnlinkThread(thread)}
            isUnlinking={unlinkingThreadId === thread.id}
          />
        ))}
      </div>

      {/* Attach Emails Modal */}
      {showAttachModal && userId && transactionId && (
        <AttachEmailsModal
          userId={userId}
          transactionId={transactionId}
          propertyAddress={propertyAddress}
          onClose={() => setShowAttachModal(false)}
          onAttached={handleAttached}
        />
      )}
    </div>
  );
}
