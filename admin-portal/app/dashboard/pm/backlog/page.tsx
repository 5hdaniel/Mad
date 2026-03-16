'use client';

/**
 * Backlog Management Page - /dashboard/pm/backlog
 *
 * Main list view for all PM backlog items. Provides:
 * - Stats cards (total open, pending, in progress, blocked, active sprints)
 * - Full-text search (debounced)
 * - Filter bar (status, priority, type, area, sprint, project)
 * - Saved view configurations
 * - Paginated table (flat) or hierarchy tree view (toggled)
 * - Create item dialog
 *
 * Pattern: Follows admin-portal/app/dashboard/support/page.tsx
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, List, GitBranch } from 'lucide-react';
import { listItems } from '@/lib/pm-queries';
import type { PmBacklogItem, ItemStatus, ItemPriority, ItemType } from '@/lib/pm-types';
import { TaskStatsCards } from '../components/TaskStatsCards';
import { TaskFilters } from '../components/TaskFilters';
import { TaskTable } from '../components/TaskTable';
import { TaskSearchBar } from '../components/TaskSearchBar';
import { SavedViewSelector } from '../components/SavedViewSelector';
import { HierarchyTree } from '../components/HierarchyTree';
import { CreateTaskDialog } from '../components/CreateTaskDialog';

export default function BacklogPage() {
  const router = useRouter();

  // Items state
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<ItemStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<ItemPriority | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // View mode
  const [treeMode, setTreeMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const pageSize = 50;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listItems({
        status: statusFilter,
        priority: priorityFilter,
        type: typeFilter,
        area: areaFilter,
        sprint_id: sprintFilter,
        project_id: projectFilter,
        search: searchQuery || undefined,
        parent_id: treeMode ? null : undefined,
        page,
        page_size: pageSize,
      });
      setItems(data.items);
      setTotalCount(data.total_count);
      setTotalPages(Math.ceil(data.total_count / pageSize));
    } catch (err) {
      console.error('Failed to load backlog items:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, typeFilter, areaFilter, sprintFilter, projectFilter, searchQuery, page, treeMode]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Reset to page 1 when filters change
  function handleStatusChange(status: ItemStatus | null) {
    setStatusFilter(status);
    setPage(1);
  }

  function handlePriorityChange(priority: ItemPriority | null) {
    setPriorityFilter(priority);
    setPage(1);
  }

  function handleTypeChange(type: ItemType | null) {
    setTypeFilter(type);
    setPage(1);
  }

  function handleAreaChange(area: string | null) {
    setAreaFilter(area);
    setPage(1);
  }

  function handleSprintChange(sprintId: string | null) {
    setSprintFilter(sprintId);
    setPage(1);
  }

  function handleProjectChange(projectId: string | null) {
    setProjectFilter(projectId);
    setPage(1);
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  function handleLoadView(filters: Record<string, unknown>) {
    setStatusFilter((filters.status as ItemStatus) || null);
    setPriorityFilter((filters.priority as ItemPriority) || null);
    setTypeFilter((filters.type as ItemType) || null);
    setAreaFilter((filters.area as string) || null);
    setSprintFilter((filters.sprint_id as string) || null);
    setProjectFilter((filters.project_id as string) || null);
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
            status: statusFilter,
            priority: priorityFilter,
            type: typeFilter,
            area: areaFilter,
            sprint_id: sprintFilter,
            project_id: projectFilter,
          }}
          onLoadView={handleLoadView}
        />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TaskFilters
          status={statusFilter}
          priority={priorityFilter}
          type={typeFilter}
          area={areaFilter}
          sprintId={sprintFilter}
          projectId={projectFilter}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onTypeChange={handleTypeChange}
          onAreaChange={handleAreaChange}
          onSprintChange={handleSprintChange}
          onProjectChange={handleProjectChange}
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
            <HierarchyTree items={items} onItemClick={handleItemClick} />
          )}
        </div>
      ) : (
        <TaskTable
          items={items}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={loading}
          searchActive={!!searchQuery}
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
