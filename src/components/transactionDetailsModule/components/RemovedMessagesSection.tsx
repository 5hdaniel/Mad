/**
 * RemovedMessagesSection Component (BACKLOG-1577)
 * Shows a collapsible section at the bottom of the message thread list
 * that displays previously unlinked/removed conversations.
 * Users can view removed messages and optionally restore them.
 */
import React, { useState, useCallback } from "react";
import logger from "../../../utils/logger";

/** Shape of a removed message row from the IPC handler */
interface RemovedMessageRow {
  ignored_id: string;
  ic_thread_id: string | null;
  reason: string | null;
  ignored_at: string;
  message_id: string;
  body: string | null;
  subject: string | null;
  channel: string | null;
  thread_id: string | null;
  sent_at: string | null;
  received_at: string | null;
  participants: string | null;
  participants_flat: string | null;
  direction: string | null;
}

/** Group of removed messages sharing the same ignored_communications record */
interface RemovedThread {
  ignoredId: string;
  threadId: string | null;
  reason: string | null;
  ignoredAt: string;
  messages: RemovedMessageRow[];
}

interface RemovedMessagesSectionProps {
  transactionId: string;
  /** Callback when a message is restored (to refresh the parent list) */
  onMessagesChanged?: () => void | Promise<void>;
  /** Toast handlers */
  onShowSuccess?: (message: string) => void;
  onShowError?: (message: string) => void;
}

/**
 * Extract a display name from participants JSON.
 * Returns the first "from" field or first participant found.
 */
function extractSender(participants: string | null): string {
  if (!participants) return "Unknown";
  try {
    const parsed = typeof participants === "string" ? JSON.parse(participants) : participants;
    if (parsed.from) return parsed.from;
    if (parsed.chat_members && Array.isArray(parsed.chat_members) && parsed.chat_members.length > 0) {
      return parsed.chat_members[0];
    }
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

/**
 * Format a date string for display.
 */
function formatRemovedDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Truncate text to a max length with ellipsis.
 */
function truncateText(text: string | null, maxLength: number): string {
  if (!text) return "(no content)";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Group removed message rows by ignored_id (each ignored_communications record
 * may match multiple messages in the same thread).
 */
function groupByIgnoredId(rows: RemovedMessageRow[]): RemovedThread[] {
  const map = new Map<string, RemovedThread>();

  for (const row of rows) {
    let thread = map.get(row.ignored_id);
    if (!thread) {
      thread = {
        ignoredId: row.ignored_id,
        threadId: row.ic_thread_id || row.thread_id,
        reason: row.reason,
        ignoredAt: row.ignored_at,
        messages: [],
      };
      map.set(row.ignored_id, thread);
    }
    thread.messages.push(row);
  }

  return Array.from(map.values());
}

export function RemovedMessagesSection({
  transactionId,
  onMessagesChanged,
  onShowSuccess,
  onShowError,
}: RemovedMessagesSectionProps): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removedThreads, setRemovedThreads] = useState<RemovedThread[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Fetch removed messages when section is opened
  const handleToggle = useCallback(async () => {
    if (!isOpen) {
      setLoading(true);
      try {
        const result = await window.api.transactions.getRemovedMessages(transactionId);
        if (result.success && result.removedMessages) {
          const threads = groupByIgnoredId(result.removedMessages);
          setRemovedThreads(threads);
          setTotalCount(threads.length);
        } else {
          setRemovedThreads([]);
          setTotalCount(0);
        }
      } catch (err) {
        logger.error("Failed to fetch removed messages:", err);
        setRemovedThreads([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    }
    setIsOpen((prev) => !prev);
  }, [isOpen, transactionId]);

  // Restore a removed thread (re-link messages + delete suppression record)
  const handleRestore = useCallback(async (thread: RemovedThread) => {
    setRestoringId(thread.ignoredId);
    try {
      const messageIds = thread.messages.map((m) => m.message_id);
      const result = await window.api.transactions.restoreRemovedMessage(
        thread.ignoredId,
        messageIds,
        transactionId,
      );

      if (result.success) {
        onShowSuccess?.("Conversation restored successfully");
        // Remove from local state
        setRemovedThreads((prev) => prev.filter((t) => t.ignoredId !== thread.ignoredId));
        setTotalCount((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
        // Refresh parent message list
        await onMessagesChanged?.();
      } else {
        onShowError?.(result.error || "Failed to restore conversation");
      }
    } catch (err) {
      logger.error("Failed to restore removed message:", err);
      onShowError?.(err instanceof Error ? err.message : "Failed to restore conversation");
    } finally {
      setRestoringId(null);
    }
  }, [transactionId, onMessagesChanged, onShowSuccess, onShowError]);

  // Show nothing until we know the count (first load), or show toggle
  // Always render the toggle button so user can discover removed messages
  return (
    <div className="mt-4">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        data-testid="show-removed-messages-toggle"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {totalCount !== null
          ? `Show removed (${totalCount})`
          : "Show removed conversations"}
      </button>

      {/* Collapsed section */}
      {isOpen && (
        <div className="mt-3 space-y-3" data-testid="removed-messages-section">
          {loading && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Loading removed conversations...</span>
            </div>
          )}

          {!loading && removedThreads.length === 0 && (
            <p className="text-sm text-gray-400 py-2">
              No removed conversations found.
            </p>
          )}

          {!loading && removedThreads.map((thread) => {
            const firstMessage = thread.messages[0];
            const sender = extractSender(firstMessage?.participants ?? null);
            const messageCount = thread.messages.length;
            const isRestoring = restoringId === thread.ignoredId;

            return (
              <div
                key={thread.ignoredId}
                className="border border-gray-200 rounded-lg bg-gray-50 p-3 opacity-70"
                data-testid="removed-thread-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Sender and channel */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-500 truncate">
                        {sender}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
                        Removed
                      </span>
                      {firstMessage?.channel && (
                        <span className="text-xs text-gray-400">
                          {firstMessage.channel === "sms" ? "SMS" : firstMessage.channel === "imessage" ? "iMessage" : firstMessage.channel}
                        </span>
                      )}
                    </div>

                    {/* Message preview */}
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {truncateText(firstMessage?.body ?? firstMessage?.subject, 120)}
                    </p>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>
                        {messageCount} message{messageCount !== 1 ? "s" : ""}
                      </span>
                      {thread.ignoredAt && (
                        <span>
                          Removed {formatRemovedDate(thread.ignoredAt)}
                        </span>
                      )}
                      {thread.reason && (
                        <span className="truncate max-w-[200px]" title={thread.reason}>
                          {thread.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Restore button */}
                  <button
                    type="button"
                    onClick={() => handleRestore(thread)}
                    disabled={isRestoring}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="restore-removed-message"
                    title="Restore this conversation to the transaction"
                  >
                    {isRestoring ? (
                      <>
                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Restoring...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Restore
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
