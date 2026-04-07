/**
 * RemovedMessagesSection Component (BACKLOG-1577)
 * Shows a collapsible section at the bottom of the message thread list
 * that displays previously unlinked/removed conversations.
 * Users can view removed messages and optionally restore them.
 */
import React, { useState, useCallback } from "react";
import logger from "../../../utils/logger";
import { MessageThreadCard } from "./MessageThreadCard";
import type { MessageLike } from "./MessageThreadCard";

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
 * Extract a phone number or identifier from a removed thread's messages.
 * Checks participants JSON for "from" (inbound) or first chat_member.
 */
function extractPhoneFromRemovedThread(thread: RemovedThread): string {
  for (const msg of thread.messages) {
    if (!msg.participants) continue;
    try {
      const parsed = typeof msg.participants === "string" ? JSON.parse(msg.participants) : msg.participants;
      // For inbound, "from" is the external contact
      if (msg.direction === "inbound" && parsed.from && parsed.from !== "me" && parsed.from !== "unknown") {
        return parsed.from;
      }
      // For outbound, "to" is the external contact
      if (msg.direction === "outbound" && parsed.to) {
        const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
        const valid = toList.find((t: string) => t && t !== "me" && t !== "unknown");
        if (valid) return valid;
      }
      // Fallback to chat_members
      if (parsed.chat_members && Array.isArray(parsed.chat_members) && parsed.chat_members.length > 0) {
        const valid = parsed.chat_members.find((m: string) => m && m !== "me" && m !== "unknown");
        if (valid) return valid;
      }
      // Last fallback: "from" field regardless of direction
      if (parsed.from && parsed.from !== "me" && parsed.from !== "unknown") {
        return parsed.from;
      }
    } catch {
      // Continue to next message
    }
  }
  return "Unknown";
}

/**
 * Map RemovedMessageRow array to MessageLike array for use with MessageThreadCard.
 * Maps the removed message fields to the Message interface, using deprecated
 * "body" field for backwards compatibility with the conversation view modal.
 */
function mapToMessageLike(rows: RemovedMessageRow[]): MessageLike[] {
  return rows.map((row) => ({
    id: row.message_id,
    user_id: "",
    channel: (row.channel as MessageLike["channel"]) ?? undefined,
    direction: (row.direction as MessageLike["direction"]) ?? undefined,
    subject: row.subject ?? undefined,
    body: row.body ?? undefined,
    body_text: row.body ?? undefined,
    participants: row.participants ?? undefined,
    participants_flat: row.participants_flat ?? undefined,
    thread_id: row.thread_id ?? undefined,
    sent_at: row.sent_at ?? undefined,
    received_at: row.received_at ?? undefined,
    has_attachments: false,
    is_false_positive: false,
    created_at: row.sent_at ?? row.received_at ?? "",
  }));
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
            const messageLikeMessages = mapToMessageLike(thread.messages);
            const phoneNumber = extractPhoneFromRemovedThread(thread);
            const messageCount = thread.messages.length;

            return (
              <div key={thread.ignoredId}>
                <MessageThreadCard
                  threadId={thread.threadId || thread.ignoredId}
                  messages={messageLikeMessages}
                  phoneNumber={phoneNumber}
                  isRemoved={true}
                  onRestore={() => handleRestore(thread)}
                  isRestoring={restoringId === thread.ignoredId}
                />
                {/* Removal metadata below the card */}
                <div className="flex items-center gap-3 -mt-2 mb-3 ml-1 text-xs text-gray-400">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
