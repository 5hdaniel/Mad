'use client';

/**
 * Customer Ticket Detail Page - Broker Portal
 *
 * Two-column layout: conversation thread (left) + sidebar (right).
 * Shows ticket detail with conversation thread and reply form.
 * Internal notes are filtered out. Customers cannot change status/assignment.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Hash } from 'lucide-react';
import { getTicketDetail } from '@/lib/support-queries';
import type { TicketDetailResponse } from '@/lib/support-types';
import { TicketStatusBadge } from '../components/TicketStatusBadge';
import { CustomerTicketDescription, CustomerMessageList } from '../components/CustomerConversation';
import { CustomerReplyForm } from '../components/CustomerReplyForm';
import { CustomerTicketSidebar } from '../components/CustomerTicketSidebar';

export default function CustomerTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  function handleReplySent() {
    loadDetail().then(() => {
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
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          &larr; Back to Tickets
        </Link>
        <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
          <p className="text-red-600 text-sm">{error || 'Ticket not found'}</p>
        </div>
      </div>
    );
  }

  const { ticket, messages, attachments } = detail;
  const isClosed = ticket.status === 'closed';
  const isResolved = ticket.status === 'resolved';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          &larr; Back to Tickets
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Hash className="h-5 w-5" />
              <span className="text-lg font-mono">{ticket.ticket_number}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
            <TicketStatusBadge status={ticket.status} />
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Description + Composer + Messages */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. Original ticket description (pinned) */}
          <CustomerTicketDescription
            description={ticket.description}
            requesterName={ticket.requester_name}
            createdAt={ticket.created_at}
            attachments={attachments.filter((a) => !a.message_id)}
          />

          {/* 2. Reply form or status message */}
          {isClosed ? (
            <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              This ticket is closed.
            </div>
          ) : isResolved ? (
            <>
              <div className="text-center py-3 text-amber-700 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                This ticket has been resolved. Reply below to reopen it.
              </div>
              <CustomerReplyForm
                ticketId={ticket.id}
                requesterEmail={ticket.requester_email}
                requesterName={ticket.requester_name}
                onReplySent={handleReplySent}
              />
            </>
          ) : (
            <CustomerReplyForm
              ticketId={ticket.id}
              requesterEmail={ticket.requester_email}
              requesterName={ticket.requester_name}
              onReplySent={handleReplySent}
            />
          )}

          {/* 3. Messages -- newest first */}
          <CustomerMessageList
            messages={messages}
            attachments={attachments}
            requesterEmail={ticket.requester_email}
          />
          <div ref={threadEndRef} />
        </div>

        {/* Right: Sidebar */}
        <div>
          <CustomerTicketSidebar ticket={ticket} />
        </div>
      </div>
    </div>
  );
}
