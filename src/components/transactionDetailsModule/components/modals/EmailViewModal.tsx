/**
 * EmailViewModal Component
 * Full email view modal for communications with HTML rendering support
 */
import React, { useState, useCallback, useMemo } from "react";
import DOMPurify from "dompurify";
import type { Communication } from "../../types";

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
  return DOMPurify.sanitize(html, {
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
    </div>
  );
}
