'use client';

/**
 * AttachmentList Component
 *
 * Displays attachments split into two sections:
 * 1. Media Gallery (images, videos, GIFs) - with thumbnail previews
 * 2. Documents (PDFs, Word, Excel, etc.) - in a list view
 *
 * Part of BACKLOG-401.
 */

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AttachmentViewerModal } from './AttachmentViewerModal';
import { EmptyAttachments } from '@/components/ui/EmptyState';
import heic2any from 'heic2any';

interface Attachment {
  id: string;
  filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
  document_type: string | null;
}

interface AttachmentListProps {
  attachments: Attachment[];
}

// Media file extensions and MIME types
const MEDIA_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp', '.bmp', '.tiff', '.tif',
  '.raw', '.cr2', '.nef', '.arw', '.dng', '.orf', '.rw2', '.pef', '.srw',
  // Videos
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv', '.3gp',
];

const MEDIA_MIME_TYPES = [
  'image/', 'video/',
];

function isMediaFile(attachment: Attachment): boolean {
  const mimeType = attachment.mime_type?.toLowerCase() || '';
  const filename = attachment.filename.toLowerCase();

  // Check MIME type
  if (MEDIA_MIME_TYPES.some(type => mimeType.startsWith(type))) {
    return true;
  }

  // Check file extension
  if (MEDIA_EXTENSIONS.some(ext => filename.endsWith(ext))) {
    return true;
  }

  return false;
}

function isVideoFile(attachment: Attachment): boolean {
  const mimeType = attachment.mime_type?.toLowerCase() || '';
  const filename = attachment.filename.toLowerCase();

  if (mimeType.startsWith('video/')) return true;

  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv', '.3gp'];
  return videoExtensions.some(ext => filename.endsWith(ext));
}

function isHeicFile(attachment: Attachment): boolean {
  const mimeType = attachment.mime_type?.toLowerCase() || '';
  const filename = attachment.filename.toLowerCase();

  return mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    filename.endsWith('.heic') ||
    filename.endsWith('.heif');
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentIcon(attachment: Attachment): { icon: 'pdf' | 'excel' | 'word' | 'powerpoint' | 'other'; color: string } {
  const mimeType = attachment.mime_type?.toLowerCase() || '';
  const filename = attachment.filename.toLowerCase();

  // PDF
  if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
    return { icon: 'pdf', color: 'text-red-600 bg-red-100' };
  }

  // Excel
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') ||
      filename.endsWith('.xls') || filename.endsWith('.xlsx') || filename.endsWith('.csv')) {
    return { icon: 'excel', color: 'text-green-600 bg-green-100' };
  }

  // Word
  if (mimeType.includes('word') || mimeType.includes('document') ||
      filename.endsWith('.doc') || filename.endsWith('.docx')) {
    return { icon: 'word', color: 'text-blue-600 bg-blue-100' };
  }

  // PowerPoint
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') ||
      filename.endsWith('.ppt') || filename.endsWith('.pptx')) {
    return { icon: 'powerpoint', color: 'text-orange-600 bg-orange-100' };
  }

  return { icon: 'other', color: 'text-gray-600 bg-gray-100' };
}

