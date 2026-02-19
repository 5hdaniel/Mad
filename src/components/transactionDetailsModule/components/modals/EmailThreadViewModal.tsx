/**
 * EmailThreadViewModal Component
 * TASK-1183: Modal for viewing all emails in a conversation thread.
 * Displays emails in a chat-bubble style for easy reading.
 * Click to expand for full email details.
 * TASK-1782: Added attachment display per email in thread view.
 */
import React, { useState, useCallback, useMemo, useEffect } from "react";
import DOMPurify from "dompurify";
import type { Communication } from "../../types";
import type { EmailThread } from "../EmailThreadCard";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import logger from '../../../../utils/logger';

/**
 * Email attachment structure from IPC
 */
interface EmailAttachment {
  id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get icon for file type based on MIME type
 */
function getFileTypeIcon(mimeType: string | null): React.ReactElement {
  const iconClass = "w-4 h-4 flex-shrink-0";

  if (!mimeType) {
    // Default file icon
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }

  if (mimeType.includes("document") || mimeType.includes("word")) {
    return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }

  // Default file icon
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

interface EmailThreadViewModalProps {
  /** The email thread to display */
  thread: EmailThread;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional callback when an email is clicked for full view */
  onViewEmail?: (email: Communication) => void;
  /** User's email address — emails from this sender show as "You" */
  userEmail?: string;
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
 * Check if sender matches the user's email
 */
function isSelfSender(sender: string | undefined, userEmail?: string): boolean {
  if (!sender || !userEmail) return false;
  const normalizedUser = userEmail.toLowerCase().trim();
  const match = sender.match(/<([^>]+)>/);
  const email = match ? match[1].toLowerCase() : sender.toLowerCase().trim();
  return email === normalizedUser;
}

/**
 * Extract sender name from email address
 */
function extractSenderName(sender: string | undefined, userEmail?: string): string {
  if (!sender) return "Unknown";

  // Show "You" for the user's own emails
  if (isSelfSender(sender, userEmail)) return "You";

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
 * TASK-1782: Added attachment display support
 */
function EmailBubble({
  email,
  isExpanded,
  onToggle,
  onViewFull,
  attachments,
  loadingAttachments,
  onPreviewAttachment,
  userEmail,
}: {
  email: Communication;
  isExpanded: boolean;
  onToggle: () => void;
  onViewFull?: () => void;
  attachments: EmailAttachment[];
  loadingAttachments: boolean;
  onPreviewAttachment: (attachment: EmailAttachment) => void;
  userEmail?: string;
}): React.ReactElement {
  const emailDate = new Date(email.sent_at || email.received_at || 0);
  const isMe = isSelfSender(email.sender, userEmail);
  const senderName = extractSenderName(email.sender, userEmail);
  const avatarInitial = isMe ? "Y" : getAvatarInitial(email.sender);
  const avatarColor = getSenderColor(email.sender);
  const preview = useMemo(() => getPlainTextPreview(email), [email]);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);

  const hasAttachments = email.has_attachments || attachments.length > 0;
  const attachmentCount = attachments.length || (email.has_attachments ? 1 : 0);

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

  const handleAttachmentToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachmentsExpanded(!attachmentsExpanded);
  }, [attachmentsExpanded]);

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
          {/* TASK-1782: Attachment count badge in header */}
          {hasAttachments && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-500 bg-gray-100 rounded-full"
              title={`${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {loadingAttachments ? "..." : attachmentCount}
            </span>
          )}
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

          {/* TASK-1782: Collapsible attachment section */}
          {hasAttachments && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <button
                onClick={handleAttachmentToggle}
                className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors w-full text-left"
                disabled={loadingAttachments}
                data-testid={`attachment-toggle-${email.id}`}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${attachmentsExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="font-medium">
                  {loadingAttachments
                    ? "Loading attachments..."
                    : `${attachmentCount} attachment${attachmentCount !== 1 ? "s" : ""}`}
                </span>
              </button>

              {attachmentsExpanded && attachments.length > 0 && (
                <div className="mt-2 space-y-1" data-testid={`attachment-list-${email.id}`}>
                  {attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewAttachment(attachment);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors bg-gray-50 hover:bg-gray-100 text-gray-700"
                      title={`Preview ${attachment.filename}`}
                      data-testid={`thread-attachment-${attachment.id}`}
                    >
                      {getFileTypeIcon(attachment.mime_type)}
                      <span className="truncate flex-1 text-left">{attachment.filename}</span>
                      {attachment.file_size_bytes && (
                        <span className="text-gray-500 flex-shrink-0">
                          {formatFileSize(attachment.file_size_bytes)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
          {!isExpanded && !hasAttachments && (
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
  userEmail,
}: EmailThreadViewModalProps): React.ReactElement {
  // Track which emails are expanded (default: none - show just content bubbles)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // TASK-1782: Attachment state management
  // Map of email ID -> attachments
  const [attachmentsByEmail, setAttachmentsByEmail] = useState<Map<string, EmailAttachment[]>>(new Map());
  const [loadingAttachmentIds, setLoadingAttachmentIds] = useState<Set<string>>(new Set());
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachment | null>(null);

  // TASK-1782: Fetch attachments for emails that have them
  useEffect(() => {
    const emailsWithAttachments = thread.emails.filter(email => email.has_attachments && email.id);

    if (emailsWithAttachments.length === 0) return;

    const transactionsApi = window.api?.transactions;
    if (!transactionsApi?.getEmailAttachments) return;

    // Mark all as loading
    setLoadingAttachmentIds(new Set(emailsWithAttachments.map(e => e.id)));

    // Fetch attachments for each email
    emailsWithAttachments.forEach(email => {
      transactionsApi
        .getEmailAttachments(email.id)
        .then((result: { success: boolean; data?: EmailAttachment[]; error?: string }) => {
          if (result.success && result.data) {
            setAttachmentsByEmail(prev => {
              const next = new Map(prev);
              next.set(email.id, result.data!);
              return next;
            });
          }
        })
        .catch((err: Error) => {
          logger.error(`Failed to fetch attachments for email ${email.id}:`, err);
        })
        .finally(() => {
          setLoadingAttachmentIds(prev => {
            const next = new Set(prev);
            next.delete(email.id);
            return next;
          });
        });
    });
  }, [thread.emails]);

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

  // TASK-1782: Handle opening an attachment with system viewer
  const handleOpenAttachment = useCallback(async (storagePath: string) => {
    try {
      const transactionsApi = window.api?.transactions;
      if (transactionsApi?.openAttachment) {
        const result = await transactionsApi.openAttachment(storagePath);
        if (!result.success) {
          logger.error("Failed to open attachment:", result.error);
        }
      }
    } catch (err) {
      logger.error("Error opening attachment:", err);
    }
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
              attachments={attachmentsByEmail.get(email.id) || []}
              loadingAttachments={loadingAttachmentIds.has(email.id)}
              onPreviewAttachment={setPreviewAttachment}
              userEmail={userEmail}
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

      {/* TASK-1782: Attachment Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onOpenWithSystem={(storagePath) => {
            handleOpenAttachment(storagePath);
          }}
        />
      )}
    </div>
  );
}

export default EmailThreadViewModal;
