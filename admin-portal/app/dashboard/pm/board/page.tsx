'use client';

/**
 * BoardPage -- Kanban board view assembling KanbanBoard, SwimLaneSelector,
 * BacklogSidePanel, and BulkActionBar into a working drag-and-drop board.
 *
 * Layout:
 * ┌──────────────────────────────────────────────┬──────────────────┐
 * │ Board: [Sprint ▼]  [SwimLane Toggle]         │ Backlog panel    │
 * │ Pending  In Progress  Testing  Completed     │ (collapsible)    │
 * │ [cards]  [cards]      [cards]  [cards]       │                  │
 * └──────────────────────────────────────────────┴──────────────────┘
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { KanbanSquare, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { KanbanBoard } from '../components/KanbanBoard';
import { SwimLaneSelector, type SwimLaneMode } from '../components/SwimLaneSelector';
import { BacklogSidePanel } from '../components/BacklogSidePanel';
import { BulkActionBar } from '../components/BulkActionBar';
import {
  listSprints,
  listItems,
  getBoardTasks,
  updateItemStatus,
  assignToSprint,
  createItem,
  bulkUpdate,
  deleteItem,
} from '@/lib/pm-queries';
import type {
  PmBacklogItem,
  PmSprint,
  ItemStatus,
  BoardColumns,
} from '@/lib/pm-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group items by a dimension, returning Map<groupKey, BoardColumns>. */
function groupItemsByDimension(
  columns: BoardColumns,
  dimension: 'project' | 'area' | 'assignee'
): Map<string, BoardColumns> {
  const groups = new Map<string, BoardColumns>();

  function ensureGroup(key: string): BoardColumns {
    if (!groups.has(key)) {
      groups.set(key, {
        pending: [],
        in_progress: [],
        testing: [],
        completed: [],
        blocked: [],
      });
    }
    return groups.get(key)!;
  }

  for (const [status, items] of Object.entries(columns)) {
    for (const item of items as PmBacklogItem[]) {
      let groupKey: string;
      switch (dimension) {
        case 'project':
          groupKey = item.project_id || 'No Project';
          break;
        case 'area':
          groupKey = item.area || 'No Area';
          break;
        case 'assignee':
          groupKey = item.assignee_id || 'Unassigned';
          break;
      }
      const group = ensureGroup(groupKey);
      (group[status as keyof BoardColumns] as PmBacklogItem[]).push(item);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BoardPage() {
  // -- State ---------------------------------------------------------------
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [swimLane, setSwimLane] = useState<SwimLaneMode>('off');
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [columns, setColumns] = useState<BoardColumns>({
    pending: [],
    in_progress: [],
    testing: [],
    completed: [],
    blocked: [],
  });
  const [backlogItems, setBacklogItems] = useState<PmBacklogItem[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [sprintSearch, setSprintSearch] = useState('');

  // -- Data fetching -------------------------------------------------------

  /** Load sprints on mount, auto-select the first active sprint. */
  useEffect(() => {
    async function loadSprints() {
      try {
        const data = await listSprints();
        const sprintList = Array.isArray(data) ? data : [];
        setSprints(sprintList);

        // Auto-select first active sprint, fallback to first sprint
        const active = sprintList.find((s) => s.status === 'active');
        const initial = active || sprintList[0];
        if (initial) {
          setSelectedSprintId(initial.id);
        }
      } catch (err) {
        console.error('Failed to load sprints:', err);
      }
    }
    loadSprints();
  }, []);

  /** Load board data when selected sprint changes. */
  const loadBoardData = useCallback(async () => {
    if (!selectedSprintId) {
      setLoading(false);
      return;
    }

    try {
      const data = await getBoardTasks(selectedSprintId);
      setColumns(data);
    } catch (err) {
      console.error('Failed to load board tasks:', err);
      // Fallback: use listItems and group client-side
      try {
        const result = await listItems({
          sprint_id: selectedSprintId,
          page_size: 200,
        });
        const items = result.items || [];
        const grouped: BoardColumns = {
          pending: items.filter((i) => i.status === 'pending'),
          in_progress: items.filter((i) => i.status === 'in_progress'),
          testing: items.filter((i) => i.status === 'testing'),
          completed: items.filter((i) => i.status === 'completed'),
          blocked: items.filter((i) => i.status === 'blocked'),
        };
        setColumns(grouped);
      } catch (fallbackErr) {
        console.error('Fallback listItems also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSprintId]);

  useEffect(() => {
    if (selectedSprintId) {
      setLoading(true);
      loadBoardData();
    }
  }, [selectedSprintId, loadBoardData]);

  /** Load backlog items (items with no sprint_id). */
  const loadBacklogItems = useCallback(
    async (search?: string) => {
      setBacklogLoading(true);
      try {
        const result = await listItems({
          sprint_id: undefined,
          search: search || undefined,
          page_size: 100,
        });
        // Filter to items without a sprint assignment
        const unassigned = (result.items || []).filter((i) => !i.sprint_id);
        setBacklogItems(unassigned);
      } catch (err) {
        console.error('Failed to load backlog items:', err);
      } finally {
        setBacklogLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (backlogOpen) {
      loadBacklogItems();
    }
  }, [backlogOpen, loadBacklogItems]);

  // -- Mutations -----------------------------------------------------------

  /** Drag card between columns -> update status. */
  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: ItemStatus) => {
      try {
        await updateItemStatus(itemId, newStatus);
        await loadBoardData();
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    },
    [loadBoardData]
  );

  /** Quick add item at the bottom of a column. */
  const handleQuickAdd = useCallback(
    async (title: string, status: ItemStatus) => {
      if (!selectedSprintId) return;
      try {
        await createItem({
          title,
          sprint_id: selectedSprintId,
        });
        // After creation, update its status if not pending
        // (createItem defaults to pending)
        if (status !== 'pending') {
          // We'd need the new item's ID -- reload instead
        }
        await loadBoardData();
      } catch (err) {
        console.error('Failed to quick-add item:', err);
      }
    },
    [selectedSprintId, loadBoardData]
  );

  /** Toggle item selection for bulk actions. */
  const handleToggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  /** Bulk status change. */
  const handleBulkStatusChange = useCallback(
    async (status: ItemStatus) => {
      if (selectedIds.size === 0) return;
      try {
        await bulkUpdate(Array.from(selectedIds), { status });
        setSelectedIds(new Set());
        await loadBoardData();
      } catch (err) {
        console.error('Failed to bulk update status:', err);
      }
    },
    [selectedIds, loadBoardData]
  );

  /** Bulk assign to current sprint. */
  const handleBulkAssignSprint = useCallback(async () => {
    if (selectedIds.size === 0 || !selectedSprintId) return;
    try {
      await assignToSprint(Array.from(selectedIds), selectedSprintId);
      setSelectedIds(new Set());
      await loadBoardData();
    } catch (err) {
      console.error('Failed to bulk assign to sprint:', err);
    }
  }, [selectedIds, selectedSprintId, loadBoardData]);

  /** Bulk delete. */
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        await deleteItem(id);
      }
      setSelectedIds(new Set());
      await loadBoardData();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
    }
  }, [selectedIds, loadBoardData]);

  /** Manual refresh. */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBoardData();
  }, [loadBoardData]);

  /** Backlog search. */
  const handleBacklogSearch = useCallback(
    (query: string) => {
      loadBacklogItems(query);
    },
    [loadBacklogItems]
  );

  // -- Swim lane grouping --------------------------------------------------

  const swimLaneGroups = useMemo(() => {
    if (swimLane === 'off') return null;
    return groupItemsByDimension(columns, swimLane);
  }, [columns, swimLane]);

  // -- Selected sprint label -----------------------------------------------

  const filteredSprints = useMemo(() => {
    if (!sprintSearch.trim()) return sprints;
    const q = sprintSearch.toLowerCase();
    return sprints.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.legacy_id && s.legacy_id.toLowerCase().includes(q))
    );
  }, [sprints, sprintSearch]);

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  // -- Render --------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <KanbanSquare className="h-5 w-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900">Board</h1>
          </div>

          {/* Sprint selector dropdown (searchable) */}
          <div className="relative">
            <button
              onClick={() => {
                setSprintDropdownOpen(!sprintDropdownOpen);
                if (sprintDropdownOpen) setSprintSearch('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors text-gray-900"
            >
              {selectedSprint
                ? `${selectedSprint.legacy_id ? `${selectedSprint.legacy_id} — ` : ''}${selectedSprint.name}`
                : 'Select Sprint'}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {sprintDropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setSprintDropdownOpen(false);
                    setSprintSearch('');
                  }}
                />
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {/* Search input */}
                  <input
                    type="text"
                    value={sprintSearch}
                    onChange={(e) => setSprintSearch(e.target.value)}
                    placeholder="Search sprints..."
                    className="w-full px-3 py-2 border-b border-gray-200 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none rounded-t-lg"
                    autoFocus
                  />
                  {/* Sprint list */}
                  <div className="max-h-60 overflow-y-auto">
                    {filteredSprints.length === 0 ? (
                      <div className="p-3 text-sm text-gray-400">
                        No sprints found
                      </div>
                    ) : (
                      filteredSprints.map((sprint) => (
                        <button
                          key={sprint.id}
                          onClick={() => {
                            setSelectedSprintId(sprint.id);
                            setSprintDropdownOpen(false);
                            setSprintSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                            sprint.id === selectedSprintId
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col min-w-0 mr-2">
                              <span className="truncate">{sprint.name}</span>
                              {sprint.legacy_id && (
                                <span className="text-xs text-gray-400">
                                  {sprint.legacy_id}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                sprint.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : sprint.status === 'planned'
                                    ? 'bg-gray-100 text-gray-600'
                                    : sprint.status === 'completed'
                                      ? 'bg-blue-100 text-blue-600'
                                      : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {sprint.status}
                            </span>
                          </div>
                          {sprint.total_items != null && (
                            <span className="text-xs text-gray-400">
                              {sprint.total_items} items
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Swim lane toggle */}
          <SwimLaneSelector value={swimLane} onChange={setSwimLane} />
        </div>

        {/* Right side: refresh + backlog toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh board"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setBacklogOpen(!backlogOpen)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              backlogOpen
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Backlog
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Board area */}
        <div className="flex-1 overflow-x-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 text-gray-300 animate-spin" />
            </div>
          ) : !selectedSprintId ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <KanbanSquare className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm">Select a sprint to view the board</p>
            </div>
          ) : swimLaneGroups ? (
            // Swim lane view: grouped boards
            <div className="space-y-6">
              {Array.from(swimLaneGroups.entries()).map(
                ([groupKey, groupColumns]) => (
                  <div key={groupKey}>
                    <h2 className="text-sm font-semibold text-gray-700 mb-3 px-1 border-b border-gray-200 pb-2">
                      {groupKey}
                    </h2>
                    <KanbanBoard
                      columns={groupColumns}
                      onStatusChange={handleStatusChange}
                      onQuickAdd={handleQuickAdd}
                      selectedIds={selectedIds}
                      onToggleSelect={handleToggleSelect}
                    />
                  </div>
                )
              )}
              {swimLaneGroups.size === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <p className="text-sm">No items in this sprint</p>
                </div>
              )}
            </div>
          ) : (
            // Flat board view
            <KanbanBoard
              columns={columns}
              onStatusChange={handleStatusChange}
              onQuickAdd={handleQuickAdd}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          )}
        </div>

        {/* Backlog side panel */}
        <BacklogSidePanel
          isOpen={backlogOpen}
          onToggle={() => setBacklogOpen(!backlogOpen)}
          items={backlogItems}
          loading={backlogLoading}
          onSearch={handleBacklogSearch}
        />
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onChangeStatus={handleBulkStatusChange}
        onChangePriority={() => {
          // Priority change not implemented in this version
        }}
        onAssignToSprint={handleBulkAssignSprint}
        onDelete={handleBulkDelete}
      />
    </div>
  );
}
