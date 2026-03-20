'use client';

/**
 * LinkedTicketsPanel - Shows support tickets linked to a PM backlog item
 * TASK-2284: Bidirectional display of ticket-backlog links.
 *
 * Read-only panel showing support tickets linked to this backlog item.
 * Tickets are linked from the support ticket side; this panel shows
 * the reverse view.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TicketIcon, Loader2 } from 'lucide-react';
import { getLinkedTickets } from '@/lib/support-queries';
import type { LinkedTicketFromBacklog, BacklogLinkType } from '@/lib/support-types';

interface LinkedTicketsPanelProps {
  backlogItemId: string;
}

const LINK_TYPE_LABELS: Record<BacklogLinkType, string> = {
  fix: 'Fix',
  related: 'Related',
  duplicate: 'Duplicate',
};

const LINK_TYPE_COLORS: Record<BacklogLinkType, string> = {
  fix: 'bg-green-100 text-green-700',
  related: 'bg-blue-100 text-blue-700',
  duplicate: 'bg-yellow-100 text-yellow-700',
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-green-100 text-green-800',
  pending: 'bg-orange-100 text-orange-800',
  resolved: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LinkedTicketsPanel({ backlogItemId }: LinkedTicketsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [tickets, setTickets] = useState<LinkedTicketFromBacklog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    try {
      const data = await getLinkedTickets(backlogItemId);
      setTickets(data);
    } catch (err) {
      console.error('Failed to load linked tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [backlogItemId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Don't render panel at all if no tickets and not loading
  if (!loading && tickets.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Support Tickets ({tickets.length})
        </span>
        <span className="text-xs text-gray-400">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {expanded && (
        <div className="mt-2">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          )}

          {!loading && tickets.length > 0 && (
            <div className="space-y-0.5">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="flex items-start gap-2 py-1.5">
                  <TicketIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/support/${ticket.ticket_id}`}
                      className="block text-sm text-gray-700 hover:text-blue-600 truncate"
                    >
                      TKT-{String(ticket.ticket_number).padStart(4, '0')} {ticket.subject}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          TICKET_STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusLabel(ticket.status)}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          LINK_TYPE_COLORS[ticket.link_type]
                        }`}
                      >
                        {LINK_TYPE_LABELS[ticket.link_type]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
