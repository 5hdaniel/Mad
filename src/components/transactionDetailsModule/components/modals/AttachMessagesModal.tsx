/**
 * AttachMessagesModal Component
 * Modal for browsing and attaching unlinked message threads to a transaction
 * Uses a contact-first approach for better performance with large message databases
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  groupMessagesByThread,
  sortThreadsByRecent,
  type MessageLike,
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

interface ContactInfo {
  contact: string;
  messageCount: number;
  lastMessageAt: string;
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get preview text from the most recent message
 */
function getPreviewText(messages: MessageLike[]): string {
  const lastMsg = messages[messages.length - 1];
  const text = lastMsg?.body_text || ("body" in lastMsg ? lastMsg.body : "") || "";
  if (text.length > 80) {
    return text.substring(0, 80) + "...";
  }
  return text || "(No message content)";
}

/**
 * Get thread date from messages
 */
function getThreadDate(messages: MessageLike[]): string {
  const lastMsg = messages[messages.length - 1];
  const date = new Date(lastMsg?.sent_at || lastMsg?.received_at || 0);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AttachMessagesModal({
  userId,
  transactionId,
  propertyAddress,
  onClose,
  onAttached,
}: AttachMessagesModalProps): React.ReactElement {
  // View state: "contacts" or "threads"
  const [view, setView] = useState<"contacts" | "threads">("contacts");

  // Contacts list state
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  // Selected contact state
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  // Threads state (for selected contact)
  const [threads, setThreads] = useState<Map<string, MessageLike[]>>(new Map());
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Selection state
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Load contacts on mount
  useEffect(() => {
    async function loadContacts() {
      setLoadingContacts(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window.api.transactions as any).getMessageContacts(userId) as {
          success: boolean;
          contacts?: ContactInfo[];
          error?: string;
        };
        if (result.success && result.contacts) {
          setContacts(result.contacts);
        } else {
          setError(result.error || "Failed to load contacts");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contacts");
      } finally {
        setLoadingContacts(false);
      }
    }
    loadContacts();
  }, [userId]);

  // Load threads when contact is selected
  useEffect(() => {
    if (!selectedContact) return;

    async function loadContactMessages() {
      setLoadingThreads(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window.api.transactions as any).getMessagesByContact(userId, selectedContact) as {
          success: boolean;
          messages?: MessageLike[];
          error?: string;
        };
        if (result.success && result.messages) {
          const grouped = groupMessagesByThread(result.messages);
          setThreads(grouped);
          setView("threads");
        } else {
          setError(result.error || "Failed to load messages");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setLoadingThreads(false);
      }
    }
    loadContactMessages();
  }, [userId, selectedContact]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      c.contact.toLowerCase().includes(query) ||
      formatPhoneNumber(c.contact).toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Sort threads by recent
  const sortedThreads = useMemo(() => {
    return sortThreadsByRecent(threads);
  }, [threads]);

  const handleSelectContact = (contact: string) => {
    setSelectedContact(contact);
    setSelectedThreadIds(new Set());
  };

  const handleBackToContacts = () => {
    setView("contacts");
    setSelectedContact(null);
    setThreads(new Map());
    setSelectedThreadIds(new Set());
  };

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
      setSelectedThreadIds(new Set());
    } else {
      setSelectedThreadIds(new Set(sortedThreads.map(([id]) => id)));
    }
  };

  const handleAttach = async () => {
    if (selectedThreadIds.size === 0) return;

    setAttaching(true);
    setError(null);
    try {
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
          <div className="flex items-center gap-3">
            {view === "threads" && (
              <button
                onClick={handleBackToContacts}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
                data-testid="back-button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h3 className="text-lg font-bold text-white">
                {view === "contacts" ? "Select Contact" : formatPhoneNumber(selectedContact || "")}
              </h3>
              <p className="text-green-100 text-sm">
                {propertyAddress
                  ? `Link messages to ${propertyAddress}`
                  : view === "contacts"
                  ? "Choose a contact to view their messages"
                  : "Select threads to attach"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            data-testid="close-modal-button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar (contacts view only) */}
        {view === "contacts" && (
          <div className="flex-shrink-0 p-4 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by phone number..."
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {filteredContacts.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""} with unlinked messages
              </p>
            )}
          </div>
        )}

        {/* Threads view controls */}
        {view === "threads" && sortedThreads.length > 0 && (
          <div className="flex-shrink-0 p-4 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {sortedThreads.length} thread{sortedThreads.length !== 1 ? "s" : ""} available
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
              data-testid="select-all-button"
            >
              {selectedThreadIds.size === sortedThreads.length ? "Deselect All" : "Select All"}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Loading */}
          {(loadingContacts || loadingThreads) && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-4">
                {loadingContacts ? "Loading contacts..." : "Loading messages..."}
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loadingContacts && !loadingThreads && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 mb-2">{error}</p>
            </div>
          )}

          {/* Contacts List */}
          {view === "contacts" && !loadingContacts && !error && (
            <>
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-600 mb-2">
                    {searchQuery ? "No matching contacts found" : "No contacts with unlinked messages"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredContacts.map((contact) => (
                    <button
                      key={contact.contact}
                      onClick={() => handleSelectContact(contact.contact)}
                      className="text-left p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 transition-all"
                      data-testid={`contact-${contact.contact}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          #
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {formatPhoneNumber(contact.contact)}
                            </h4>
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex-shrink-0">
                              {contact.messageCount} {contact.messageCount === 1 ? "msg" : "msgs"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Last message: {formatDate(contact.lastMessageAt)}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Threads List */}
          {view === "threads" && !loadingThreads && !error && (
            <>
              {sortedThreads.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-gray-600 mb-2">No message threads found</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedThreads.map(([threadId, messages]) => {
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
                              isSelected ? "bg-green-500 border-green-500" : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          {/* Thread Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                {messages.length} {messages.length === 1 ? "message" : "messages"}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 truncate mt-1">
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {view === "contacts"
              ? "Select a contact to view messages"
              : selectedThreadIds.size > 0
              ? `${selectedThreadIds.size} thread${selectedThreadIds.size !== 1 ? "s" : ""} selected`
              : "Select threads to attach"}
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
            {view === "threads" && (
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
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Attaching...
                  </>
                ) : (
                  <>Attach {selectedThreadIds.size > 0 && `(${selectedThreadIds.size})`}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
