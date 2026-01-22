/**
 * TransactionMessagesTab Component
 * Messages tab content showing text messages linked to a transaction.
 * Displays messages grouped by thread in conversation-style format.
 */
import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { Communication } from "../types";
import {
  MessageThreadCard,
  groupMessagesByThread,
  extractPhoneFromThread,
  sortThreadsByRecent,
  type MessageLike,
} from "./MessageThreadCard";
import { AttachMessagesModal, UnlinkMessageModal } from "./modals";

/**
 * Format a date range for display in the toggle label
 * Handles partial dates (only start, only end, or both)
 * BACKLOG-393: Include year in date format for clarity
 */
function formatDateRangeLabel(startDate: Date | null, endDate: Date | null): string {
  const formatDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (startDate && endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  } else if (startDate) {
    return `from ${formatDate(startDate)}`;
  } else if (endDate) {
    return `until ${formatDate(endDate)}`;
  }
  return "";
}

/**
 * Check if a message falls within the audit date range
 */
function isMessageInAuditPeriod(
  msg: MessageLike,
  startDate: Date | null,
  endDate: Date | null
): boolean {
  const msgDate = new Date(msg.sent_at || msg.received_at || 0);

  // Check start date (if set)
  if (startDate && msgDate < startDate) {
    return false;
  }

  // Check end date (if set) - use end of day for inclusive comparison
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (msgDate > endOfDay) {
      return false;
    }
  }

  return true;
}

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

  // BACKLOG-357: Audit date filtering state
  // Parse audit dates
  const parsedStartDate = auditStartDate ? new Date(auditStartDate) : null;
  const parsedEndDate = auditEndDate ? new Date(auditEndDate) : null;
  // Show filter if at least one date is set (handles ongoing transactions with only start date)
  const hasAuditDates = !!(parsedStartDate || parsedEndDate);

  // Default to showing audit period only when dates are available
  const [showAuditPeriodOnly, setShowAuditPeriodOnly] = useState<boolean>(hasAuditDates);

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

  // BACKLOG-357: Filter threads and messages by audit date range
  const { filteredThreads, filteredMessageCount, totalMessageCount, filteredConversationCount, totalConversationCount } = useMemo(() => {
    if (!showAuditPeriodOnly || !hasAuditDates) {
      return {
        filteredThreads: sortedThreads,
        filteredMessageCount: messages.length,
        totalMessageCount: messages.length,
        filteredConversationCount: sortedThreads.length,
        totalConversationCount: sortedThreads.length,
      };
    }

    // Filter threads: keep only threads that have at least one message in audit period
    // Also filter messages within each thread
    const filtered: [string, MessageLike[]][] = [];
    let msgCount = 0;

    for (const [threadId, threadMessages] of sortedThreads) {
      const messagesInPeriod = threadMessages.filter((msg) =>
        isMessageInAuditPeriod(msg, parsedStartDate, parsedEndDate)
      );

      if (messagesInPeriod.length > 0) {
        filtered.push([threadId, messagesInPeriod]);
        msgCount += messagesInPeriod.length;
      }
    }

    return {
      filteredThreads: filtered,
      filteredMessageCount: msgCount,
      totalMessageCount: messages.length,
      filteredConversationCount: filtered.length,
      totalConversationCount: sortedThreads.length,
    };
  }, [sortedThreads, messages.length, showAuditPeriodOnly, hasAuditDates, parsedStartDate, parsedEndDate]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div>
        {/* Attach button */}
        {userId && transactionId && (
          <div className="flex justify-end mb-4">
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
      {/* Header with message count and filter toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Text Messages ({filteredMessageCount})
            {showAuditPeriodOnly && hasAuditDates && filteredMessageCount !== totalMessageCount && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                of {totalMessageCount}
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500">
            in {filteredConversationCount} conversation{filteredConversationCount !== 1 ? "s" : ""}
            {showAuditPeriodOnly && hasAuditDates && filteredConversationCount !== totalConversationCount && (
              <span className="ml-1">of {totalConversationCount}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* BACKLOG-357: Audit period filter toggle */}
          {hasAuditDates && (
            <label className="flex items-center gap-2 cursor-pointer" data-testid="audit-period-filter">
              <input
                type="checkbox"
                checked={showAuditPeriodOnly}
                onChange={(e) => setShowAuditPeriodOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                data-testid="audit-period-filter-checkbox"
              />
              <span className="text-sm text-gray-700">
                Audit period
              </span>
            </label>
          )}

          {/* Attach button */}
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
      </div>

      {/* Showing filtered info line */}
      {showAuditPeriodOnly && hasAuditDates && (
        <p className="text-sm text-gray-500 mb-4" data-testid="audit-period-info">
          Showing {filteredMessageCount} of {totalMessageCount} messages within {formatDateRangeLabel(parsedStartDate, parsedEndDate)}
        </p>
      )}

      {/* Thread list */}
      <div className="space-y-4" data-testid="message-thread-list">
        {filteredThreads.map(([threadId, threadMessages]) => {
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

      {/* Empty filtered state */}
      {filteredThreads.length === 0 && totalMessageCount > 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
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
          <p className="text-gray-600 mb-1">No messages in audit period</p>
          <p className="text-sm text-gray-500">
            {totalMessageCount} message{totalMessageCount !== 1 ? "s" : ""} exist outside the audit date range
          </p>
          <button
            onClick={() => setShowAuditPeriodOnly(false)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
          >
            Show all messages
          </button>
        </div>
      )}

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
