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
  contactName: string | null;
  messageCount: number;
  lastMessageAt: string;
}

/**
 * Normalize phone number to digits only for comparison
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Remove leading 1 for US numbers to normalize 10 and 11 digit formats
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
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
 * Get thread date range from messages
 */
function getThreadDateRange(messages: MessageLike[]): string {
  if (messages.length === 0) return "";

  const dates = messages
    .map(m => new Date(m.sent_at || m.received_at || 0).getTime())
    .filter(d => d > 0)
    .sort((a, b) => a - b);

  if (dates.length === 0) return "";

  const firstDate = new Date(dates[0]);
  const lastDate = new Date(dates[dates.length - 1]);

  const formatOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const first = firstDate.toLocaleDateString(undefined, formatOpts);
  const last = lastDate.toLocaleDateString(undefined, formatOpts);

  // If same day, just show one date
  if (first === last) {
    return first;
  }
  return `${first} - ${last}`;
}

/**
 * Get all unique participants in a thread
 * Uses chat_members (actual group membership) when available,
 * falls back to collecting from/to from individual messages
 */
function getThreadParticipants(messages: MessageLike[], selectedContact: string): string[] {
  // First, try to get chat_members from any message (they all share the same chat)
  for (const msg of messages) {
    try {
      if (msg.participants) {
        const parsed = typeof msg.participants === 'string'
          ? JSON.parse(msg.participants)
          : msg.participants;

        // If chat_members exists, use it (authoritative group membership)
        if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
          const members = new Set<string>(parsed.chat_members);
          members.delete(selectedContact);
          members.delete('me');
          // Normalize selected contact for comparison (handle +1 prefix)
          const selectedNormalized = normalizePhone(selectedContact);
          for (const m of members) {
            if (normalizePhone(m) === selectedNormalized) {
              members.delete(m);
            }
          }
          return Array.from(members);
        }
      }
    } catch {
      // Continue to next message
    }
  }

  // Fallback: collect from/to from individual messages (legacy behavior)
  const participants = new Set<string>();

  for (const msg of messages) {
    try {
      if (msg.participants) {
        const parsed = typeof msg.participants === 'string'
          ? JSON.parse(msg.participants)
          : msg.participants;

        if (parsed.from) participants.add(parsed.from);
        if (parsed.to) {
          const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
          toList.forEach((p: string) => participants.add(p));
        }
      }
    } catch {
      // Skip malformed participants
    }
  }

  // Remove the selected contact and "me" from the list
  participants.delete(selectedContact);
  participants.delete('me');

  return Array.from(participants);
}

/**
 * Check if thread is a group chat (more than 2 total participants)
 * Uses chat_members when available for accurate detection
 */
