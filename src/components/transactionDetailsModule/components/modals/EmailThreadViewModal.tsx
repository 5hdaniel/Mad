/**
 * EmailThreadViewModal Component
 * TASK-1183: Modal for viewing all emails in a conversation thread.
 * Displays emails in a chat-bubble style for easy reading.
 * Click to expand for full email details.
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

/**
 * Sanitize HTML content to prevent XSS attacks
 */
function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "div", "span", "a", "b", "i", "strong", "em", "u",
      "ul", "ol", "li", "blockquote",
    ],
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/**
 * Strip HTML and get plain text preview - removes quoted content and reply headers
 */
function getPlainTextPreview(email: Communication, maxLength: number = 300): string {
  let text = "";

  // Prefer plain text
  const plain = email.body_text || email.body_plain;
  if (plain) {
    text = plain;
  } else {
    // Fall back to stripping HTML
    const html = email.body_html || email.body;
    if (html) {
      const div = document.createElement("div");
      div.innerHTML = sanitizeHtml(html);
      text = div.textContent || div.innerText || "";
    }
  }

  if (!text) return "";

  // Remove Outlook-style reply headers (starts with underscores or dashes)
  // Pattern: ________________________________\nFrom: ...\nSent: ...\nTo: ...
  const outlookReplyPattern = /_{10,}[\s\S]*?(?=\n\n|$)/g;
  text = text.replace(outlookReplyPattern, '');

  // Also catch "From: ... Sent: ..." pattern without underscores
  const fromSentPattern = /\nFrom:.*?\nSent:.*?(?:\nTo:.*?)?(?:\nSubject:.*?)?(?:\n|$)/gi;
  text = text.replace(fromSentPattern, '\n');

  // Remove Gmail-style quoted content "On [date], [name] wrote:"
  const gmailQuotePattern = /On .+? wrote:[\s\S]*/gi;
  text = text.replace(gmailQuotePattern, '');

  // Remove lines starting with > (traditional quote style)
  const lines = text.split('\n').filter(line => !line.trim().startsWith('>'));
  text = lines.join('\n');

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  }
  return text;
}

/**
 * Format time for chat bubble
 */
function formatTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Extract sender name from email address
 */
function extractSenderName(sender: string | undefined): string {
  if (!sender) return "Unknown";

  const nameMatch = sender.match(/^([^<]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name && name !== sender) return name;
  }

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
 * Get consistent color for sender
 */
function getSenderColor(sender: string | undefined): string {
  const colors = [
    "from-blue-500 to-indigo-600",
    "from-green-500 to-teal-600",
    "from-purple-500 to-pink-600",
    "from-orange-500 to-red-600",
    "from-cyan-500 to-blue-600",
  ];
  const hash = (sender || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * Chat bubble for a single email
 */
function EmailBubble({
  email,
  isExpanded,
  onToggle,
  onViewFull,
}: {
  email: Communication;
  isExpanded: boolean;
  onToggle: () => void;
  onViewFull?: () => void;
}): React.ReactElement {
  const emailDate = new Date(email.sent_at || email.received_at || 0);
  const senderName = extractSenderName(email.sender);
  const avatarInitial = getAvatarInitial(email.sender);
  const avatarColor = getSenderColor(email.sender);
  const preview = useMemo(() => getPlainTextPreview(email), [email]);

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
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

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        className={`w-8 h-8 bg-gradient-to-br ${avatarColor} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 mt-1`}
      >
        {avatarInitial}
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        {/* Sender + Time header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 text-sm">
            {senderName}
          </span>
          <span className="text-xs text-gray-400">
            {formatTime(emailDate)}
          </span>
        </div>

        {/* Content bubble */}
        <div
          className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={onToggle}
        >
          {/* Preview text (always shown) */}
          <div
            className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
            onClick={handleContentClick}
          >
            {preview || <span className="italic text-gray-400">No content</span>}
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  <span className="font-medium">From:</span> {email.sender || "Unknown"}
                </div>
                {email.recipients && (
                  <div>
                    <span className="font-medium">To:</span> {email.recipients}
                  </div>
                )}
              </div>

              {onViewFull && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewFull();
                  }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Open Full Email →
                </button>
              )}
            </div>
          )}

          {/* Expand indicator */}
          {!isExpanded && (
            <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <span>Tap for details</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmailThreadViewModal({
  thread,
  onClose,
  onViewEmail,
}: EmailThreadViewModalProps): React.ReactElement {
  // Track which emails are expanded (default: none - show just content bubbles)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[80] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 w-full max-w-xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
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

        {/* Email conversation - newest first */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {[...thread.emails].reverse().map((email) => (
            <EmailBubble
              key={email.id}
              email={email}
              isExpanded={expandedIds.has(email.id)}
              onToggle={() => toggleEmail(email.id)}
              onViewFull={onViewEmail ? () => onViewEmail(email) : undefined}
            />
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
