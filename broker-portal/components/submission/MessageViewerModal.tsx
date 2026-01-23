'use client';

/**
 * MessageViewerModal Component
 *
 * Full message viewer modal for emails and text messages.
 * Part of BACKLOG-401.
 */

import { formatDate } from '@/lib/utils';

interface Message {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body_text: string | null;
  sent_at: string;
  has_attachments: boolean;
  attachment_count: number;
}

interface MessageViewerModalProps {
  message: Message | null;
  open: boolean;
  onClose: () => void;
}

export function MessageViewerModal({ message, open, onClose }: MessageViewerModalProps) {
  if (!message || !open) return null;

  const isEmail = message.channel === 'email';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className={`p-2 rounded-lg ${
                isEmail ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
              }`}
            >
              {isEmail ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEmail ? message.subject || 'No Subject' : 'Text Message'}
              </h2>
              <p className="text-sm text-gray-500">{formatDate(message.sent_at)}</p>
            </div>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
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

        {/* Direction indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b text-sm">
          <div className="flex items-center gap-2">
            {message.direction === 'outbound' ? (
              <>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-gray-600">Sent</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span className="text-gray-600">Received</span>
              </>
            )}
            <span className="text-gray-400 uppercase text-xs">{message.channel}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
            {message.body_text || 'No content'}
          </p>
        </div>

        {/* Attachments indicator */}
        {message.has_attachments && (
          <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            {message.attachment_count} attachment{message.attachment_count !== 1 ? 's' : ''} (view in
            Attachments section)
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageViewerModal;