function isGroupChat(messages: MessageLike[]): boolean {
  // First check for chat_members (authoritative)
  for (const msg of messages) {
    try {
      if (msg.participants) {
        const parsed = typeof msg.participants === 'string'
          ? JSON.parse(msg.participants)
          : msg.participants;

        if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
          // Group chat = more than 1 other person (2+ members excluding "me")
          return parsed.chat_members.length > 1;
        }
      }
    } catch {
      // Continue
    }
  }

  // Fallback: count unique participants from messages
  const allParticipants = new Set<string>();

  for (const msg of messages) {
    try {
      if (msg.participants) {
        const parsed = typeof msg.participants === 'string'
          ? JSON.parse(msg.participants)
          : msg.participants;

        if (parsed.from) allParticipants.add(parsed.from);
        if (parsed.to) {
          const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
          toList.forEach((p: string) => allParticipants.add(p));
        }
      }
    } catch {
      // Skip
    }
  }

  allParticipants.delete('me');
  return allParticipants.size > 2;
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
  // All contacts for name resolution (includes contacts without unlinked messages)
  const [allContacts, setAllContacts] = useState<Array<{ phone: string; name: string }>>([]);

  // Selected contact state
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);

  // Threads state (for selected contact)
  const [threads, setThreads] = useState<Map<string, MessageLike[]>>(new Map());
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Selection state
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  // Viewing thread messages state
  const [viewingThreadId, setViewingThreadId] = useState<string | null>(null);

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
        // Load both message contacts and all contacts in parallel
        const [messageContactsResult, allContactsResult] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window.api.transactions as any).getMessageContacts(userId) as Promise<{
            success: boolean;
            contacts?: ContactInfo[];
            error?: string;
          }>,
          // Get all contacts for name resolution
          window.api.contacts.getAll(userId) as Promise<{
            success: boolean;
            contacts?: Array<{ id: string; name?: string; phone?: string }>;
            error?: string;
          }>,
        ]);

        if (messageContactsResult.success && messageContactsResult.contacts) {
          setContacts(messageContactsResult.contacts);
        } else {
          setError(messageContactsResult.error || "Failed to load contacts");
        }

        // Build phone-to-name lookup from all contacts
        if (allContactsResult.success && allContactsResult.contacts) {
          const phoneLookup: Array<{ phone: string; name: string }> = [];
          for (const c of allContactsResult.contacts) {
            if (c.name && c.phone) {
              phoneLookup.push({ phone: c.phone, name: c.name });
            }
          }
          setAllContacts(phoneLookup);
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

  // Filter contacts by search (name or phone number)
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      c.contact.toLowerCase().includes(query) ||
      formatPhoneNumber(c.contact).toLowerCase().includes(query) ||
      (c.contactName && c.contactName.toLowerCase().includes(query))
    );
  }, [contacts, searchQuery]);

  // Sort threads by recent
  const sortedThreads = useMemo(() => {
    return sortThreadsByRecent(threads);
  }, [threads]);

  // Create a phone-to-name lookup map for resolving participant names
  const phoneToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    // First add from all contacts (comprehensive list)
    for (const c of allContacts) {
      map.set(normalizePhone(c.phone), c.name);
    }
    // Then add from message contacts (may have more accurate names)
    for (const c of contacts) {
      if (c.contactName) {
        map.set(normalizePhone(c.contact), c.contactName);
      }
    }
    return map;
  }, [contacts, allContacts]);

  // Resolve phone number to name if available
  const resolveParticipantName = (phone: string): string => {
    const normalized = normalizePhone(phone);
    const name = phoneToNameMap.get(normalized);
    return name || formatPhoneNumber(phone);
  };

  const handleSelectContact = (contact: string, contactName: string | null) => {
    setSelectedContact(contact);
    setSelectedContactName(contactName);
    setSelectedThreadIds(new Set());
  };

  const handleBackToContacts = () => {
    setView("contacts");
    setSelectedContact(null);
    setSelectedContactName(null);
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
                {view === "contacts"
                  ? "Select Contact"
                  : selectedContactName || formatPhoneNumber(selectedContact || "")}
              </h3>
              <p className="text-green-100 text-sm">
                {propertyAddress
                  ? `Link chats to ${propertyAddress}`
                  : view === "contacts"
                  ? "Choose a contact to view their chats"
                  : "Select chats to attach to this transaction"}
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
                placeholder="Search by name or phone number..."
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
              {sortedThreads.length} chat{sortedThreads.length !== 1 ? "s" : ""} found
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
                {loadingContacts ? "Loading contacts..." : "Loading chats..."}
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
                      onClick={() => handleSelectContact(contact.contact, contact.contactName)}
                      className="text-left p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 transition-all"
                      data-testid={`contact-${contact.contact}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          {contact.contactName ? contact.contactName.charAt(0).toUpperCase() : "#"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {contact.contactName || formatPhoneNumber(contact.contact)}
                            </h4>
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex-shrink-0">
                              {contact.messageCount} {contact.messageCount === 1 ? "msg" : "msgs"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {contact.contactName && (
                              <span className="mr-2">{formatPhoneNumber(contact.contact)}</span>
                            )}
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
                  <p className="text-gray-600 mb-2">No chats found with this contact</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedThreads.map(([threadId, messages]) => {
                    const isSelected = selectedThreadIds.has(threadId);
                    const isGroup = isGroupChat(messages);
                    const otherParticipants = getThreadParticipants(messages, selectedContact || "");
                    const dateRange = getThreadDateRange(messages);

                    return (
                      <div
                        key={threadId}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleToggleThread(threadId)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggleThread(threadId); } }}
                        className={`text-left p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50"
                        }`}
                        data-testid={`thread-${threadId}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                              isSelected ? "bg-green-500 border-green-500" : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          {/* Chat Icon */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isGroup ? "bg-purple-100" : "bg-blue-100"
                          }`}>
                            {isGroup ? (
                              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            )}
                          </div>

                          {/* Thread Info */}
                          <div className="flex-1 min-w-0">
                            {/* Thread title - participants */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-gray-900">
                                {isGroup ? "Group Chat" : `Chat with ${selectedContactName || formatPhoneNumber(selectedContact || "")}`}
                              </h4>
                              {isGroup && (
                                <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                  {otherParticipants.length + 1} people
                                </span>
                              )}
                            </div>

                            {/* Other participants in group */}
                            {isGroup && otherParticipants.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Also includes: {otherParticipants.slice(0, 3).map(p => resolveParticipantName(p)).join(", ")}
                                {otherParticipants.length > 3 && ` +${otherParticipants.length - 3} more`}
                              </p>
                            )}

                            {/* Metadata row */}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-gray-500">{dateRange}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">
                                {messages.length} {messages.length === 1 ? "message" : "messages"}
                              </span>
                            </div>
                          </div>

                          {/* View button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingThreadId(threadId);
                            }}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-all flex-shrink-0"
                            data-testid={`view-thread-${threadId}`}
                          >
                            View
                          </button>
                        </div>
                      </div>
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
              ? "Select a contact to view their chats"
              : selectedThreadIds.size > 0
              ? `${selectedThreadIds.size} chat${selectedThreadIds.size !== 1 ? "s" : ""} selected`
              : "Select chats to attach"}
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

      {/* Message Viewer Panel */}
      {viewingThreadId && threads.get(viewingThreadId) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
          <div className="bg-gray-100 w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Phone-style header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setViewingThreadId(null)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1">
                <h4 className="text-white font-semibold">
                  {selectedContactName || formatPhoneNumber(selectedContact || "")}
                </h4>
                <p className="text-blue-100 text-xs">
                  {threads.get(viewingThreadId)?.length || 0} messages
                </p>
              </div>
            </div>

            {/* Messages list - phone style */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {threads.get(viewingThreadId)
                ?.sort((a, b) => new Date(a.sent_at || 0).getTime() - new Date(b.sent_at || 0).getTime())
                .map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  const msgText = msg.body_text || ("body" in msg ? (msg as { body?: string }).body : "") || "";
                  const msgTime = new Date(msg.sent_at || msg.received_at || 0);

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isOutbound
                            ? "bg-blue-500 text-white rounded-br-md"
                            : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msgText || "(No content)"}</p>
                        <p className={`text-xs mt-1 ${isOutbound ? "text-blue-100" : "text-gray-400"}`}>
                          {msgTime.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="bg-white border-t px-4 py-3 flex justify-center">
              <button
                onClick={() => setViewingThreadId(null)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm font-medium text-gray-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
