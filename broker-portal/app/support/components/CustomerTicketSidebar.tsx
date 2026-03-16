'use client';

/**
 * CustomerTicketSidebar - Broker Portal
 *
 * Read-only sidebar showing ticket metadata: status, priority, category,
 * requester info, and timestamps. Matches the admin portal sidebar layout
 * but without any mutation controls (no dropdowns, no assignment).
 */

import { User, Calendar, Tag } from 'lucide-react';
import type { SupportTicket } from '@/lib/support-types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/support-types';
import { TicketStatusBadge } from './TicketStatusBadge';

interface CustomerTicketSidebarProps {
  ticket: SupportTicket;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function CustomerTicketSidebar({ ticket }: CustomerTicketSidebarProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
      {/* Status */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Status
        </label>
        <div className="flex items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      {/* Priority */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Priority
        </label>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}
        >
          {PRIORITY_LABELS[ticket.priority]}
        </span>
      </div>

      {/* Category */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Category
        </label>
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <Tag className="h-3.5 w-3.5 text-gray-400" />
          {ticket.category_name || 'Uncategorized'}
          {ticket.subcategory_name && (
            <span className="text-gray-400">/ {ticket.subcategory_name}</span>
          )}
        </div>
      </div>

      {/* Requester */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Requester
        </label>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{ticket.requester_name}</div>
            <div className="text-xs text-gray-500">{ticket.requester_email}</div>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="px-4 py-3">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
          Dates
        </label>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Created: {formatDate(ticket.created_at)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3 w-3" />
            Updated: {formatDate(ticket.updated_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
