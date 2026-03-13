'use client';

/**
 * Ticket Detail Page - Agent Dashboard
 *
 * Two-column layout: conversation thread (left) + sidebar (right).
 * Shows ticket detail, messages, attachments, reply composer,
 * status/assignment controls, participants, and events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Hash, Eye, EyeOff } from 'lucide-react';
import { getTicketDetail } from '@/lib/support-queries';
import type { TicketDetailResponse } from '@/lib/support-types';
import { StatusBadge } from '../components/StatusBadge';
import { ConversationThread } from '../components/ConversationThread';
import { ReplyComposer } from '../components/ReplyComposer';
import { TicketSidebar } from '../components/TicketSidebar';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState(true);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(async () => {
    try {
      const data = await getTicketDetail(ticketId);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function handleMessageSent() {
    loadDetail().then(() => {
      // Scroll to bottom after new message
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
            <div className="h-96 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/support')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Queue
        </button>
        <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
          <p className="text-red-600 text-sm">{error || 'Ticket not found'}</p>
        </div>
      </div>
    );
  }

  const { ticket, messages, attachments, participants, events } = detail;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/support')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Queue
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Hash className="h-5 w-5" />
              <span className="text-lg font-mono">{ticket.ticket_number}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
            <StatusBadge status={ticket.status} />
          </div>
          {attachments.length > 0 && (
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {showAttachments ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showAttachments ? 'Hide' : 'Show'} attachments
              <span className="text-gray-400">({attachments.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Conversation */}
        <div className="lg:col-span-2 space-y-4">
          <ConversationThread
            messages={messages}
            attachments={attachments}
            ticketDescription={ticket.description}
            requesterName={ticket.requester_name}
            requesterEmail={ticket.requester_email}
            createdAt={ticket.created_at}
            showAttachments={showAttachments}
          />

          <div ref={threadEndRef} />

          {/* Reply Composer */}
          <ReplyComposer ticketId={ticket.id} onMessageSent={handleMessageSent} />
        </div>

        {/* Right: Sidebar */}
        <div>
          <TicketSidebar
            ticket={ticket}
            participants={participants}
            events={events}
            onTicketUpdated={loadDetail}
          />
        </div>
      </div>
    </div>
  );
}
