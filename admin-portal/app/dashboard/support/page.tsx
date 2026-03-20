'use client';

/**
 * Support Dashboard - Ticket Queue Page
 *
 * Main support page at /dashboard/support showing:
 * - Search bar (full-text search via tsvector)
 * - Stats cards (open, unassigned, urgent)
 * - Filter bar (status, priority, category, assignee)
 * - Ticket table with sortable columns and pagination
 * - Create ticket button
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import { listTickets } from '@/lib/support-queries';
import type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
  SortColumn,
  SortDirection,
} from '@/lib/support-types';
import { StatsCards } from './components/StatsCards';
import { TicketFilters } from './components/TicketFilters';
import { CreateTicketDialog } from './components/CreateTicketDialog';
import { BulkActionBar } from './components/BulkActionBar';
import { ColumnSelector, loadColumnPreferences, saveColumnPreferences } from './components/ColumnSelector';
import type { ColumnKey } from './components/ColumnSelector';
import { SavedViewSelector } from './components/SavedViewSelector';

const TicketTable = dynamic(() => import('./components/TicketTable').then(m => m.TicketTable), { ssr: false });
import { SearchBar } from './components/SearchBar';

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
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
  }, [clearSelection]);

  const pageSize = 20;

  // Ref to allow handleBulkComplete to call loadTickets without circular deps
  const loadTicketsRef = useRef<() => void>(() => {});

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTickets({
        status: statusFilter,
        priority: priorityFilter,
        category_id: categoryFilter,
        assignee_id: assigneeFilter,
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
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, assigneeFilter, searchQuery, page, sortColumn, sortDirection]);

  loadTicketsRef.current = loadTickets;

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Clear selection when filters, page, or sort change
  useEffect(() => {
    clearSelection();
  }, [statusFilter, priorityFilter, categoryFilter, assigneeFilter, searchQuery, page, sortColumn, sortDirection, clearSelection]);

  // Reset to page 1 when filters change
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

  function handleAssigneeChange(assigneeId: string | null) {
    setAssigneeFilter(assigneeId);
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
    assignee_id: assigneeFilter,
    sort_column: sortColumn,
    sort_direction: sortDirection,
    visible_columns: visibleColumns,
  }), [statusFilter, priorityFilter, categoryFilter, assigneeFilter, sortColumn, sortDirection, visibleColumns]);

  const handleLoadView = useCallback((filters: Record<string, unknown>) => {
    setStatusFilter((filters.status as TicketStatus | null) ?? null);
    setPriorityFilter((filters.priority as TicketPriority | null) ?? null);
    setCategoryFilter((filters.category_id as string | null) ?? null);
    setAssigneeFilter((filters.assignee_id as string | null) ?? null);
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
        // Toggle direction if same column
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      // New column: default to ascending (except created_at which defaults desc)
      setSortDirection(column === 'created_at' ? 'desc' : 'asc');
      return column;
    });
    setPage(1);
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-sm text-gray-500 mt-1">Manage support tickets</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Ticket
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

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
          assigneeId={assigneeFilter}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onCategoryChange={handleCategoryChange}
          onAssigneeChange={handleAssigneeChange}
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
        onTicketUpdated={loadTickets}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={clearSelection}
        onComplete={handleBulkComplete}
      />

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadTickets}
      />
    </div>
  );
}
