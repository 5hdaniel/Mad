/**
 * AttachEmailsModal Component
 * Modal for browsing and attaching unlinked emails to a transaction
 */
import React, { useState, useEffect, useMemo } from "react";

interface AttachEmailsModalProps {
  /** User ID to fetch unlinked emails for */
  userId: string;
  /** Transaction ID to attach emails to */
  transactionId: string;
  /** Optional property address for display */
  propertyAddress?: string;
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
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown date";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format sender for display - extract name or email
 */
function formatSender(sender: string | null): string {
  if (!sender) return "Unknown sender";
  // Try to extract name from "Name <email>" format
  const match = sender.match(/^([^<]+)\s*</);
  if (match) {
    return match[1].trim();
  }
  return sender;
}

export function AttachEmailsModal({
  userId,
  transactionId,
  propertyAddress,
  onClose,
  onAttached,
}: AttachEmailsModalProps): React.ReactElement {
  // Emails list state
  const [emails, setEmails] = useState<EmailInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [attaching, setAttaching] = useState(false);

  // Load unlinked emails on mount
  useEffect(() => {
    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      async function loadEmails() {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (window.api.transactions as any).getUnlinkedEmails(userId) as {
            success: boolean;
            emails?: EmailInfo[];
            error?: string;
          };

          if (result.success && result.emails) {
            setEmails(result.emails);
          } else {
            setError(result.error || "Failed to load emails");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load emails");
        } finally {
          setLoading(false);
        }
      }
      loadEmails();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [userId]);

  // Filter emails by search (subject or sender)
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const query = searchQuery.toLowerCase();
    return emails.filter((email) =>
      (email.subject && email.subject.toLowerCase().includes(query)) ||
      (email.sender && email.sender.toLowerCase().includes(query))
    );
  }, [emails, searchQuery]);

  const handleToggleEmail = (emailId: string) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedEmailIds.size === filteredEmails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(filteredEmails.map((e) => e.id)));
    }
  };

  const handleAttach = async () => {
    if (selectedEmailIds.size === 0) return;

    setAttaching(true);
    setError(null);
    try {
      const emailIds = Array.from(selectedEmailIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window.api.transactions as any).linkEmails(
        emailIds,
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

        {/* Search Bar */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by subject or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          {!loading && filteredEmails.length > 0 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-gray-600">
                {filteredEmails.length} unlinked email{filteredEmails.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                data-testid="select-all-button"
              >
                {selectedEmailIds.size === filteredEmails.length ? "Deselect All" : "Select All"}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Loading */}
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
          {!loading && !error && filteredEmails.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-600 mb-2">
                {searchQuery ? "No matching emails found" : "No unlinked emails available"}
              </p>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? "Try a different search term"
                  : "All emails are already linked to transactions"}
              </p>
            </div>
          )}

          {/* Email list */}
          {!loading && !error && filteredEmails.length > 0 && (
            <div className="space-y-2">
              {filteredEmails.map((email) => {
                const isSelected = selectedEmailIds.has(email.id);
                return (
                  <div
                    key={email.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleEmail(email.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleEmail(email.id);
                      }
                    }}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                    }`}
                    data-testid={`email-${email.id}`}
                  >
                    <div className="flex items-start gap-3">
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

                      {/* Email Icon */}
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>

                      {/* Email Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {email.subject || "(No Subject)"}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          From: {formatSender(email.sender)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(email.sent_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {selectedEmailIds.size > 0
              ? `${selectedEmailIds.size} email${selectedEmailIds.size !== 1 ? "s" : ""} selected`
              : "Select emails to attach"}
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
              disabled={selectedEmailIds.size === 0 || attaching}
              className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                selectedEmailIds.size === 0 || attaching
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
                <>Attach {selectedEmailIds.size > 0 && `(${selectedEmailIds.size})`}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
