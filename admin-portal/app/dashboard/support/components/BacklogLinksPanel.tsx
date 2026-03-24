'use client';

/**
 * BacklogLinksPanel - Support Ticket Detail Sidebar
 *
 * Collapsible section showing backlog items linked to the current ticket.
 * Queries support_ticket_backlog_links joined with pm_backlog_items.
 * Displays item number, title, status, priority, and link type badge.
 *
 * If no backlog links exist, the panel is not rendered at all.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getBacklogLinks } from '@/lib/support-queries';
import type { BacklogLinkRow } from '@/lib/support-queries';

interface BacklogLinksPanelProps {
  ticketId: string;
}

const LINK_TYPE_STYLES: Record<string, string> = {
  fix: 'bg-green-100 text-green-700',
  related: 'bg-blue-100 text-blue-700',
  duplicate: 'bg-yellow-100 text-yellow-700',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  deferred: 'bg-gray-100 text-gray-500',
  testing: 'bg-purple-100 text-purple-700',
};

export function BacklogLinksPanel({ ticketId }: BacklogLinksPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<BacklogLinkRow[]>([]);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBacklogLinks(ticketId);
      setLinks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backlog links');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Don't render the panel at all if there are no links and not loading
  if (!loading && !error && links.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Backlog Links ({links.length})
        </span>
        <span className="text-xs text-gray-400">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {expanded && (
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <p className="text-xs text-red-500 py-1">{error}</p>
          ) : (
            <div className="space-y-1.5">
              {links.map((link) => (
                <div key={link.id} className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/dashboard/pm/tasks/${link.backlog_item_id}`}
                      className="text-sm text-gray-700 hover:text-blue-600 font-mono"
                    >
                      BACKLOG-{link.item_number}
                    </Link>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${LINK_TYPE_STYLES[link.link_type] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {link.link_type}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/pm/tasks/${link.backlog_item_id}`}
                    className="block text-sm text-gray-600 hover:text-blue-600 truncate mt-0.5"
                  >
                    {link.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[link.status] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {link.status.replace('_', ' ')}
                    </span>
                    {link.priority && (
                      <span className="text-[10px] text-gray-400 capitalize">
                        {link.priority}
                      </span>
                    )}
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
