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
import type { Communication } from "../../types";

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
 * Format participant list for display (show first few, then "+X more")
 */
function formatParticipants(participants: string[], maxShow: number = 2): string {
  if (participants.length === 0) return "Unknown";

  // Extract names from email addresses where possible
  const names = participants.map(p => {
    const nameMatch = p.match(/^([^<]+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name && name !== p) return name;
    }
    // Return email part before @
    const atIndex = p.indexOf("@");
    return atIndex > 0 ? p.substring(0, atIndex) : p;
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
  // Emails list state (raw from API)
  const [emails, setEmails] = useState<EmailInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state - tracks selected THREAD IDs
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

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
  // TODO: cursor-based pagination for efficiency -- currently re-fetches all with higher maxResults
  const [fetchedMaxResults, setFetchedMaxResults] = useState(DEFAULT_MAX_RESULTS);
  const [hasMoreFromProvider, setHasMoreFromProvider] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Track whether this is the initial load (for showing full-screen spinner vs inline)
  const isInitialLoad = useRef(true);

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
      } = { maxResults };

      if (query) options.query = query;
      if (after) options.after = new Date(after).toISOString();
      if (before) options.before = new Date(before).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window.api.transactions as any).getUnlinkedEmails(
        userId,
        options,
      ) as {
        success: boolean;
        emails?: EmailInfo[];
        error?: string;
      };

      if (result.success && result.emails) {
        setEmails(result.emails);
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
    setFetchedMaxResults(DEFAULT_MAX_RESULTS);
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
      // All local results are displayed, fetch more from provider
      const newMaxResults = fetchedMaxResults + LOAD_MORE_INCREMENT;
      setFetchedMaxResults(newMaxResults);
      fetchEmails(debouncedQuery, afterDate, beforeDate, newMaxResults, true);
    }
  }, [hasMoreLocal, hasMoreFromProvider, fetchedMaxResults, debouncedQuery, afterDate, beforeDate, fetchEmails]);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window.api.transactions as any).linkEmails(
        selectedEmailIds,
        transactionId
      ) as { success: boolean; error?: string };

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
              placeholder="Search emails..."
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
                const avatarInitial = getAvatarInitial(firstEmail?.sender);
                const isMultipleEmails = thread.emailCount > 1;
                // Get body preview from the most recent email in the thread
                const lastEmail = thread.emails[thread.emails.length - 1];
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
                            {formatParticipants(thread.participants)}
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

                      {/* Date range */}
                      <div className="flex items-center gap-4 flex-shrink-0 mt-0.5">
                        <span className="text-sm text-gray-500 hidden sm:inline">
                          {formatDateRange(thread.startDate, thread.endDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load More button */}
              {hasMoreThreads && (
                <div className="text-center pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-all disabled:opacity-50"
                    data-testid="load-more-button"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2 justify-center">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        Loading more...
                      </span>
                    ) : hasMoreLocal ? (
                      `Load More (${emailThreads.length - displayCount} remaining)`
                    ) : (
                      "Load More from Provider"
                    )}
                  </button>
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
  );
}
