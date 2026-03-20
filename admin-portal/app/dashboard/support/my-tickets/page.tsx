'use client';

/**
 * My Tickets Page - Support Dashboard
 *
 * Shows tickets assigned to the currently logged-in agent.
 * Reuses the same TicketTable, TicketFilters, and SearchBar components as the Queue page,
 * but pre-filters all queries by the current user's assignee_id.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Inbox, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { listTickets } from '@/lib/support-queries';
import type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
  SortColumn,
  SortDirection,
} from '@/lib/support-types';
import { TicketFilters } from '../components/TicketFilters';
import { SearchBar } from '../components/SearchBar';
import { BulkActionBar } from '../components/BulkActionBar';
import { ColumnSelector, loadColumnPreferences, saveColumnPreferences } from '../components/ColumnSelector';
import type { ColumnKey } from '../components/ColumnSelector';
import { SavedViewSelector } from '../components/SavedViewSelector';

const TicketTable = dynamic(() => import('../components/TicketTable').then(m => m.TicketTable), { ssr: false });

export default function MyTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Agent-specific stats
  const [myOpen, setMyOpen] = useState(0);
  const [myPending, setMyPending] = useState(0);
  const [myResolved, setMyResolved] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Bulk selection (TASK-2292)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadColumnPreferences);

  const handleColumnsChange = useCallback((columns: ColumnKey[]) => {
    setVisibleColumns(columns);
    saveColumnPreferences(columns);
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = tickets.map(t => t.id);
      const allSelected = allIds.length > 0 && allIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }, [tickets]);

  const handleBulkComplete = useCallback(() => {
    clearSelection();
    loadTicketsRef.current();
    loadMyStatsRef.current();
  }, [clearSelection]);

  const handleTicketUpdated = useCallback(() => {
    loadTicketsRef.current();
    loadMyStatsRef.current();
  }, []);

  const pageSize = 20;

  // Refs to allow handleBulkComplete to call functions without circular deps
  const loadTicketsRef = useRef<() => void>(() => {});
  const loadMyStatsRef = useRef<() => void>(() => {});

  const loadTickets = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await listTickets({
        assignee_id: user.id,
        status: statusFilter,
        priority: priorityFilter,
        category_id: categoryFilter,
        search: searchQuery || undefined,
        page,
        page_size: pageSize,
        sort_by: sortColumn,
        sort_dir: sortDirection,
      });
      setTickets(data.tickets);
      setTotalCount(data.total_count);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error('Failed to load my tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, priorityFilter, categoryFilter, searchQuery, page, sortColumn, sortDirection]);

  // Load agent-specific stats by querying filtered counts
  const loadMyStats = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const [openData, pendingData, resolvedData] = await Promise.all([
        listTickets({ assignee_id: user.id, status: 'in_progress', page: 1, page_size: 1 }),
        listTickets({ assignee_id: user.id, status: 'pending', page: 1, page_size: 1 }),
        listTickets({ assignee_id: user.id, status: 'resolved', page: 1, page_size: 1 }),
      ]);
      setMyOpen(openData.total_count);
      setMyPending(pendingData.total_count);
      setMyResolved(resolvedData.total_count);
    } catch (err) {
      console.error('Failed to load my stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  loadTicketsRef.current = loadTickets;
  loadMyStatsRef.current = loadMyStats;

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadMyStats();
  }, [loadMyStats]);

  // Clear selection when filters, page, or sort change
  useEffect(() => {
    clearSelection();
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery, page, sortColumn, sortDirection, clearSelection]);

  function handleStatusChange(status: TicketStatus | null) {
    setStatusFilter(status);
    setPage(1);
  }

  function handlePriorityChange(priority: TicketPriority | null) {
    setPriorityFilter(priority);
    setPage(1);
  }

  function handleCategoryChange(categoryId: string | null) {
    setCategoryFilter(categoryId);
    setPage(1);
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  // Saved views: capture current filters
  const currentFilters = useMemo(() => ({
    status: statusFilter,
    priority: priorityFilter,
    category_id: categoryFilter,
    sort_column: sortColumn,
    sort_direction: sortDirection,
    visible_columns: visibleColumns,
  }), [statusFilter, priorityFilter, categoryFilter, sortColumn, sortDirection, visibleColumns]);

  const handleLoadView = useCallback((filters: Record<string, unknown>) => {
    setStatusFilter((filters.status as TicketStatus | null) ?? null);
    setPriorityFilter((filters.priority as TicketPriority | null) ?? null);
    setCategoryFilter((filters.category_id as string | null) ?? null);
    if (filters.sort_column) setSortColumn(filters.sort_column as SortColumn);
    if (filters.sort_direction) setSortDirection(filters.sort_direction as SortDirection);
    if (Array.isArray(filters.visible_columns)) {
      const cols = filters.visible_columns as ColumnKey[];
      setVisibleColumns(cols);
      saveColumnPreferences(cols);
    }
    setPage(1);
  }, []);

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection(column === 'created_at' ? 'desc' : 'asc');
      return column;
    });
    setPage(1);
  }, []);

  const statCards = [
    { label: 'My In Progress', value: myOpen, icon: Inbox, color: 'text-blue-600 bg-blue-50' },
    { label: 'My Pending', value: myPending, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'My Resolved', value: myResolved, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">Tickets assigned to you</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4"
            >
              <div className={`rounded-lg p-3 ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '-' : card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Filters + Column Selector */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <TicketFilters
          status={statusFilter}
          priority={priorityFilter}
          categoryId={categoryFilter}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onCategoryChange={handleCategoryChange}
        />
        <div className="flex items-center gap-2">
          <SavedViewSelector
            currentFilters={currentFilters}
            onLoadView={handleLoadView}
          />
          <ColumnSelector
            visibleColumns={visibleColumns}
            onColumnsChange={handleColumnsChange}
          />
        </div>
      </div>

      {/* Ticket Table */}
      <TicketTable
        tickets={tickets}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        searchActive={!!searchQuery}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        visibleColumns={visibleColumns}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onTicketUpdated={handleTicketUpdated}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={clearSelection}
        onComplete={handleBulkComplete}
      />
    </div>
  );
}
