'use client';

/**
 * TicketList - Customer Ticket List
 *
 * Shows tickets for the current user (authenticated) or by email lookup (unauthenticated).
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { listTickets } from '@/lib/support-queries';
import type { SupportTicket } from '@/lib/support-types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/support-types';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TicketList() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lookupEmail, setLookupEmail] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        setIsAuthenticated(true);
        setLookupEmail(user.email);
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Load tickets when we have an email to look up
  useEffect(() => {
    if (!lookupEmail) return;

    setLoading(true);
    setError(null);
    listTickets(lookupEmail)
      .then((data) => {
        setTickets(data.tickets);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load tickets');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lookupEmail]);

  function handleEmailLookup(e: React.FormEvent) {
    e.preventDefault();
    if (emailInput.trim()) {
      setLookupEmail(emailInput.trim());
    }
  }

  // Unauthenticated: prompt to log in or submit a new ticket
  if (!isAuthenticated && !lookupEmail) {
    return (
      <div>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm mb-4">
            Log in to view your support tickets, or submit a new request below.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/login?redirect=/support"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/support/new"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Submit a New Ticket
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm mb-4">
          No tickets found{lookupEmail ? ` for ${lookupEmail}` : ''}.
        </p>
        <Link
          href="/support/new"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Create a new ticket
        </Link>
      </div>
    );
  }

  return (
    <div>
      {lookupEmail && !isAuthenticated && (
        <p className="text-sm text-gray-500 mb-3">Showing tickets for {lookupEmail}</p>
      )}
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/dashboard/support/${ticket.id}`}
            className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">#{ticket.ticket_number}</span>
                  <h3 className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {ticket.category_name && <span>{ticket.category_name}</span>}
                  <span>{formatDate(ticket.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}
                >
                  {PRIORITY_LABELS[ticket.priority]}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}
                >
                  {STATUS_LABELS[ticket.status]}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
