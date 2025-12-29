/**
 * AttachMessagesModal Component
 * Modal for browsing and attaching unlinked message threads to a transaction
 */
import React, { useState, useEffect, useMemo } from "react";
import type { Communication } from "../../types";
import {
  groupMessagesByThread,
  extractPhoneFromThread,
  sortThreadsByRecent,
} from "../MessageThreadCard";

interface AttachMessagesModalProps {
  /** User ID to fetch unlinked messages for */
  userId: string;
  /** Transaction ID to attach messages to */
  transactionId: string;
  /** Optional property address for display */
  propertyAddress?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when messages are successfully attached */
  onAttached: () => void;
}

/**
 * Get initials for avatar display.
 */
function getAvatarInitial(phoneNumber: string): string {
  // If phone number, just show hash
  return "#";
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Format as +X (XXX) XXX-XXXX if 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Get most recent message date from a thread
 */
function getThreadDate(messages: Communication[]): string {
  const lastMsg = messages[messages.length - 1];
  const date = new Date(lastMsg?.sent_at || lastMsg?.received_at || 0);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get preview text from the most recent message
 */
function getPreviewText(messages: Communication[]): string {
  const lastMsg = messages[messages.length - 1];
  const text = lastMsg?.body_text || lastMsg?.body || "";
  if (text.length > 80) {
    return text.substring(0, 80) + "...";
  }
  return text || "(No message content)";
}

export function AttachMessagesModal({
  userId,
  transactionId,
  propertyAddress,
  onClose,
  onAttached,
}: AttachMessagesModalProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Map<string, Communication[]>>(new Map());
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [attaching, setAttaching] = useState(false);

  // Load unlinked messages on mount
  useEffect(() => {
    async function loadUnlinkedMessages() {
      setLoading(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window.api.transactions as any).getUnlinkedMessages(userId) as { success: boolean; messages?: Communication[]; error?: string };
        if (result.success && result.messages) {
          const grouped = groupMessagesByThread(result.messages);
          setThreads(grouped);
        } else {
          setError(result.error || "Failed to load messages");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setLoading(false);
      }
    }
    loadUnlinkedMessages();
  }, [userId]);

  // Sort and filter threads
  const sortedThreads = useMemo(() => {
    const sorted = sortThreadsByRecent(threads);
    if (!searchQuery.trim()) {
      return sorted;
    }
    const query = searchQuery.toLowerCase();
    return sorted.filter(([threadId, messages]) => {
      const phone = extractPhoneFromThread(messages).toLowerCase();
      const preview = getPreviewText(messages).toLowerCase();
      return phone.includes(query) || preview.includes(query);
    });
  }, [threads, searchQuery]);

  const handleToggleThread = (threadId: string) => {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedThreadIds.size === sortedThreads.length) {
      // Deselect all
      setSelectedThreadIds(new Set());
    } else {
      // Select all visible threads
      setSelectedThreadIds(new Set(sortedThreads.map(([id]) => id)));
    }
  };

  const handleAttach = async () => {
    if (selectedThreadIds.size === 0) return;

    setAttaching(true);
    setError(null);
    try {
      // Collect all message IDs from selected threads
      const messageIds: string[] = [];
      for (const threadId of selectedThreadIds) {
        const messages = threads.get(threadId);
        if (messages) {
          messageIds.push(...messages.map((m) => m.id));
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window.api.transactions as any).linkMessages(
        messageIds,
        transactionId
      ) as { success: boolean; error?: string };

      if (result.success) {
        onAttached();
        onClose();
      } else {
        setError(result.error || "Failed to attach messages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach messages");
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4"
      data-testid="attach-messages-modal"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-500 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-white">Attach Messages</h3>
            <p className="text-green-100 text-sm">
              {propertyAddress
                ? `Link messages to ${propertyAddress}`
                : "Select message threads to attach"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            data-testid="close-modal-button"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by phone number or message content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              data-testid="search-input"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {sortedThreads.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-600">
                {sortedThreads.length} conversation{sortedThreads.length !== 1 ? "s" : ""} available
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
                data-testid="select-all-button"
              >
                {selectedThreadIds.size === sortedThreads.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading messages...</p>
            </div>
          ) : error ? (
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
            </div>
          ) : sortedThreads.length === 0 ? (
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
              <p className="text-gray-600 mb-2">
                {searchQuery
                  ? "No matching conversations found"
                  : "No unlinked messages available"}
              </p>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? "Try a different search term"
                  : "All message threads are already linked to transactions"}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sortedThreads.map(([threadId, messages]) => {
                const phoneNumber = extractPhoneFromThread(messages);
                const isSelected = selectedThreadIds.has(threadId);
                return (
                  <button
                    key={threadId}
                    onClick={() => handleToggleThread(threadId)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50"
                    }`}
                    data-testid={`thread-${threadId}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {getAvatarInitial(phoneNumber)}
                      </div>

                      {/* Thread Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {formatPhoneNumber(phoneNumber)}
                          </h4>
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex-shrink-0">
                            {messages.length} {messages.length === 1 ? "msg" : "msgs"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate mt-0.5">
                          {getPreviewText(messages)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getThreadDate(messages)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {selectedThreadIds.size > 0
              ? `${selectedThreadIds.size} conversation${selectedThreadIds.size !== 1 ? "s" : ""} selected`
              : "Select conversations to attach"}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={attaching}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all disabled:opacity-50"
              data-testid="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={handleAttach}
              disabled={selectedThreadIds.size === 0 || attaching}
              className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                selectedThreadIds.size === 0 || attaching
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-teal-600 text-white hover:from-green-600 hover:to-teal-700 shadow-md hover:shadow-lg"
              }`}
              data-testid="attach-button"
            >
              {attaching ? (
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
                  Attaching...
                </>
              ) : (
                <>
                  Attach {selectedThreadIds.size > 0 && `(${selectedThreadIds.size})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
