'use client';

/**
 * TicketTable - Support Dashboard
 *
 * Renders the ticket queue as a table with pagination and sortable column headers.
 * Each row navigates to the ticket detail page on click.
 * Sort state is managed by the parent page and passed via props.
 */

import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import type { SupportTicket, TicketStatus, TicketPriority, SearchHighlight, SortColumn, SortDirection } from '@/lib/support-types';
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/support-types';
import type { ColumnKey } from './ColumnSelector';
import { DEFAULT_VISIBLE_COLUMNS } from './ColumnSelector';

interface TicketTableProps {
  tickets: SupportTicket[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  searchActive?: boolean;
  sortColumn?: SortColumn;
  sortDirection?: SortDirection;
  onSort?: (column: SortColumn) => void;
  visibleColumns?: ColumnKey[];
  /** Bulk selection: set of currently selected ticket IDs */
  selectedIds?: Set<string>;
  /** Callback when a single row checkbox is toggled */
  onToggleSelect?: (id: string) => void;
  /** Callback when the select-all header checkbox is toggled */
  onToggleSelectAll?: () => void;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getHighlightLabel(highlight: SearchHighlight): string {
  switch (highlight.field) {
    case 'message': {
      const who = highlight.sender_name || 'Unknown';
      const when = highlight.sent_at ? formatDate(highlight.sent_at) : '';
      return when ? `Message by ${who}, ${when}` : `Message by ${who}`;
    }
    case 'subject':
      return 'Matched in subject';
    case 'description':
      return 'Matched in description';
    case 'requester_name':
    case 'requester_email':
      return 'Requester';
    default:
      return 'Match';
  }
}

function HighlightSnippet({ highlight }: { highlight: SearchHighlight }) {
  // Sanitize HTML to only allow <mark> tags from ts_headline
  const sanitized = DOMPurify.sanitize(highlight.snippet, { ALLOWED_TAGS: ['mark'] });
  const label = getHighlightLabel(highlight);

  return (
    <span className="inline">
      <span className="font-medium text-gray-600">{label}:</span>{' '}
      {/* Content sanitized by DOMPurify - only <mark> tags allowed */}
      <span
        className="[&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:rounded-sm"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </span>
  );
}

interface SortableHeaderProps {
  column: SortColumn;
  label: string;
  currentColumn?: SortColumn;
  currentDirection?: SortDirection;
  onSort?: (column: SortColumn) => void;
  className?: string;
}

function SortableHeader({ column, label, currentColumn, currentDirection, onSort, className = '' }: SortableHeaderProps) {
  const isActive = currentColumn === column;

  return (
    <th
      onClick={() => onSort?.(column)}
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${className}`}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {isActive ? (
          currentDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
          )
        ) : (
          <ArrowDown className="h-3.5 w-3.5 text-gray-300" />
        )}
      </div>
    </th>
  );
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

export function TicketTable({
  tickets,
  totalCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
  loading,
  searchActive,
  sortColumn = 'created_at',
  sortDirection = 'desc',
  onSort,
  visibleColumns = DEFAULT_VISIBLE_COLUMNS,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: TicketTableProps) {
  const router = useRouter();
  const show = (col: ColumnKey) => visibleColumns.includes(col);
  const selectionEnabled = !!selectedIds && !!onToggleSelect && !!onToggleSelectAll;
  const allSelected = selectionEnabled && tickets.length > 0 && tickets.every(t => selectedIds!.has(t.id));
  const someSelected = selectionEnabled && tickets.some(t => selectedIds!.has(t.id)) && !allSelected;
  // +1 for checkbox column when selection is enabled
  const visibleCount = visibleColumns.length + (selectionEnabled ? 1 : 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-50 border-b border-gray-200" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-gray-100 px-6 py-4">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm">No tickets found.</p>
      </div>
    );
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const paginationControls = (position: 'top' | 'bottom') => (
    <div className={`flex items-center justify-between px-4 py-3 bg-gray-50 ${position === 'top' ? 'border-b' : 'border-t'} border-gray-200`}>
      <div className="text-sm text-gray-500">
        Showing {startItem}-{endItem} of {totalCount}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </button>
        <span className="text-sm text-gray-500">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {totalPages > 1 && paginationControls('top')}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectionEnabled && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={onToggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    aria-label="Select all tickets"
                  />
                </th>
              )}
              {show('ticket_number') && (
                <SortableHeader
                  column="ticket_number"
                  label="#"
                  currentColumn={sortColumn}
                  currentDirection={sortDirection}
                  onSort={onSort}
                />
              )}
              {show('subject') && (
                <SortableHeader
                  column="subject"
                  label="Subject"
                  currentColumn={sortColumn}
                  currentDirection={sortDirection}
                  onSort={onSort}
                />
              )}
              {show('status') && (
                <SortableHeader
                  column="status"
                  label="Status"
                  currentColumn={sortColumn}
                  currentDirection={sortDirection}
                  onSort={onSort}
                />
              )}
              {show('priority') && (
                <SortableHeader
                  column="priority"
                  label="Priority"
                  currentColumn={sortColumn}
                  currentDirection={sortDirection}
                  onSort={onSort}
                />
              )}
              {show('category') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
              )}
              {show('requester') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requester
                </th>
              )}
              {show('assignee') && (
                <SortableHeader
                  column="assignee_name"
                  label="Assignee"
                  currentColumn={sortColumn}
                  currentDirection={sortDirection}
                  onSort={onSort}
                />
              )}
              {show('created_at') && (
                <SortableHeader
                  column="created_at"
                  label="Created"
                  currentColumn={sortColumn}
                  currentDirection={sortDirection}
                  onSort={onSort}
                />
              )}
              {show('description') && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tickets.map((ticket) => (
              <Fragment key={ticket.id}>
                <tr
                  onClick={() => router.push(`/dashboard/support/${ticket.id}`)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectionEnabled && selectedIds!.has(ticket.id) ? 'bg-blue-50' : ''}`}
                >
                  {selectionEnabled && (
                    <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds!.has(ticket.id)}
                        onChange={() => onToggleSelect!(ticket.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Select ticket ${ticket.ticket_number}`}
                      />
                    </td>
                  )}
                  {show('ticket_number') && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {ticket.ticket_number}
                    </td>
                  )}
                  {show('subject') && (
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate font-medium [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:rounded-sm">
                      {(() => {
                        const subjectHighlight = searchActive && ticket.search_highlights?.find(
                          h => h.field === 'subject'
                        );
                        if (subjectHighlight) {
                          // Content sanitized by DOMPurify - only <mark> tags allowed
                          const sanitized = DOMPurify.sanitize(subjectHighlight.snippet, { ALLOWED_TAGS: ['mark'] });
                          return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
                        }
                        return ticket.subject;
                      })()}
                    </td>
                  )}
                  {show('status') && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>
                  )}
                  {show('priority') && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                  )}
                  {show('category') && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {ticket.category_name || '-'}
                    </td>
                  )}
                  {show('requester') && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="truncate max-w-[160px] [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:rounded-sm" title={ticket.requester_email}>
                        {(() => {
                          const requesterHighlight = searchActive && ticket.search_highlights?.find(
                            h => h.field === 'requester_name' || h.field === 'requester_email'
                          );
                          if (requesterHighlight) {
                            // Content sanitized by DOMPurify - only <mark> tags allowed
                            const sanitized = DOMPurify.sanitize(requesterHighlight.snippet, { ALLOWED_TAGS: ['mark'] });
                            return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
                          }
                          return ticket.requester_name;
                        })()}
                      </div>
                    </td>
                  )}
                  {show('assignee') && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {ticket.assignee_name || <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                  )}
                  {show('created_at') && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(ticket.created_at)}
                    </td>
                  )}
                  {show('description') && (
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                      <span className="block truncate" title={ticket.description}>
                        {truncateText(ticket.description || '', 100)}
                      </span>
                    </td>
                  )}
                </tr>
                {(() => {
                  const snippetHighlight = searchActive && ticket.search_highlights?.find(
                    h => h.field === 'description' || h.field === 'message'
                  );
                  return snippetHighlight ? (
                    <tr className="border-b border-gray-100">
                      <td colSpan={visibleCount} className="px-4 py-1.5 bg-gray-50">
                        <div className="flex items-start gap-2 text-xs text-gray-500 pl-4">
                          <HighlightSnippet highlight={snippetHighlight} />
                        </div>
                      </td>
                    </tr>
                  ) : null;
                })()}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {paginationControls('bottom')}
    </div>
  );
}
