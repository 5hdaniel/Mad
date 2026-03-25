import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
  SortColumn,
  SortDirection,
} from '@/lib/support-types';
import { loadColumnPreferences, saveColumnPreferences } from '../components/ColumnSelector';
import type { ColumnKey } from '../components/ColumnSelector';

/**
 * Shared state & handlers for the support ticket table, used by both
 * the Queue page (page.tsx) and the My Tickets page (my-tickets/page.tsx).
 *
 * Covers: sort, bulk selection, column visibility, filters, search,
 * saved-view load, and page management.
 */
export function useTicketTableState(tickets: SupportTicket[]) {
  // Sort
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadColumnPreferences);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Page
  const [page, setPage] = useState(1);

  // --- Handlers ---

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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

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

  /**
   * Load a saved view's filters into state. Handles the common filter keys;
   * callers can extend for page-specific keys (e.g. assignee_id).
   */
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

  /** Base current-filters for saved views (without page-specific keys). */
  const currentFilters = useMemo(() => ({
    status: statusFilter,
    priority: priorityFilter,
    category_id: categoryFilter,
    sort_column: sortColumn,
    sort_direction: sortDirection,
    visible_columns: visibleColumns,
  }), [statusFilter, priorityFilter, categoryFilter, sortColumn, sortDirection, visibleColumns]);

  // Clear selection when any filter, page, or sort changes
  useEffect(() => {
    clearSelection();
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery, page, sortColumn, sortDirection, clearSelection]);

  return {
    // Sort
    sortColumn,
    sortDirection,
    handleSort,
    // Selection
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    // Columns
    visibleColumns,
    handleColumnsChange,
    // Filters
    statusFilter,
    priorityFilter,
    categoryFilter,
    searchQuery,
    handleStatusChange,
    handlePriorityChange,
    handleCategoryChange,
    handleSearch,
    // Saved views
    currentFilters,
    handleLoadView,
    // Page
    page,
    setPage,
    // Setters for page-specific extensions
    setStatusFilter,
    setPriorityFilter,
    setCategoryFilter,
    setSortColumn,
    setSortDirection,
    setVisibleColumns,
  };
}
