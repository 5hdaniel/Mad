/**
 * EmailViewModal Component
 * Full email view modal for communications with HTML rendering support
 * TASK-1776: Added email attachment display with collapsible section
 * TASK-1778: Added attachment preview modal
 */
import React, { useState, useCallback, useMemo, useEffect } from "react";
import DOMPurify from "dompurify";
import type { Communication } from "../../types";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { formatFileSize } from "../../../../utils/formatUtils";
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

type ViewMode = "html" | "plain";

interface EmailViewModalProps {
  email: Communication;
  onClose: () => void;
  onRemoveFromTransaction: () => void;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
function sanitizeHtml(html: string): string {
  // Strip cid: image references — browser can't resolve them (inline MIME parts)
  const cleaned = html.replace(/<img[^>]*\ssrc=["']cid:[^"']*["'][^>]*\/?>/gi, "");

  return DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "div",
      "span",
      "a",
      "b",
      "i",
      "strong",
      "em",
      "u",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "img",
      "blockquote",
      "pre",
      "code",
      "hr",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "class", "style", "width", "height"],
    ALLOW_DATA_ATTR: false,
    // Remove potentially dangerous attributes
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
  // body_html is the primary HTML content
  // body is the deprecated HTML field (still populated by older code paths)
  // body_text is the normalized plain text
  // body_plain is deprecated but may still be populated
  const html = email.body_html || email.body || null;
  const plain = email.body_text || email.body_plain || null;

  return { html, plain };
}

export function EmailViewModal({
  email,
  onClose,
  onRemoveFromTransaction,
}: EmailViewModalProps): React.ReactElement {
  const { html, plain } = useMemo(() => getEmailContent(email), [email]);
  const hasHtml = Boolean(html);
  const hasPlain = Boolean(plain);

  // Default to HTML view if available, otherwise plain
  const [viewMode, setViewMode] = useState<ViewMode>(hasHtml ? "html" : "plain");

  // TASK-1776: Attachment state
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  // TASK-1778: Preview modal state
  const [previewAttachment, setPreviewAttachment] = useState<EmailAttachment | null>(null);

  // TASK-1776: Fetch attachments when email loads
  useEffect(() => {
    if (email?.id && email.has_attachments) {
      setLoadingAttachments(true);
      window.api.transactions
        .getEmailAttachments(email.id)
        .then((result: { success: boolean; data?: EmailAttachment[]; error?: string }) => {
          if (result.success && result.data) {
            setAttachments(result.data);
          }
        })
        .catch((err: Error) => {
          logger.error("Failed to fetch email attachments:", err);
        })
        .finally(() => {
          setLoadingAttachments(false);
        });
    }
  }, [email?.id, email?.has_attachments]);

  // TASK-1776: Handle opening an attachment
  const handleOpenAttachment = useCallback(async (attachment: EmailAttachment) => {
    if (!attachment.storage_path) {
      logger.warn("Attachment has no storage path:", attachment.filename);
      return;
    }

    try {
      const result = await window.api.transactions.openAttachment(attachment.storage_path);
      if (!result.success) {
        logger.error("Failed to open attachment:", result.error);
      }
    } catch (err) {
      logger.error("Error opening attachment:", err);
    }
  }, []);

  // Sanitize HTML content when in HTML mode
  const sanitizedHtml = useMemo(() => {
    if (html) {
      return sanitizeHtml(html);
    }
    return "";
  }, [html]);

  /**
   * Handle clicks on links to open them in external browser
   */
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor) {
        e.preventDefault();
        const href = anchor.getAttribute("href");
        if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
          // Open link in external browser via Electron shell
          if (window.api?.shell?.openExternal) {
            window.api.shell.openExternal(href);
          } else {
            // Fallback for testing/non-Electron environments
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }
      }
    },
    []
  );

  const hasContent = hasHtml || hasPlain;
  const showToggle = hasHtml && hasPlain;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[90] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Email Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-bold text-white">
                {email.subject || "(No Subject)"}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {email.sent_at
                  ? new Date(email.sent_at).toLocaleString()
                  : "Unknown date"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
              aria-label="Close email"
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

        {/* Email Metadata */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-500 w-16">
                  From:
                </span>
                <span className="text-sm text-gray-900">
                  {email.sender || "Unknown"}
                </span>
              </div>
              {email.recipients && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-gray-500 w-16">
                    To:
                  </span>
                  <span className="text-sm text-gray-900">
                    {email.recipients}
                  </span>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            {showToggle && (
              <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("html")}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                    viewMode === "html"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  aria-pressed={viewMode === "html"}
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
                  aria-pressed={viewMode === "plain"}
                >
                  Plain
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TASK-1776: Collapsible Attachments Section */}
        {(email.has_attachments || attachments.length > 0) && (
          <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 bg-white">
            <button
              onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              disabled={loadingAttachments}
            >
              <svg
                className={`w-4 h-4 transition-transform ${attachmentsExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="font-medium">
                {loadingAttachments
                  ? "Loading attachments..."
                  : `${attachments.length} attachment${attachments.length !== 1 ? "s" : ""}`}
              </span>
            </button>

            {attachmentsExpanded && attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    onClick={() => setPreviewAttachment(attachment)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700"
                    title={`Preview ${attachment.filename}`}
                    data-testid={`attachment-${attachment.id}`}
                  >
                    {getFileTypeIcon(attachment.mime_type)}
                    <span className="truncate max-w-[150px]">{attachment.filename}</span>
                    {attachment.file_size_bytes && (
                      <span className="text-gray-500 text-xs flex-shrink-0">
                        {formatFileSize(attachment.file_size_bytes)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {hasContent ? (
            viewMode === "html" && hasHtml ? (
              <div
                className="prose prose-sm max-w-none email-content"
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {plain}
                </pre>
              </div>
            )
          ) : (
            <p className="text-gray-500 italic text-center py-8">
              No email content available
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <button
              onClick={onRemoveFromTransaction}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              Remove from Transaction
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* TASK-1778: Attachment Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onOpenWithSystem={(storagePath) => {
            handleOpenAttachment({ storage_path: storagePath } as EmailAttachment);
          }}
        />
      )}
    </div>
  );
}
