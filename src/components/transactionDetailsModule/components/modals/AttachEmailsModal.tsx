/**
 * AttachEmailsModal Component
 * Modal for browsing and attaching unlinked emails to a transaction.
 * BACKLOG-504: Now displays emails grouped by thread for consistency with the Emails tab.
 * TASK-1993: Server-side search with debounce, date filter, and provider-level load more.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  processEmailThreads,
} from "../EmailThreadCard";
import type { EmailThread } from "../EmailThreadCard";
import { EmailThreadViewModal } from "./EmailThreadViewModal";
import type { Communication } from "../../types";
import { useAuth } from "../../../../contexts";

interface AttachEmailsModalProps {
  /** User ID to fetch unlinked emails for */
  userId: string;
  /** Transaction ID to attach emails to */
  transactionId: string;
  /** Optional property address for display */
  propertyAddress?: string;
  /** Audit period start date (ISO string) for date filtering */
  auditStartDate?: string;
  /** Audit period end date (ISO string) for date filtering */
  auditEndDate?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when emails are successfully attached */
  onAttached: () => void;
}

interface EmailInfo {
  id: string;
  subject: string | null;
  sender: string | null;
  sent_at: string | null;
  body_preview?: string | null;
  email_thread_id?: string | null;
  has_attachments?: boolean;
}

/**
 * Format date range for display (used for threads)
 */
function formatDateRange(startDate: Date, endDate: Date): string {
  const formatDateObj = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDateObj(startDate);
  }
  return `${formatDateObj(startDate)} - ${formatDateObj(endDate)}`;
}

/**
 * Filter out the logged-in user's email from a participant list.
 */
function filterSelfFromParticipants(participants: string[], userEmail?: string): string[] {
  if (!userEmail) return participants;
  const normalizedUser = userEmail.toLowerCase().trim();
  return participants.filter(p => {
    const match = p.match(/<([^>]+)>/);
    const email = match ? match[1].toLowerCase() : p.toLowerCase().trim();
    return email !== normalizedUser;
  });
}

/**
 * Format participant list for display (show first few, then "+X more")
 */
function formatParticipants(participants: string[], maxShow: number = 2): string {
  if (participants.length === 0) return "Unknown";

  // Extract names from email addresses where possible
  const names = participants.map(p => {
    // Try "Name <email>" format first
    const nameMatch = p.match(/^([^<]+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name && name !== p) return name;
    }
    // Extract email prefix and capitalize (e.g. "madison.delvigo" → "Madison Delvigo")
    const atIndex = p.indexOf("@");
    const prefix = atIndex > 0 ? p.substring(0, atIndex) : p;
    return prefix
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  });

  // Deduplicate
  const unique = [...new Set(names)];

  if (unique.length <= maxShow) {
    return unique.join(", ");
  }
  return `${unique.slice(0, maxShow).join(", ")} +${unique.length - maxShow}`;
}

/**
 * Get initials for avatar display from sender name/email.
 */
function getAvatarInitial(sender?: string | null): string {
  if (!sender) return "?";

  // Try to get name from email format "Name <email@example.com>"
  const nameMatch = sender.match(/^([^<]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name !== sender) {
      return name.charAt(0).toUpperCase();
    }
  }

  // Extract first character from email before @
  const atIndex = sender.indexOf("@");
  if (atIndex > 0) {
    return sender.charAt(0).toUpperCase();
  }

  return sender.charAt(0).toUpperCase();
}

/**
 * Convert EmailInfo to Communication format for thread processing.
 * Preserves body_preview for display in thread cards.
 */
function emailInfoToCommunication(email: EmailInfo): Communication & { body_preview?: string | null } {
  return {
    id: email.id,
    subject: email.subject || undefined,
    sender: email.sender || undefined,
    sent_at: email.sent_at || undefined,
    communication_type: "email",
    email_thread_id: email.email_thread_id || undefined,
    body_preview: email.body_preview,
    // Map body_preview to body_text so EmailThreadViewModal can display content
    body_text: email.body_preview || undefined,
    has_attachments: email.has_attachments || false,
  } as Communication & { body_preview?: string | null };
}

