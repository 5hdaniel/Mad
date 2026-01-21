/**
 * TransactionMessagesTab Component
 * Messages tab content showing text messages linked to a transaction.
 * Displays messages grouped by thread in conversation-style format.
 */
import React, { useState, useCallback, useEffect } from "react";
import type { Communication } from "../types";
import {
  MessageThreadCard,
  groupMessagesByThread,
  extractPhoneFromThread,
  sortThreadsByRecent,
  type MessageLike,
} from "./MessageThreadCard";
import { AttachMessagesModal, UnlinkMessageModal } from "./modals";

interface TransactionMessagesTabProps {
  /** Text messages linked to the transaction */
  messages: Communication[];
  /** Whether messages are being loaded */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** User ID for API calls */
  userId?: string;
  /** Transaction ID for API calls */
  transactionId?: string;
  /** Property address for display */
  propertyAddress?: string;
  /** Callback when messages are modified (attached/unlinked). Can be async for refresh. */
  onMessagesChanged?: () => void | Promise<void>;
  /** Toast handler for success messages */
  onShowSuccess?: (message: string) => void;
  /** Toast handler for error messages */
  onShowError?: (message: string) => void;
  /** Audit period start date for filtering (TASK-1157) */
  auditStartDate?: Date | string | null;
  /** Audit period end date for filtering (TASK-1157) */
  auditEndDate?: Date | string | null;
}

/**
 * Messages tab content component.
 * Shows loading state, empty state, or message threads.
 */
/**
 * Extract all unique phone numbers from messages for contact lookup.
 */
function extractAllPhones(messages: MessageLike[]): string[] {
  const phones = new Set<string>();

  for (const msg of messages) {
    try {
      if (msg.participants) {
        const parsed = typeof msg.participants === 'string'
          ? JSON.parse(msg.participants)
          : msg.participants;

        if (parsed.from) phones.add(parsed.from);
        if (parsed.to) {
          const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
          toList.forEach((p: string) => phones.add(p));
        }
      }
    } catch {
      // Skip invalid JSON
    }

    // Also check sender field
    if ("sender" in msg && msg.sender) {
      phones.add(msg.sender);
    }
  }

  // Remove "me" placeholder
  phones.delete("me");

  return Array.from(phones);
}

