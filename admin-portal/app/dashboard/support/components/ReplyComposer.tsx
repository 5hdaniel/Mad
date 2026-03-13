'use client';

/**
 * ReplyComposer - Support Ticket Detail
 *
 * Composer with Reply / Internal Note toggle and file attachment support.
 * Internal Note mode has amber border styling.
 */

import { useState } from 'react';
import { Send, Lock, MessageSquare } from 'lucide-react';
import { addMessage, uploadAttachment } from '@/lib/support-queries';
import type { MessageType } from '@/lib/support-types';
import { FileUpload } from './FileUpload';
import type { PendingFile } from './FileUpload';

interface ReplyComposerProps {
  ticketId: string;
  onMessageSent: () => void;
}

export function ReplyComposer({ ticketId, onMessageSent }: ReplyComposerProps) {
  const [body, setBody] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('reply');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const isNote = messageType === 'internal_note';
  const validFiles = files.filter((f) => !f.error);

  async function handleSend() {
    if (!body.trim() && validFiles.length === 0) return;

    setSending(true);
    setError(null);
    setUploadProgress(null);

    try {
      // Send message first
      const result = await addMessage(ticketId, body.trim(), messageType);
      const messageId = result.id;

      // Upload attachments linked to the message
      if (validFiles.length > 0) {
        for (let i = 0; i < validFiles.length; i++) {
          setUploadProgress(`Uploading ${i + 1}/${validFiles.length}...`);
          await uploadAttachment(ticketId, validFiles[i].file, messageId);
        }
      }

      setBody('');
      setFiles([]);
      setUploadProgress(null);
      onMessageSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  }

  return (
    <div
      className={`rounded-lg border-2 ${
        isNote ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Toggle buttons */}
      <div className="flex border-b border-gray-200 px-1 pt-1">
        <button
          type="button"
          onClick={() => setMessageType('reply')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
            !isNote
              ? 'bg-white text-blue-700 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Reply
        </button>
        <button
          type="button"
          onClick={() => setMessageType('internal_note')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
            isNote
              ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          Internal Note
        </button>
      </div>

      {/* Textarea */}
      <div className="p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNote ? 'Add an internal note (not visible to customer)...' : 'Type your reply...'}
          rows={4}
          className={`w-full border-0 resize-none text-sm focus:outline-none focus:ring-0 ${
            isNote ? 'bg-amber-50 placeholder-amber-400' : 'bg-white placeholder-gray-400'
          }`}
        />

        {/* File Upload */}
        <div className="mb-2">
          <FileUpload files={files} onFilesChange={setFiles} disabled={sending} />
        </div>

        {error && (
          <div className="mb-2 text-sm text-red-600">{error}</div>
        )}

        {uploadProgress && (
          <div className="mb-2 text-sm text-blue-600">{uploadProgress}</div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {isNote ? 'Only visible to agents' : 'Visible to customer'}
            {' | Ctrl+Enter to send'}
          </span>
          <button
            onClick={handleSend}
            disabled={(!body.trim() && validFiles.length === 0) || sending}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isNote
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? (uploadProgress || 'Sending...') : isNote ? 'Add Note' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}
