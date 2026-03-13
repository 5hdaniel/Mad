'use client';

/**
 * CustomerReplyForm - Customer Ticket Detail
 *
 * Reply form for customers to respond to their tickets.
 * Auth-aware: uses session email if authenticated, manual email if not.
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addMessage } from '@/lib/support-queries';

interface CustomerReplyFormProps {
  ticketId: string;
  requesterEmail: string;
  requesterName: string;
  onReplySent: () => void;
}

export function CustomerReplyForm({
  ticketId,
  requesterEmail,
  requesterName,
  onReplySent,
}: CustomerReplyFormProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [senderEmail, setSenderEmail] = useState(requesterEmail);
  const [senderName, setSenderName] = useState(requesterName);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setIsAuthenticated(true);
        setSenderEmail(user.email || requesterEmail);
        setSenderName(
          user.user_metadata?.full_name || user.user_metadata?.name || requesterName
        );
      }
    });
  }, [requesterEmail, requesterName]);

  async function handleSend() {
    if (!body.trim()) return;

    setSending(true);
    setError(null);

    try {
      await addMessage(ticketId, body.trim(), senderEmail, senderName);
      setBody('');
      onReplySent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {!isAuthenticated && (
        <div className="px-4 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your name"
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="Your email"
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div className="p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Type your reply..."
          className="w-full border-0 resize-none text-sm placeholder-gray-400 focus:outline-none focus:ring-0"
        />

        {error && <div className="mb-2 text-sm text-red-600">{error}</div>}

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Ctrl+Enter to send</span>
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
      </div>
    </div>
  );
}
