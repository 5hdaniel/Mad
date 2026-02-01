/**
 * AttachmentPreviewModal Component
 * Preview modal for email attachments with image display and system viewer fallback
 * TASK-1778: Email Attachment Preview Modal
 */
import React, { useEffect, useState } from "react";
import { X, ExternalLink, Image, FileText, File } from "lucide-react";

interface AttachmentPreviewModalProps {
  attachment: {
    id: string;
    filename: string;
    mime_type: string | null;
    file_size_bytes: number | null;
    storage_path: string | null;
  };
  onClose: () => void;
  onOpenWithSystem: (storagePath: string) => void;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get appropriate icon for file type
 */
function getFileIcon(mimeType: string | null): React.ComponentType<{ className?: string }> {
  if (mimeType?.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

export function AttachmentPreviewModal({
  attachment,
  onClose,
  onOpenWithSystem,
}: AttachmentPreviewModalProps): React.ReactElement {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const isImage = attachment.mime_type?.startsWith("image/") ?? false;
  const hasStoragePath = Boolean(attachment.storage_path);

  // Load image as base64 data URL (CSP blocks file:// URLs)
  useEffect(() => {
    if (isImage && attachment.storage_path && attachment.mime_type) {
      setImageLoading(true);
      setImageError(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api?.transactions;
      if (api?.getAttachmentData) {
        api
          .getAttachmentData(attachment.storage_path, attachment.mime_type)
          .then((result: { success: boolean; data?: string; error?: string }) => {
            if (result.success && result.data) {
              setImageUrl(result.data);
            } else {
              setImageError(true);
            }
          })
          .catch(() => {
            setImageError(true);
          })
          .finally(() => {
            setImageLoading(false);
          });
      } else {
        // Fallback for tests or missing API
        setImageError(true);
        setImageLoading(false);
      }
    }
  }, [isImage, attachment.storage_path, attachment.mime_type]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Handle open with system viewer
  const handleOpenWithSystem = () => {
    if (attachment.storage_path) {
      onOpenWithSystem(attachment.storage_path);
    }
  };

  const Icon = getFileIcon(attachment.mime_type);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
      data-testid="attachment-preview-backdrop"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {attachment.filename}
              </h3>
              <p className="text-xs text-gray-500">
                {formatFileSize(attachment.file_size_bytes)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasStoragePath && (
              <button
                onClick={handleOpenWithSystem}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                data-testid="open-with-system-button"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close preview"
              data-testid="close-preview-button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
          {isImage && imageLoading ? (
            <div className="text-center py-12" data-testid="image-loading">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading preview...</p>
            </div>
          ) : isImage && imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={attachment.filename}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              onError={() => setImageError(true)}
              data-testid="preview-image"
            />
          ) : isImage && imageError ? (
            <div className="text-center py-12" data-testid="image-error-fallback">
              <Image className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Failed to load image</p>
              {hasStoragePath && (
                <button
                  onClick={handleOpenWithSystem}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open with System Viewer
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-12" data-testid="non-image-fallback">
              <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">
                {attachment.filename}
              </p>
              <p className="text-gray-500 mb-4">
                {formatFileSize(attachment.file_size_bytes)}
              </p>
              {hasStoragePath && (
                <button
                  onClick={handleOpenWithSystem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open with System Viewer
                </button>
              )}
              {!hasStoragePath && (
                <p className="text-gray-400 text-sm">
                  Attachment not downloaded
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
