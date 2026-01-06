/**
 * AttachmentCard Component
 * Displays a single attachment with file type icon and metadata.
 */
import React from "react";
import type { TransactionAttachment } from "../hooks/useTransactionAttachments";

interface AttachmentCardProps {
  attachment: TransactionAttachment;
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Get file type category from MIME type
 */
function getFileTypeCategory(mimeType: string): "pdf" | "doc" | "spreadsheet" | "image" | "other" {
  const lower = mimeType.toLowerCase();

  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("word") || lower.includes("document") || lower.includes("msword") || lower.includes("opendocument.text")) return "doc";
  if (lower.includes("sheet") || lower.includes("excel") || lower.includes("spreadsheet") || lower.includes("csv")) return "spreadsheet";
  if (lower.startsWith("image/")) return "image";

  return "other";
}

/**
 * Get icon and color based on file type
 */
function getFileIcon(mimeType: string): { icon: React.ReactNode; colorClass: string } {
  const category = getFileTypeCategory(mimeType);

  switch (category) {
    case "pdf":
      return {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <text x="8" y="16" fontSize="6" fill="currentColor" fontWeight="bold">PDF</text>
          </svg>
        ),
        colorClass: "text-red-500 bg-red-50",
      };
    case "doc":
      return {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        colorClass: "text-blue-500 bg-blue-50",
      };
    case "spreadsheet":
      return {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ),
        colorClass: "text-green-500 bg-green-50",
      };
    case "image":
      return {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        colorClass: "text-purple-500 bg-purple-50",
      };
    default:
      return {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        ),
        colorClass: "text-gray-500 bg-gray-50",
      };
  }
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * AttachmentCard displays a single attachment with file info and email context.
 * Note: Download functionality is not implemented as attachments are stored as API references.
 */
export function AttachmentCard({ attachment }: AttachmentCardProps): React.ReactElement {
  const { icon, colorClass } = getFileIcon(attachment.mimeType);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* File type icon */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate" title={attachment.filename}>
            {attachment.filename}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>{formatFileSize(attachment.size)}</span>
            {attachment.emailDate && (
              <>
                <span className="text-gray-300">|</span>
                <span>{formatDate(attachment.emailDate)}</span>
              </>
            )}
          </div>

          {/* Source email */}
          <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate" title={attachment.emailSubject}>
              {attachment.emailSubject}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
