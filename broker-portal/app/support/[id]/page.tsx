'use client';

/**
 * Customer Ticket Detail Page - Broker Portal
 *
 * Shows ticket detail with conversation thread and reply form.
 * Internal notes are filtered out. Customers cannot change status/assignment.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getTicketDetail, closeTicketByRequester } from '@/lib/support-queries';
import type { TicketDetailResponse } from '@/lib/support-types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/support-types';
import { TicketStatusBadge } from '../components/TicketStatusBadge';
import { CustomerTicketDescription, CustomerMessageList } from '../components/CustomerConversation';
import { CustomerReplyForm } from '../components/CustomerReplyForm';

export default function CustomerTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
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

  async function handleCloseTicket() {
    setClosing(true);
    try {
      await closeTicketByRequester(ticketId);
      setShowCloseConfirm(false);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close ticket');
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-6" />
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div>
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
    <div>
      {/* Header */}
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        &larr; Back to Tickets
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-400 font-mono">#{ticket.ticket_number}</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">{ticket.subject}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
              {ticket.category_name && <span>{ticket.category_name}</span>}
              <span>
                {new Date(ticket.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}
            >
              {PRIORITY_LABELS[ticket.priority]}
            </span>
            <TicketStatusBadge status={ticket.status} />
            {ticket.status !== 'closed' && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="ml-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close Ticket
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1. Original description (pinned) */}
      <div className="mb-4">
        <CustomerTicketDescription
          description={ticket.description}
          requesterName={ticket.requester_name}
          createdAt={ticket.created_at}
          attachments={attachments.filter((a) => !a.message_id)}
        />
      </div>

      {/* 2. Reply form or status message */}
      <div className="mb-4">
        {isClosed ? (
          <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
            This ticket is closed.
          </div>
        ) : isResolved ? (
          <>
            <div className="text-center py-3 text-amber-700 bg-amber-50 rounded-lg border border-amber-200 mb-4 text-sm">
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
      </div>

      {/* 3. Messages — newest first */}
      <CustomerMessageList
        messages={messages}
        attachments={attachments}
        requesterEmail={ticket.requester_email}
      />
      <div ref={threadEndRef} />

      {/* Close Ticket Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Close this ticket?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to close this ticket? You can reopen it later by replying.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={closing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseTicket}
                disabled={closing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {closing ? 'Closing...' : 'Close Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
