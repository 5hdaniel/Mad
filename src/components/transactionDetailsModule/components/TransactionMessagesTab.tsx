/**
 * TransactionMessagesTab Component
 * Messages tab content showing text messages linked to a transaction.
 * Displays messages grouped by thread in conversation-style format.
 */
import React from "react";
import type { Communication } from "../types";
import {
  MessageThreadCard,
  groupMessagesByThread,
  extractPhoneFromThread,
  sortThreadsByRecent,
} from "./MessageThreadCard";

interface TransactionMessagesTabProps {
  /** Text messages linked to the transaction */
  messages: Communication[];
  /** Whether messages are being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

/**
 * Messages tab content component.
 * Shows loading state, empty state, or message threads.
 */
export function TransactionMessagesTab({
  messages,
  loading,
  error,
}: TransactionMessagesTabProps): React.ReactElement {
  // Loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 mt-4">Loading messages...</p>
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
  if (messages.length === 0) {
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
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="text-gray-600 mb-2">No text messages linked</p>
        <p className="text-sm text-gray-500">
          Messages will appear here once linked to this transaction
        </p>
      </div>
    );
  }

  // Group messages by thread and sort by most recent
  const threads = groupMessagesByThread(messages);
  const sortedThreads = sortThreadsByRecent(threads);

  return (
    <div>
      {/* Header */}
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
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h4 className="text-lg font-semibold text-gray-900">
          Text Messages ({messages.length})
        </h4>
        {sortedThreads.length > 1 && (
          <span className="text-sm text-gray-500">
            in {sortedThreads.length} conversations
          </span>
        )}
      </div>

      {/* Thread list */}
      <div className="space-y-4" data-testid="message-thread-list">
        {sortedThreads.map(([threadId, threadMessages]) => (
          <MessageThreadCard
            key={threadId}
            threadId={threadId}
            messages={threadMessages}
            phoneNumber={extractPhoneFromThread(threadMessages)}
            // contactName could be looked up from contact service in future
          />
        ))}
      </div>
    </div>
  );
}
