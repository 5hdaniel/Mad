'use client';

/**
 * AttachmentViewerModal Component
 *
 * Preview and download attachments with signed URLs.
 * Part of BACKLOG-401.
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import heic2any from 'heic2any';

interface Attachment {
  id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
}

interface AttachmentViewerModalProps {
  attachment: Attachment | null;
  open: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentViewerModal({ attachment, open, onClose }: AttachmentViewerModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const supabase = createClient();

  // Check if file is HEIC/HEIF format
  const isHeic = attachment?.mime_type === 'image/heic' ||
    attachment?.mime_type === 'image/heif' ||
    attachment?.filename?.toLowerCase().endsWith('.heic') ||
    attachment?.filename?.toLowerCase().endsWith('.heif');

  useEffect(() => {
    if (!attachment || !open || !attachment.storage_path) {
      setSignedUrl(null);
      setDisplayUrl(null);
      return;
    }

    const fetchUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: storageError } = await supabase.storage
          .from('submission-attachments')
          .createSignedUrl(attachment.storage_path!, 3600); // 1 hour

        if (storageError) throw storageError;
        setSignedUrl(data.signedUrl);

        // If HEIC, convert to displayable format
        if (isHeic) {
          setConverting(true);
          try {
            const response = await fetch(data.signedUrl);
            const blob = await response.blob();
            const convertedBlob = await heic2any({
              blob,
              toType: 'image/jpeg',
              quality: 0.8,
            });
            // heic2any can return array or single blob
            const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            const objectUrl = URL.createObjectURL(resultBlob);
            setDisplayUrl(objectUrl);
          } catch (conversionError) {
            console.error('HEIC conversion failed:', conversionError);
            // Fall back to download-only if conversion fails
            setDisplayUrl(null);
          } finally {
            setConverting(false);
          }
        } else {
          setDisplayUrl(data.signedUrl);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('Failed to get signed URL:', {
          filename: attachment.filename,
          storagePath: attachment.storage_path,
          error: errorMessage,
        });
        setError(`Failed to load attachment: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();

    // Cleanup object URL on unmount
    return () => {
      if (displayUrl && displayUrl.startsWith('blob:')) {
        URL.revokeObjectURL(displayUrl);
      }
    };
  }, [attachment, open, supabase.storage, isHeic]);

  if (!attachment || !open) return null;

  const isImage = attachment.mime_type?.startsWith('image/');
  const isPdf = attachment.mime_type === 'application/pdf';
  const isVideo = attachment.mime_type?.startsWith('video/') ||
    ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].some(ext => attachment.filename.toLowerCase().endsWith(ext));
  const canPreview = isImage || isPdf || isVideo;

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* File icon */}
            <div className="p-2 bg-gray-100 rounded-lg">
              {isImage ? (
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : isPdf ? (
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : isVideo ? (
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{attachment.filename}</h2>
              <p className="text-sm text-gray-500">
                {attachment.mime_type || 'Unknown type'} | {formatFileSize(attachment.file_size_bytes)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={!signedUrl || loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100">
          {/* Loading state */}
          {(loading || converting) && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <svg
                  className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm text-gray-500">
                  {converting ? 'Converting HEIC image...' : 'Loading preview...'}
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-red-500">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Preview content */}
          {signedUrl && !loading && !converting && !error && (
            <>
              {/* Image preview */}
              {isImage && displayUrl && (
                <div className="flex items-center justify-center p-4 min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayUrl}
                    alt={attachment.filename}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                </div>
              )}

              {/* HEIC conversion failed - show download prompt */}
              {isImage && isHeic && !displayUrl && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium mb-1">HEIC Image</p>
                  <p className="text-sm mb-4">This Apple image format could not be converted for preview</p>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Download to view
                  </button>
                </div>
              )}

              {/* PDF preview */}
              {isPdf && (
                <iframe
                  src={signedUrl}
                  className="w-full h-[70vh]"
                  title={attachment.filename}
                />
              )}

              {/* Video preview */}
              {isVideo && (
                <div className="flex items-center justify-center p-4 min-h-[300px]">
                  <video
                    src={signedUrl}
                    controls
                    className="max-w-full max-h-[70vh]"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* No preview available */}
              {!canPreview && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium mb-1">Preview not available</p>
                  <p className="text-sm mb-4">This file type cannot be previewed in the browser</p>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Download to view
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttachmentViewerModal;