// Pagination constants to prevent UI freeze from rendering too many items
const THREADS_PER_PAGE = 25;
const MAX_THREADS = 200;
const DEFAULT_MAX_RESULTS = 100;
const LOAD_MORE_INCREMENT = 100;

export function AttachEmailsModal({
  userId,
  transactionId,
  propertyAddress,
  auditStartDate,
  auditEndDate,
  onClose,
  onAttached,
}: AttachEmailsModalProps): React.ReactElement {
  const { currentUser } = useAuth();

  // Emails list state (raw from API)
  const [emails, setEmails] = useState<EmailInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state - tracks selected THREAD IDs
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  // View thread state
  const [viewingThread, setViewingThread] = useState<EmailThread | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [attaching, setAttaching] = useState(false);

  // Date filter state - pre-populate from audit period if available
  const [afterDate, setAfterDate] = useState(
    auditStartDate ? auditStartDate.split("T")[0] : ""
  );
  const [beforeDate, setBeforeDate] = useState(
    auditEndDate ? auditEndDate.split("T")[0] : ""
  );

  // Pagination state
  const [displayCount, setDisplayCount] = useState(THREADS_PER_PAGE);
  const [hasMoreFromProvider, setHasMoreFromProvider] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Track whether this is the initial load (for showing full-screen spinner vs inline)
  const isInitialLoad = useRef(true);

  // Infinite scroll sentinel ref
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search query (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch emails from provider (server-side search)
  const fetchEmails = useCallback(async (
    query: string,
    after: string,
    before: string,
    maxResults: number,
    isLoadMore: boolean = false,
    skip: number = 0,
  ) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else if (isInitialLoad.current) {
      setLoading(true);
    } else {
      setSearching(true);
    }
    setError(null);

    try {
      const options: {
        query?: string;
        after?: string;
        before?: string;
        maxResults?: number;
        skip?: number;
        transactionId?: string;
      } = { maxResults };

      if (query) options.query = query;
      if (after) options.after = new Date(after).toISOString();
      if (before) options.before = new Date(before).toISOString();
      if (skip > 0) options.skip = skip;
      options.transactionId = transactionId;

      const result = await window.api.transactions.getUnlinkedEmails(
        userId,
        options,
      );

      if (result.success && result.emails) {
        if (isLoadMore) {
          // BACKLOG-711: Append new emails to existing list
          setEmails(prev => [...prev, ...result.emails!]);
          // Show more threads to make newly appended emails visible
          setDisplayCount(prev => prev + THREADS_PER_PAGE);
        } else {
          setEmails(result.emails);
        }
        // If fewer results returned than requested, provider has no more
        setHasMoreFromProvider(result.emails.length >= maxResults);
      } else {
        setError(result.error || "Failed to load emails");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
      setSearching(false);
      setLoadingMore(false);
      isInitialLoad.current = false;
    }
  }, [userId]);

  // Fetch on mount and when search/filter params change
  useEffect(() => {
    // Reset to default maxResults and pagination when search params change
    setDisplayCount(THREADS_PER_PAGE);
    setHasMoreFromProvider(true);
    fetchEmails(debouncedQuery, afterDate, beforeDate, DEFAULT_MAX_RESULTS);
  }, [debouncedQuery, afterDate, beforeDate, fetchEmails]);

  // Convert emails to threads using the same logic as TransactionEmailsTab
  const emailThreads = useMemo(() => {
    const communications = emails.map(emailInfoToCommunication);
    return processEmailThreads(communications);
  }, [emails]);

  // Paginated threads - only render displayCount items to prevent UI freeze
  const displayedThreads = useMemo(() => {
    return emailThreads.slice(0, displayCount);
  }, [emailThreads, displayCount]);

  // Check if there are more threads to display locally or from provider
  const hasMoreLocal = displayCount < emailThreads.length;
  const hasMoreThreads = hasMoreLocal || hasMoreFromProvider;

  // Calculate total selected email count
  const selectedEmailCount = useMemo(() => {
    let count = 0;
    emailThreads.forEach(thread => {
      if (selectedThreadIds.has(thread.id)) {
        count += thread.emails.length;
      }
    });
    return count;
  }, [emailThreads, selectedThreadIds]);

  // Get all selected email IDs (for the API call)
  const selectedEmailIds = useMemo(() => {
    const ids: string[] = [];
    emailThreads.forEach(thread => {
      if (selectedThreadIds.has(thread.id)) {
        thread.emails.forEach(email => ids.push(email.id));
      }
    });
    return ids;
  }, [emailThreads, selectedThreadIds]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreLocal) {
      // Show more of the already-fetched results
      setDisplayCount((prev) => Math.min(prev + THREADS_PER_PAGE, MAX_THREADS));
    } else if (hasMoreFromProvider) {
      // BACKLOG-711: Use skip-based pagination — only fetch the NEXT batch, not everything again
      fetchEmails(debouncedQuery, afterDate, beforeDate, LOAD_MORE_INCREMENT, true, emails.length);
    }
  }, [hasMoreLocal, hasMoreFromProvider, emails.length, debouncedQuery, afterDate, beforeDate, fetchEmails]);

  // Infinite scroll: trigger handleLoadMore when sentinel enters viewport
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, loadingMore, loading]);

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
    if (selectedThreadIds.size === emailThreads.length) {
      setSelectedThreadIds(new Set());
    } else {
      setSelectedThreadIds(new Set(emailThreads.map((t) => t.id)));
    }
  };

  const handleAttach = async () => {
    if (selectedEmailIds.length === 0) return;

    setAttaching(true);
    setError(null);
    try {
      const result = await window.api.transactions.linkEmails(
        selectedEmailIds,
        transactionId
      );

      if (result.success) {
        onAttached();
        onClose();
      } else {
        setError(result.error || "Failed to attach emails");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach emails");
    } finally {
      setAttaching(false);
    }
  };

  const isSearchActive = debouncedQuery || afterDate || beforeDate;

  return (
    <>
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4"
      data-testid="attach-emails-modal"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-white">Attach Emails</h3>
            <p className="text-blue-100 text-sm">
              {propertyAddress
                ? `Select emails to link to ${propertyAddress}`
                : "Select emails to attach to this transaction"}
            </p>
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

        {/* Search Bar + Date Filter */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, email, subject, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="search-input"
            />
            {/* Search icon or loading spinner */}
            {searching ? (
              <div
                className="w-5 h-5 absolute left-3 top-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
                data-testid="search-spinner"
              />
            ) : (
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-3 mt-3" data-testid="date-filter">
            <label className="text-sm text-gray-600 whitespace-nowrap">Date range:</label>
            <input
              type="date"
              value={afterDate}
              onChange={(e) => setAfterDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              data-testid="after-date-input"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={beforeDate}
              onChange={(e) => setBeforeDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              data-testid="before-date-input"
            />
            {(auditStartDate || auditEndDate) && (
              <button
                onClick={() => {
                  setAfterDate(auditStartDate ? auditStartDate.split("T")[0] : "");
                  setBeforeDate(auditEndDate ? auditEndDate.split("T")[0] : "");
                }}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                data-testid="audit-period-button"
              >
                Audit Period
              </button>
            )}
          </div>

          {!loading && emailThreads.length > 0 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">
                {emailThreads.length} conversation{emailThreads.length !== 1 ? "s" : ""}
                {emails.length !== emailThreads.length && (
                  <span className="ml-1">({emails.length} emails total)</span>
                )}
              </p>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                data-testid="select-all-button"
              >
                {selectedThreadIds.size === emailThreads.length ? "Deselect All" : "Select All"}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Initial Loading */}
          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading emails...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 mb-2">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && emailThreads.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 mb-2">
                {isSearchActive ? "No emails matching your search" : "No unlinked emails available"}
              </p>
              <p className="text-sm text-gray-500">
                {isSearchActive
                  ? "Try different search terms or adjust the date range"
                  : "All emails are already linked to transactions"}
              </p>
            </div>
          )}

          {/* Thread list - using displayedThreads (paginated) to prevent UI freeze */}
          {!loading && !error && emailThreads.length > 0 && (
            <div className="space-y-3">
              {displayedThreads.map((thread) => {
                const isSelected = selectedThreadIds.has(thread.id);
                const firstEmail = thread.emails[0];
                const isMultipleEmails = thread.emailCount > 1;
                const threadHasAttachments = thread.emails.some(e => e.has_attachments);
                // Filter out the user's own email from participants
                const otherParticipants = filterSelfFromParticipants(thread.participants, currentUser?.email);
                // Avatar: use first non-user participant, otherwise fallback to sender
                const avatarInitial = otherParticipants.length > 0
                  ? getAvatarInitial(otherParticipants[0])
                  : getAvatarInitial(firstEmail?.sender);
                // Get body preview from the most recent email in the thread
                const lastEmail = thread.emails[thread.emails.length - 1];
                // TASK-1998: body preview from most recent email, fall back to first, then subject
                const bodyPreview = (lastEmail as Communication & { body_preview?: string | null })?.body_preview
                  || (firstEmail as Communication & { body_preview?: string | null })?.body_preview
                  || null;

                return (
                  <div
                    key={thread.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleThread(thread.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleThread(thread.id);
                      }
                    }}
                    className={`rounded-lg border-2 transition-all cursor-pointer overflow-hidden ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                    data-testid={`thread-${thread.id}`}
                  >
                    {/* Thread card layout matching EmailThreadCard style */}
                    <div className="px-4 py-3 flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Avatar - Blue for email */}
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {avatarInitial}
                        </div>

                        {/* Thread info: Subject, participants, and preview */}
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-gray-900 block truncate">
                            {thread.subject || "(No Subject)"}
                          </span>
                          <span className="font-normal text-gray-500 text-sm block truncate">
                            {formatParticipants(otherParticipants)}
                            {isMultipleEmails && (
                              <span className="ml-2 text-gray-400">
                                ({thread.emailCount} emails)
                              </span>
                            )}
                          </span>
                          {bodyPreview && (
                            <span className="text-xs text-gray-400 block truncate mt-0.5">
                              {bodyPreview.length > 120 ? bodyPreview.substring(0, 120) + "..." : bodyPreview}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attachment icon, date range, and View button */}
                      <div className="flex items-center gap-4 flex-shrink-0 mt-0.5">
                        {threadHasAttachments && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        )}
                        <span className="text-sm text-gray-500 hidden sm:inline">
                          {formatDateRange(thread.startDate, thread.endDate)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingThread(thread);
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
                          data-testid="view-thread-button"
                        >
                          {isMultipleEmails ? "View Thread \u2192" : "View"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Infinite scroll sentinel */}
              {hasMoreThreads && (
                <div
                  ref={scrollSentinelRef}
                  className="text-center py-4"
                  data-testid="scroll-sentinel"
                >
                  {loadingMore && (
                    <span className="flex items-center gap-2 justify-center text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      Loading more...
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {selectedThreadIds.size > 0
              ? `${selectedThreadIds.size} conversation${selectedThreadIds.size !== 1 ? "s" : ""} selected (${selectedEmailCount} email${selectedEmailCount !== 1 ? "s" : ""})`
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
              disabled={selectedEmailIds.length === 0 || attaching}
              className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                selectedEmailIds.length === 0 || attaching
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg"
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
                <>Attach {selectedEmailCount > 0 && `(${selectedEmailCount} email${selectedEmailCount !== 1 ? "s" : ""})`}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Thread view modal */}
    {viewingThread && (
      <EmailThreadViewModal
        thread={viewingThread}
        onClose={() => setViewingThread(null)}
        userEmail={currentUser?.email}
      />
    )}
    </>
  );
}
