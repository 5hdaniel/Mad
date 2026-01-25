/**
 * EmailThreadViewModal Component
 * TASK-1183: Modal for viewing all emails in a conversation thread.
 * Displays emails chronologically in a conversation-style layout.
 */
import React, { useState, useCallback, useMemo } from "react";
import DOMPurify from "dompurify";
import type { Communication } from "../../types";
import type { EmailThread } from "../EmailThreadCard";

interface EmailThreadViewModalProps {
  /** The email thread to display */
  thread: EmailThread;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional callback when an email is clicked for full view */
  onViewEmail?: (email: Communication) => void;
}

type ViewMode = "html" | "plain";

/**
 * Sanitize HTML content to prevent XSS attacks
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "div", "span", "a", "b", "i", "strong", "em", "u",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "td", "th",
      "img", "blockquote", "pre", "code", "hr",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "class", "style", "width", "height"],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/**
 * Get the best available content for display
 */
function getEmailContent(email: Communication): {
  html: string | null;
  plain: string | null;
} {
  const html = email.body_html || email.body || null;
  const plain = email.body_text || email.body_plain || null;
  return { html, plain };
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Extract sender name from email address
 */
function extractSenderName(sender: string | undefined): string {
  if (!sender) return "Unknown";

  // Format: "Name <email@example.com>" or just "email@example.com"
  const nameMatch = sender.match(/^([^<]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name !== sender) return name;
  }

  // Return email part before @
  const atIndex = sender.indexOf("@");
  return atIndex > 0 ? sender.substring(0, atIndex) : sender;
}

/**
 * Get initials for avatar
 */
function getAvatarInitial(sender?: string): string {
  if (!sender) return "?";

  const nameMatch = sender.match(/^([^<]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name !== sender) {
      return name.charAt(0).toUpperCase();
    }
  }

  const atIndex = sender.indexOf("@");
  if (atIndex > 0) {
    return sender.charAt(0).toUpperCase();
  }

  return sender.charAt(0).toUpperCase();
}

/**
 * Individual email item in the thread view
 */
function EmailItem({
  email,
  isExpanded,
  onToggle,
  onViewFull,
  viewMode,
}: {
  email: Communication;
  isExpanded: boolean;
  onToggle: () => void;
  onViewFull?: () => void;
  viewMode: ViewMode;
}): React.ReactElement {
  const { html, plain } = useMemo(() => getEmailContent(email), [email]);
  const hasHtml = Boolean(html);
  const hasPlain = Boolean(plain);
  const hasContent = hasHtml || hasPlain;

  const sanitizedHtml = useMemo(() => {
    if (html) return sanitizeHtml(html);
    return "";
  }, [html]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor) {
        e.preventDefault();
        const href = anchor.getAttribute("href");
        if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
          if (window.api?.shell?.openExternal) {
            window.api.shell.openExternal(href);
          } else {
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }
      }
    },
    []
  );

  const emailDate = new Date(email.sent_at || email.received_at || 0);
  const senderName = extractSenderName(email.sender);
  const avatarInitial = getAvatarInitial(email.sender);

  // Generate a consistent color based on sender for visual distinction
  const senderHash = (email.sender || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorIndex = senderHash % 5;
  const avatarColors = [
    "from-blue-500 to-indigo-600",
    "from-green-500 to-teal-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
  ];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Email header - always visible */}
      <div
        className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={`w-10 h-10 bg-gradient-to-br ${avatarColors[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}
          >
            {avatarInitial}
          </div>

          {/* Email meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 truncate">
                {senderName}
              </span>
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {formatDate(emailDate)}
              </span>
            </div>
            <div className="text-sm text-gray-600 truncate">
              {email.sender || "Unknown sender"}
            </div>
            {email.recipients && (
              <div className="text-xs text-gray-500 mt-1">
                To: {email.recipients}
              </div>
            )}
          </div>

          {/* Expand/collapse icon */}
          <svg
            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Email body - expanded */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="p-4">
            {hasContent ? (
              viewMode === "html" && hasHtml ? (
                <div
                  className="prose prose-sm max-w-none email-content"
                  onClick={handleContentClick}
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {plain}
                </pre>
              )
            ) : (
              <p className="text-gray-500 italic text-center py-4">
                No email content available
              </p>
            )}
          </div>

          {/* View full email button */}
          {onViewFull && (
            <div className="px-4 pb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFull();
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Full Email &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailThreadViewModal({
  thread,
  onClose,
  onViewEmail,
}: EmailThreadViewModalProps): React.ReactElement {
  // Track which emails are expanded (default: first and last, or all if <= 3)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    if (thread.emails.length <= 3) {
      // Expand all if small thread
      thread.emails.forEach(e => ids.add(e.id));
    } else {
      // Expand first and last
      if (thread.emails[0]) ids.add(thread.emails[0].id);
      if (thread.emails[thread.emails.length - 1]) {
        ids.add(thread.emails[thread.emails.length - 1].id);
      }
    }
    return ids;
  });

  // View mode for content display
  const [viewMode, setViewMode] = useState<ViewMode>("html");

  const toggleEmail = useCallback((emailId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(thread.emails.map(e => e.id)));
  }, [thread.emails]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const allExpanded = expandedIds.size === thread.emails.length;
  // Note: allCollapsed could be used for future UI indication if needed
  const _allCollapsed = expandedIds.size === 0;

  // Check if any email has HTML content for the toggle
  const hasAnyHtml = thread.emails.some(e => e.body_html || e.body);
  const hasAnyPlain = thread.emails.some(e => e.body_text || e.body_plain);
  const showViewToggle = hasAnyHtml && hasAnyPlain;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[80] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-bold text-white truncate">
                {thread.subject || "(No Subject)"}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {thread.emailCount} email{thread.emailCount !== 1 ? "s" : ""} in conversation
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
              aria-label="Close"
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
        </div>

        {/* Controls bar */}
        <div className="flex-shrink-0 px-5 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          </div>

          {/* View mode toggle */}
          {showViewToggle && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("html")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                  viewMode === "html"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Rich
              </button>
              <button
                onClick={() => setViewMode("plain")}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                  viewMode === "plain"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Plain
              </button>
            </div>
          )}
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {thread.emails.map((email, index) => (
            <React.Fragment key={email.id}>
              {/* Thread connector line between emails */}
              {index > 0 && (
                <div className="flex justify-center">
                  <div className="w-px h-4 bg-gray-300"></div>
                </div>
              )}
              <EmailItem
                email={email}
                isExpanded={expandedIds.has(email.id)}
                onToggle={() => toggleEmail(email.id)}
                onViewFull={onViewEmail ? () => onViewEmail(email) : undefined}
                viewMode={viewMode}
              />
            </React.Fragment>
          ))}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white border-t px-5 py-3 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-full text-sm font-medium text-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailThreadViewModal;