// Media thumbnail component with lazy loading
function MediaThumbnail({
  attachment,
  onClick
}: {
  attachment: Attachment;
  onClick: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const supabase = createClient();
  const isVideo = isVideoFile(attachment);
  const isHeic = isHeicFile(attachment);

  useEffect(() => {
    if (!attachment.storage_path) {
      setLoading(false);
      return;
    }

    const fetchUrl = async () => {
      try {
        const { data, error: storageError } = await supabase.storage
          .from('submission-attachments')
          .createSignedUrl(attachment.storage_path!, 3600);

        if (storageError) throw storageError;

        // Convert HEIC to displayable format
        if (isHeic) {
          try {
            const response = await fetch(data.signedUrl);
            const blob = await response.blob();
            const convertedBlob = await heic2any({
              blob,
              toType: 'image/jpeg',
              quality: 0.7, // Lower quality for thumbnails
            });
            const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            const objectUrl = URL.createObjectURL(resultBlob);
            setThumbnailUrl(objectUrl);
          } catch (conversionError) {
            console.error('HEIC thumbnail conversion failed:', conversionError);
            setError(true);
          }
        } else {
          setThumbnailUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Failed to load attachment thumbnail:', {
          filename: attachment.filename,
          storagePath: attachment.storage_path,
          error: err instanceof Error ? err.message : err,
        });
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();

    // Cleanup object URL on unmount
    return () => {
      if (thumbnailUrl && thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [attachment.storage_path, supabase.storage, isHeic]);

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity group focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      {thumbnailUrl && !loading && !error && (
        <>
          {isVideo ? (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              {/* Video thumbnail - show first frame would require additional processing */}
              <div className="text-white">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={attachment.filename}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </>
      )}

      {/* Video play icon overlay */}
      {isVideo && thumbnailUrl && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-colors">
          <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Filename tooltip on hover */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-xs truncate">{attachment.filename}</p>
      </div>
    </button>
  );
}

// Document icons
function DocumentIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'pdf':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    case 'excel':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM7.5 18l2-3.5-2-3.5h1.5l1.25 2.5L11.5 11H13l-2 3.5 2 3.5h-1.5l-1.25-2.5L9 18H7.5z" />
        </svg>
      );
    case 'word':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM7 18l1.5-6h1.5l1 3.5L12 12h1.5l1.5 6h-1.5l-.75-3.5-.75 3.5H10.5l-.75-3.5L9 18H7z" />
        </svg>
      );
    case 'powerpoint':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 18v-6h2.5c.83 0 1.5.67 1.5 1.5S11.33 15 10.5 15H9.5v3H8z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'media' | 'documents'>('documents');

  // Split attachments into media and documents
  const { mediaFiles, documentFiles } = useMemo(() => {
    const media: Attachment[] = [];
    const docs: Attachment[] = [];

    for (const attachment of attachments) {
      if (isMediaFile(attachment)) {
        media.push(attachment);
      } else {
        docs.push(attachment);
      }
    }

    return { mediaFiles: media, documentFiles: docs };
  }, [attachments]);

  if (attachments.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Attachments (0)</h2>
        </div>
        <EmptyAttachments />
      </div>
    );
  }

  const tabs = [
    { value: 'all' as const, label: 'All', count: attachments.length },
    { value: 'media' as const, label: 'Media', count: mediaFiles.length },
    { value: 'documents' as const, label: 'Documents', count: documentFiles.length },
  ];

  const displayedMedia = activeTab === 'documents' ? [] : mediaFiles;
  const displayedDocs = activeTab === 'media' ? [] : documentFiles;

  return (
    <>
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        {/* Header with tabs */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Attachments ({attachments.length})
            </h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {tabs.map(({ value, label, count }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Media Gallery */}
          {displayedMedia.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Media ({mediaFiles.length})
                </h3>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {displayedMedia.map((attachment) => (
                  <MediaThumbnail
                    key={attachment.id}
                    attachment={attachment}
                    onClick={() => setSelectedAttachment(attachment)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Documents List */}
          {displayedDocs.length > 0 && (
            <div>
              {activeTab === 'all' && (
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Documents ({documentFiles.length})
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayedDocs.map((attachment) => {
                  const { icon, color } = getDocumentIcon(attachment);

                  return (
                    <button
                      key={attachment.id}
                      onClick={() => setSelectedAttachment(attachment)}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-left group"
                    >
                      {/* File icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                        <DocumentIcon type={icon} className="w-5 h-5" />
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {attachment.document_type && (
                            <span className="capitalize">{attachment.document_type} - </span>
                          )}
                          {formatFileSize(attachment.file_size_bytes)}
                        </p>
                      </div>

                      {/* View indicator */}
                      <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachment Viewer Modal */}
      <AttachmentViewerModal
        attachment={selectedAttachment}
        open={!!selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />
    </>
  );
}

export default AttachmentList;
