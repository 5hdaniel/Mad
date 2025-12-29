/**
 * TransactionMessagesTab Component
 * Messages tab content showing text messages linked to a transaction.
 * This component provides the infrastructure for the messages tab.
 * Full message rendering is implemented in TASK-703.
 */
import React from "react";
import type { Communication } from "../types";

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
 * Shows loading state, empty state, or message count placeholder.
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

  // Messages exist - placeholder for TASK-703 implementation
  // For now, show a simple count and message list structure
  return (
    <div>
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
      </div>

      {/* Message list placeholder - full rendering in TASK-703 */}
      <div className="space-y-4">
        {messages.map((message) => (
          <MessagePreviewCard key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

/**
 * Simple message preview card component.
 * Shows basic message info. Full thread display in TASK-703.
 */
function MessagePreviewCard({
  message,
}: {
  message: Communication;
}): React.ReactElement {
  // Parse participants if available
  let senderDisplay = "Unknown";
  try {
    if (message.participants) {
      const participants = JSON.parse(message.participants);
      senderDisplay = participants.from || "Unknown";
    } else if (message.sender) {
      senderDisplay = message.sender;
    }
  } catch {
    // Use default if parsing fails
  }

  // Format date
  const messageDate = message.sent_at || message.received_at;
  const formattedDate = messageDate
    ? new Date(messageDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  // Get body preview
  const bodyPreview = message.body_text || message.body_plain || message.body || "";
  const truncatedBody =
    bodyPreview.length > 150 ? bodyPreview.substring(0, 150) + "..." : bodyPreview;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full uppercase">
              {message.channel || "sms"}
            </span>
            {message.direction && (
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                  message.direction === "inbound"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {message.direction === "inbound" ? "Received" : "Sent"}
              </span>
            )}
          </div>
          <p className="font-medium text-gray-900 truncate">{senderDisplay}</p>
          {truncatedBody && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{truncatedBody}</p>
          )}
        </div>
        <span className="text-xs text-gray-500 ml-4 flex-shrink-0">{formattedDate}</span>
      </div>
    </div>
  );
}
