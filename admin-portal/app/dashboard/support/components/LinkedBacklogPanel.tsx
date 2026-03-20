'use client';

/**
 * LinkedBacklogPanel - Links support tickets to PM backlog items
 * TASK-2284: Collapsible panel showing linked backlog items with search + link/unlink.
 *
 * Displayed in the ticket detail sidebar. Admins can:
 * - View linked backlog items with status + link type badges
 * - Search and link new backlog items
 * - Unlink existing items
 * - See "Fix Available" badge when link_type = 'fix' and status = 'completed'
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import {
  getLinkedBacklogItems,
  linkBacklogItem,
  unlinkBacklogItem,
  searchBacklogItems,
} from '@/lib/support-queries';
import type { BacklogLink, BacklogLinkType, BacklogItemSearchResult } from '@/lib/support-types';

interface LinkedBacklogPanelProps {
  ticketId: string;
  isAdmin: boolean;
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

const STATUS_BADGE_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  deferred: 'bg-gray-100 text-gray-600',
  testing: 'bg-purple-100 text-purple-800',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LinkedBacklogPanel({ ticketId, isAdmin }: LinkedBacklogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [links, setLinks] = useState<BacklogLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BacklogItemSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<BacklogLinkType>('related');
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const loadLinks = useCallback(async () => {
    try {
      const data = await getLinkedBacklogItems(ticketId);
      setLinks(data);
    } catch (err) {
      console.error('Failed to load backlog links:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchBacklogItems(searchQuery);
        // Filter out already-linked items
        const linkedIds = new Set(links.map((l) => l.backlog_item_id));
        setSearchResults(results.filter((r) => !linkedIds.has(r.id)));
      } catch (err) {
        console.error('Failed to search backlog items:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, links]);

  async function handleLink(backlogItemId: string) {
    setLinking(true);
    try {
      await linkBacklogItem(ticketId, backlogItemId, selectedLinkType);
      await loadLinks();
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to link backlog item:', err);
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(linkId: string) {
    setUnlinkingId(linkId);
    try {
      await unlinkBacklogItem(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error('Failed to unlink backlog item:', err);
    } finally {
      setUnlinkingId(null);
    }
  }

  function openSearch() {
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-indigo-500" />
          <span>Linked Backlog Items</span>
          {links.length > 0 && (
            <span className="text-xs text-gray-400 font-normal">
              ({links.length})
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Loading state */}
          {loading && (
            <div className="p-3 text-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
            </div>
          )}

          {/* Linked items list */}
          {!loading && links.length === 0 && !showSearch && (
            <div className="p-3 text-xs text-gray-500 text-center">
              No backlog items linked
            </div>
          )}

          {!loading && links.length > 0 && (
            <div className="divide-y divide-gray-100">
              {links.map((link) => {
                const isFixAvailable =
                  link.link_type === 'fix' && link.status === 'completed';

                return (
                  <div
                    key={link.id}
                    className="flex items-start gap-2 px-3 py-2 text-xs group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-gray-500">
                          BACKLOG-{link.item_number}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            LINK_TYPE_COLORS[link.link_type]
                          }`}
                        >
                          {LINK_TYPE_LABELS[link.link_type]}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            STATUS_BADGE_COLORS[link.status ?? ''] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {statusLabel(link.status ?? 'unknown')}
                        </span>
                        {isFixAvailable && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                            Fix Available
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 truncate mt-0.5" title={link.title}>
                        {link.title}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleUnlink(link.id)}
                        disabled={unlinkingId === link.id}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                        title="Unlink"
                      >
                        {unlinkingId === link.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Search / Add section (admin only) */}
          {isAdmin && !showSearch && (
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={openSearch}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              >
                <Plus className="h-3 w-3" />
                Link Backlog Item
              </button>
            </div>
          )}

          {isAdmin && showSearch && (
            <div className="p-3 border-t border-gray-100 space-y-2">
              {/* Link type selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Type:</span>
                {(['fix', 'related', 'duplicate'] as BacklogLinkType[]).map((lt) => (
                  <button
                    key={lt}
                    onClick={() => setSelectedLinkType(lt)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      selectedLinkType === lt
                        ? LINK_TYPE_COLORS[lt] + ' font-medium'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {LINK_TYPE_LABELS[lt]}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or #number..."
                  className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Search results */}
              {searching && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                </div>
              )}

              {!searching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-1">No matching items</p>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLink(item.id)}
                      disabled={linking}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-indigo-50 transition-colors text-left disabled:opacity-50"
                    >
                      <span className="font-mono text-gray-500 flex-shrink-0">
                        #{item.item_number}
                      </span>
                      <span className="text-gray-700 truncate flex-1">
                        {item.title}
                      </span>
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                          STATUS_BADGE_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