export function TransactionMessagesTab({
  messages,
  loading,
  error,
  userId,
  transactionId,
  propertyAddress,
  onMessagesChanged,
  onShowSuccess,
  onShowError,
  auditStartDate,
  auditEndDate,
}: TransactionMessagesTabProps): React.ReactElement {
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{
    threadId: string;
    phoneNumber: string;
    messageCount: number;
  } | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  // Look up contact names for all phone numbers in messages
  useEffect(() => {
    const lookupContactNames = async () => {
      if (messages.length === 0) return;

      const phones = extractAllPhones(messages);
      if (phones.length === 0) return;

      console.log("[Messages] Looking up contact names for phones:", phones);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window.api.contacts as any).getNamesByPhones(phones);
        console.log("[Messages] Contact lookup result:", result);

        if (result.success && result.names) {
          // Build a lookup map with both original and normalized phone keys
          const namesWithNormalized: Record<string, string> = {};
          Object.entries(result.names as Record<string, string>).forEach(([phone, name]) => {
            namesWithNormalized[phone] = name;
            // Also add normalized version (last 10 digits)
            const normalized = phone.replace(/\D/g, '').slice(-10);
            if (normalized.length >= 7) {
              namesWithNormalized[normalized] = name;
            }
          });
          console.log("[Messages] Contact names map:", namesWithNormalized);
          setContactNames(namesWithNormalized);
        } else if (Object.keys(result.names || {}).length === 0) {
          console.log("[Messages] No matching contacts found for these phone numbers");
        }
      } catch (err) {
        console.error("Failed to look up contact names:", err);
      }
    };

    lookupContactNames();
  }, [messages]);

  // Handle attach button click
  const handleAttachClick = useCallback(() => {
    setShowAttachModal(true);
  }, []);

  // Handle messages attached successfully
  const handleAttached = useCallback(() => {
    onMessagesChanged?.();
    onShowSuccess?.("Messages attached successfully");
  }, [onMessagesChanged, onShowSuccess]);

  // Handle unlink button click on a thread
  const handleUnlinkClick = useCallback(
    (threadId: string) => {
      // Find thread info for the confirmation modal
      const threads = groupMessagesByThread(messages);
      const threadMessages = threads.get(threadId);
      if (threadMessages) {
        setUnlinkTarget({
          threadId,
          phoneNumber: extractPhoneFromThread(threadMessages),
          messageCount: threadMessages.length,
        });
      }
    },
    [messages]
  );

  // Handle unlink confirmation
  const handleUnlinkConfirm = useCallback(async () => {
    if (!unlinkTarget || !transactionId) return;

    setIsUnlinking(true);
    try {
      // Get all message IDs for this thread
      const threads = groupMessagesByThread(messages);
      const threadMessages = threads.get(unlinkTarget.threadId);
      if (!threadMessages) {
        throw new Error("Thread not found");
      }

      const messageIds = threadMessages.map((m) => m.id);
      // TASK-1116: Pass transactionId for thread-based unlinking
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window.api.transactions as any).unlinkMessages(messageIds, transactionId) as { success: boolean; error?: string };

      if (result.success) {
        onShowSuccess?.("Messages removed from transaction");
        // Await the refresh to ensure UI updates before closing modal
        // The callback may return a Promise (async refresh function)
        await onMessagesChanged?.();
        setUnlinkTarget(null);
      } else {
        onShowError?.(result.error || "Failed to remove messages");
      }
    } catch (err) {
      console.error("Failed to unlink messages:", err);
      onShowError?.(
        err instanceof Error ? err.message : "Failed to remove messages"
      );
    } finally {
      setIsUnlinking(false);
    }
  }, [unlinkTarget, messages, transactionId, onMessagesChanged, onShowSuccess, onShowError]);

  // Handle cancel unlink
  const handleUnlinkCancel = useCallback(() => {
    setUnlinkTarget(null);
  }, []);

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

  // Group messages by thread and sort by most recent
  const threads = groupMessagesByThread(messages);
  const sortedThreads = sortThreadsByRecent(threads);

  // Empty state
  if (messages.length === 0) {
    return (
      <div>
        {/* Header with Attach button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
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
              Text Messages (0)
            </h4>
          </div>
          {userId && transactionId && (
            <button
              onClick={handleAttachClick}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
              data-testid="attach-messages-button"
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
              Attach Messages
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-gray-600 mb-2">No text messages linked</p>
          <p className="text-sm text-gray-500">
            Click "Attach Messages" to link message threads to this transaction
          </p>
        </div>

        {/* Modals */}
        {showAttachModal && userId && transactionId && (
          <AttachMessagesModal
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

  return (
    <div>
      {/* Header with Attach button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
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
        {userId && transactionId && (
          <button
            onClick={handleAttachClick}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            data-testid="attach-messages-button"
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
            Attach Messages
          </button>
        )}
      </div>

      {/* Thread list */}
      <div className="space-y-4" data-testid="message-thread-list">
        {sortedThreads.map(([threadId, threadMessages]) => {
          const phoneNumber = extractPhoneFromThread(threadMessages);
          // Look up contact name for thread header
          const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
          const contactName = contactNames[phoneNumber] || contactNames[normalized];

          return (
            <MessageThreadCard
              key={threadId}
              threadId={threadId}
              messages={threadMessages}
              phoneNumber={phoneNumber}
              contactName={contactName}
              contactNames={contactNames}
              onUnlink={userId && transactionId ? handleUnlinkClick : undefined}
              auditStartDate={auditStartDate}
              auditEndDate={auditEndDate}
            />
          );
        })}
      </div>

      {/* Modals */}
      {showAttachModal && userId && transactionId && (
        <AttachMessagesModal
          userId={userId}
          transactionId={transactionId}
          propertyAddress={propertyAddress}
          onClose={() => setShowAttachModal(false)}
          onAttached={handleAttached}
        />
      )}

      {unlinkTarget && (
        <UnlinkMessageModal
          phoneNumber={unlinkTarget.phoneNumber}
          messageCount={unlinkTarget.messageCount}
          isUnlinking={isUnlinking}
          onCancel={handleUnlinkCancel}
          onUnlink={handleUnlinkConfirm}
        />
      )}
    </div>
  );
}
