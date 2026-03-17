'use client';

/**
 * Backlog Management Page - /dashboard/pm/backlog
 *
 * Main list view for all PM backlog items. Provides:
 * - Stats cards (total open, pending, in progress, blocked, active sprints)
 * - Full-text search (debounced) + client-side ID/legacy_id/description matching
 * - Multi-select filter bar (status, priority, type, area, sprint, project)
 * - Sortable table columns (click to toggle asc/desc)
 * - Saved view configurations
 * - Paginated table (flat) or hierarchy tree view (toggled)
 * - Create item dialog
 *
 * Pattern: Follows admin-portal/app/dashboard/support/page.tsx
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, List, GitBranch } from 'lucide-react';
import { listItems } from '@/lib/pm-queries';
import type { PmBacklogItem, SortableColumn, SortDirection, ItemStatus, ItemPriority, ItemType } from '@/lib/pm-types';
import { TaskStatsCards } from '../components/TaskStatsCards';
import { TaskFilters } from '../components/TaskFilters';
import { TaskTable } from '../components/TaskTable';
import { TaskSearchBar } from '../components/TaskSearchBar';
import { SavedViewSelector } from '../components/SavedViewSelector';
import { HierarchyTree } from '../components/HierarchyTree';
import { CreateTaskDialog } from '../components/CreateTaskDialog';

// ---------------------------------------------------------------------------
// Priority order maps for sorting enum-valued columns
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER: Record<string, number> = {
  blocked: 0,
  in_progress: 1,
  testing: 2,
  reopened: 3,
  pending: 4,
  deferred: 5,
  completed: 6,
  obsolete: 7,
};

const TYPE_ORDER: Record<string, number> = {
  epic: 0,
  feature: 1,
  bug: 2,
  spike: 3,
  chore: 4,
};

// ---------------------------------------------------------------------------
// Client-side sorting helper
// ---------------------------------------------------------------------------

function sortItems(
  items: PmBacklogItem[],
  sortBy: SortableColumn | null,
  sortDir: SortDirection
): PmBacklogItem[] {
  if (!sortBy) return items;

  const sorted = [...items];
  const dir = sortDir === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'item_number':
        cmp = a.item_number - b.item_number;
        break;
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'type':
        cmp = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
        break;
      case 'status':
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        break;
      case 'priority':
        cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        break;
      case 'area':
        cmp = (a.area || '').localeCompare(b.area || '');
        break;
      case 'est_tokens':
        cmp = (a.est_tokens ?? 0) - (b.est_tokens ?? 0);
        break;
      case 'created_at':
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return cmp * dir;
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// Client-side enhanced search: matches item_number, legacy_id, description
// ---------------------------------------------------------------------------

function matchesEnhancedSearch(item: PmBacklogItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();

  // Match item number (e.g., "682" matches item #682)
  if (String(item.item_number).includes(q)) return true;

  // Match legacy ID (e.g., "BACKLOG-798")
  if (item.legacy_id && item.legacy_id.toLowerCase().includes(q)) return true;

  // Match title (supplement server-side full-text search with simple substring)
  if (item.title.toLowerCase().includes(q)) return true;

  // Match description text
  if (item.description && item.description.toLowerCase().includes(q)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Client-side multi-value filtering
// ---------------------------------------------------------------------------

function matchesMultiFilters(
  item: PmBacklogItem,
  statuses: string[],
  priorities: string[],
  types: string[],
  areas: string[],
  sprintIds: string[],
  projectIds: string[]
): boolean {
  if (statuses.length > 0 && !statuses.includes(item.status)) return false;
  if (priorities.length > 0 && !priorities.includes(item.priority)) return false;
  if (types.length > 0 && !types.includes(item.type)) return false;
  if (areas.length > 0 && !(item.area && areas.includes(item.area))) return false;
  if (sprintIds.length > 0 && !(item.sprint_id && sprintIds.includes(item.sprint_id))) return false;
  if (projectIds.length > 0 && !(item.project_id && projectIds.includes(item.project_id))) return false;
  return true;
}

export default function BacklogPage() {
  const router = useRouter();

  // Items state
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Multi-select filter state (arrays instead of single values)
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [sprintFilters, setSprintFilters] = useState<string[]>([]);
  const [projectFilters, setProjectFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState<SortableColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // View mode
  const [treeMode, setTreeMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const pageSize = 50;

  // ---------------------------------------------------------------------------
  // Data loading: fetch large page from RPC, apply client-side filtering/sorting
  // ---------------------------------------------------------------------------
  // Strategy: When multi-select filters are active, we pass single-value filters
  // to the RPC when only 1 value is selected (optimization), otherwise fetch all
  // and filter client-side. For search, we pass to RPC for full-text, then
  // supplement with client-side matching.

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // Determine what to pass to RPC vs. filter client-side
      const rpcStatus = statusFilters.length === 1 ? (statusFilters[0] as ItemStatus) : null;
      const rpcPriority = priorityFilters.length === 1 ? (priorityFilters[0] as ItemPriority) : null;
      const rpcType = typeFilters.length === 1 ? (typeFilters[0] as ItemType) : null;
      const rpcArea = areaFilters.length === 1 ? areaFilters[0] : null;
      const rpcSprint = sprintFilters.length === 1 ? sprintFilters[0] : null;
      const rpcProject = projectFilters.length === 1 ? projectFilters[0] : null;

      // For enhanced search we still pass to RPC for full-text matching,
      // but also supplement with client-side matching on ID/legacy_id/description.
      // When multi-filters are active, we need to fetch a larger page to account
      // for client-side filtering reducing the result set.
      const needsClientFilter =
        statusFilters.length > 1 ||
        priorityFilters.length > 1 ||
        typeFilters.length > 1 ||
        areaFilters.length > 1 ||
        sprintFilters.length > 1 ||
        projectFilters.length > 1;

      // Fetch a large batch when client-side filtering will reduce results
      const fetchSize = needsClientFilter ? 500 : pageSize;

      const data = await listItems({
        status: rpcStatus,
        priority: rpcPriority,
        type: rpcType,
        area: rpcArea,
        sprint_id: rpcSprint,
        project_id: rpcProject,
        search: searchQuery || undefined,
        parent_id: treeMode ? null : undefined,
        page: needsClientFilter ? 1 : page,
        page_size: fetchSize,
      });

      let filteredItems = data.items;

      // Apply client-side multi-value filtering when more than 1 value selected
      if (needsClientFilter) {
        filteredItems = filteredItems.filter((item) =>
          matchesMultiFilters(item, statusFilters, priorityFilters, typeFilters, areaFilters, sprintFilters, projectFilters)
        );
      }

      const clientTotal = needsClientFilter ? filteredItems.length : data.total_count;

      // Client-side pagination when client-side filtering is active
      if (needsClientFilter) {
        const start = (page - 1) * pageSize;
        filteredItems = filteredItems.slice(start, start + pageSize);
      }

      setItems(filteredItems);
      setTotalCount(clientTotal);
    } catch (err) {
      console.error('Failed to load backlog items:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilters, priorityFilters, typeFilters, areaFilters, sprintFilters, projectFilters, searchQuery, page, treeMode]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // ---------------------------------------------------------------------------
  // Derived: sort the current page of items client-side
  // ---------------------------------------------------------------------------

  const sortedItems = useMemo(
    () => sortItems(items, sortBy, sortDir),
    [items, sortBy, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ---------------------------------------------------------------------------
  // Filter change handlers -- reset page to 1
  // ---------------------------------------------------------------------------

  function handleStatusesChange(statuses: string[]) {
    setStatusFilters(statuses);
    setPage(1);
  }

  function handlePrioritiesChange(priorities: string[]) {
    setPriorityFilters(priorities);
    setPage(1);
  }

  function handleTypesChange(types: string[]) {
    setTypeFilters(types);
    setPage(1);
  }

  function handleAreasChange(areas: string[]) {
    setAreaFilters(areas);
    setPage(1);
  }

  function handleSprintIdsChange(sprintIds: string[]) {
    setSprintFilters(sprintIds);
    setPage(1);
  }

  function handleProjectIdsChange(projectIds: string[]) {
    setProjectFilters(projectIds);
    setPage(1);
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  // ---------------------------------------------------------------------------
  // Sort handler: toggle direction, or set new column
  // ---------------------------------------------------------------------------

  function handleSort(column: SortableColumn) {
    if (sortBy === column) {
      // Toggle direction, or clear if already desc
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        // Clear sort
        setSortBy(null);
        setSortDir('asc');
      }
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  // ---------------------------------------------------------------------------
  // Saved view load handler
  // ---------------------------------------------------------------------------

  function handleLoadView(filters: Record<string, unknown>) {
    // Support both old single-value and new array formats
    const toArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val as string[];
      if (typeof val === 'string' && val) return [val];
      return [];
    };

    setStatusFilters(toArray(filters.status ?? filters.statuses));
    setPriorityFilters(toArray(filters.priority ?? filters.priorities));
    setTypeFilters(toArray(filters.type ?? filters.types));
    setAreaFilters(toArray(filters.area ?? filters.areas));
    setSprintFilters(toArray(filters.sprint_id ?? filters.sprintIds));
    setProjectFilters(toArray(filters.project_id ?? filters.projectIds));
    setPage(1);
  }

  function handleItemClick(itemId: string) {
    router.push(`/dashboard/pm/tasks/${itemId}`);
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backlog</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} items</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tree toggle */}
          <button
            onClick={() => setTreeMode(!treeMode)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${
              treeMode
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            {treeMode ? <GitBranch className="h-4 w-4" /> : <List className="h-4 w-4" />}
            {treeMode ? 'Tree View' : 'Flat View'}
          </button>
          {/* Create button */}
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Item
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <TaskStatsCards />

      {/* Search Bar + Saved View Selector */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <TaskSearchBar onSearch={handleSearch} />
        </div>
        <SavedViewSelector
          currentFilters={{
            statuses: statusFilters,
            priorities: priorityFilters,
            types: typeFilters,
            areas: areaFilters,
            sprintIds: sprintFilters,
            projectIds: projectFilters,
          }}
          onLoadView={handleLoadView}
        />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TaskFilters
          statuses={statusFilters}
          priorities={priorityFilters}
          types={typeFilters}
          areas={areaFilters}
          sprintIds={sprintFilters}
          projectIds={projectFilters}
          onStatusesChange={handleStatusesChange}
          onPrioritiesChange={handlePrioritiesChange}
          onTypesChange={handleTypesChange}
          onAreasChange={handleAreasChange}
          onSprintIdsChange={handleSprintIdsChange}
          onProjectIdsChange={handleProjectIdsChange}
        />
      </div>

      {/* Main content: Table or Tree */}
      {treeMode ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 bg-gray-200 rounded w-3/4" />
              ))}
            </div>
          ) : (
            <HierarchyTree items={sortedItems} onItemClick={handleItemClick} />
          )}
        </div>
      ) : (
        <TaskTable
          items={sortedItems}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={loading}
          searchActive={!!searchQuery}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {/* Create Item Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadItems}
      />
    </div>
  );
}
