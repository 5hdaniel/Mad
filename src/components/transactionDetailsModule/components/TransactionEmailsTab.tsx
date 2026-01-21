/**
 * TransactionEmailsTab Component
 * Emails tab content showing email threads linked to a transaction.
 * Moved from TransactionDetailsTab as part of TASK-1152.
 */
import React from "react";
import type { Communication } from "../types";

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
}: TransactionEmailsTabProps): React.ReactElement {
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
  if (communications.length === 0) {
    return (
      <div>
        {/* Sync button */}
        {onSyncCommunications && hasContacts && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onSyncCommunications}
              disabled={syncingCommunications}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingCommunications ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Emails
                </>
              )}
            </button>
          </div>
        )}

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
            {hasContacts
              ? 'Click "Sync Emails" to find emails from your contacts'
              : 'Add contacts in the Overview tab to auto-link related emails'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sync button */}
      {onSyncCommunications && hasContacts && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onSyncCommunications}
            disabled={syncingCommunications}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncingCommunications ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Emails
              </>
            )}
          </button>
        </div>
      )}

      {/* Email list */}
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
    </div>
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
    </div>
  );
}
