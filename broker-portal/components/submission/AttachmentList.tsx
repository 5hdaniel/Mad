'use client';

/**
 * AttachmentList Component
 *
 * Displays attachments in a grid with clickable items that open the viewer.
 * Part of BACKLOG-401.
 */

import { useState } from 'react';
import { AttachmentViewerModal } from './AttachmentViewerModal';

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);

  if (attachments.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Attachments (0)</h2>
        </div>
        <div className="px-6 py-12 text-center text-gray-500">
          No attachments in this submission
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Attachments ({attachments.length})
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {attachments.map((attachment) => {
            const isPdf = attachment.mime_type?.includes('pdf');
            const isImage = attachment.mime_type?.startsWith('image/');

            return (
              <button
                key={attachment.id}
                onClick={() => setSelectedAttachment(attachment)}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-left group"
              >
                {/* File icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isPdf
                      ? 'bg-red-100'
                      : isImage
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                  }`}
                >
                  {isPdf ? (
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : isImage ? (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
              </button>
            );
          })}
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
