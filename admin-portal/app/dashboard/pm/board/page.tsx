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
import { KanbanSquare, ChevronDown, ChevronRight, RefreshCw, Loader2, List } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { KanbanBoard, columnCollision, resolveColumnStatus } from '../components/KanbanBoard';
import { SwimLaneSelector, type SwimLaneMode } from '../components/SwimLaneSelector';
import { BacklogSidePanel } from '../components/BacklogSidePanel';
import { BulkActionBar } from '../components/BulkActionBar';
import { KanbanCard } from '../components/KanbanCard';
import {
  listSprints,
  listItems,
  listProjects,
  getBoardTasks,
  updateItemStatus,
  updateItemField,
  assignToSprint,
  createItem,
  bulkUpdate,
  bulkDelete,
  listAssignableUsers,
  listLabels,
} from '@/lib/pm-queries';
import type {
  PmBacklogItem,
  PmSprint,
  PmLabel,
  ItemStatus,
  BoardColumns,
} from '@/lib/pm-types';
import type { AssignableUser } from '../components/KanbanCard';

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
        deferred: [],
        obsolete: [],
        reopened: [],
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
// Board state persistence
// ---------------------------------------------------------------------------

const BOARD_STATE_KEY = 'pm-board-state';

interface BoardPersistedState {
  selectedSprintId: string;
  swimLane: SwimLaneMode;
  collapsedLanes: string[]; // Set serialized as array
  compactCards?: boolean;
}

/** Read persisted board state from localStorage (returns null on failure). */
function readPersistedBoardState(): BoardPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(BOARD_STATE_KEY);
    if (saved) return JSON.parse(saved) as BoardPersistedState;
  } catch (err) {
    console.error('Failed to read board state from localStorage:', err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BoardPage() {
  // -- State ---------------------------------------------------------------
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const persisted = readPersistedBoardState();
    return persisted?.selectedSprintId || '';
  });
  const [swimLane, setSwimLane] = useState<SwimLaneMode>(() => {
    const persisted = readPersistedBoardState();
    return persisted?.swimLane || 'project';
  });
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [columns, setColumns] = useState<BoardColumns>({
    pending: [],
    in_progress: [],
    testing: [],
    completed: [],
    blocked: [],
    deferred: [],
    obsolete: [],
    reopened: [],
  });
  const [backlogItems, setBacklogItems] = useState<PmBacklogItem[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [sprintSearch, setSprintSearch] = useState('');
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(() => {
    const persisted = readPersistedBoardState();
    return persisted?.collapsedLanes ? new Set(persisted.collapsedLanes) : new Set();
  });
  const [compactCards, setCompactCards] = useState<boolean>(() => {
    const persisted = readPersistedBoardState();
    return persisted?.compactCards ?? false;
  });
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [boardUsers, setBoardUsers] = useState<AssignableUser[]>([]);
  const [boardLabels, setBoardLabels] = useState<PmLabel[]>([]);
  const [activeDragItem, setActiveDragItem] = useState<PmBacklogItem | null>(null);
  const [activeDragIsBacklog, setActiveDragIsBacklog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // -- DnD sensors (shared by board cards AND backlog panel items) ----------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const toggleLane = useCallback((laneKey: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneKey)) next.delete(laneKey);
      else next.add(laneKey);
      return next;
    });
  }, []);

  // -- Persist board UI state to localStorage ------------------------------
  useEffect(() => {
    try {
      const state: BoardPersistedState = {
        selectedSprintId,
        swimLane,
        collapsedLanes: Array.from(collapsedLanes),
        compactCards,
      };
      localStorage.setItem(BOARD_STATE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to persist board state to localStorage:', err);
    }
  }, [selectedSprintId, swimLane, collapsedLanes, compactCards]);

  // -- Data fetching -------------------------------------------------------

  /** Load sprints on mount, auto-select the first active sprint. */
  useEffect(() => {
    async function loadSprints() {
      try {
        const data = await listSprints();
        const sprintList = Array.isArray(data) ? data : [];
        setSprints(sprintList);

        // Auto-select first active sprint only if no persisted sprint
        // (selectedSprintId is initialized from localStorage synchronously)
        if (!selectedSprintId) {
          const active = sprintList.find((s) => s.status === 'active');
          const initial = active || sprintList[0];
          if (initial) {
            setSelectedSprintId(initial.id);
          }
        }
      } catch (err) {
        console.error('Failed to load sprints:', err);
      }
    }
    loadSprints();
  }, []);

  /** Load projects for swim lane name lookup. */
  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await listProjects();
        const projects = Array.isArray(data) ? data : [];
        const map = new Map<string, string>();
        for (const p of projects) {
          map.set(p.id, p.name);
        }
        setNameMap(map);
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    }
    loadProjects();
  }, []);

  /** Load assignable users and labels at board level for inline editing. */
  const refreshLabels = useCallback(() => {
    listLabels().then(setBoardLabels).catch((err) => console.error('Failed to load labels:', err));
  }, []);

  useEffect(() => {
    listAssignableUsers().then(setBoardUsers).catch((err) => console.error('Failed to load users:', err));
    refreshLabels();
  }, [refreshLabels]);

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
          deferred: items.filter((i) => i.status === 'deferred'),
          obsolete: items.filter((i) => i.status === 'obsolete'),
          reopened: items.filter((i) => i.status === 'reopened'),
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

  /** Refresh board data AND labels (used as onItemUpdated callback). */
  const handleItemUpdated = useCallback(() => {
    loadBoardData();
    refreshLabels();
  }, [loadBoardData, refreshLabels]);

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
          unassigned_only: true,
          search: search || undefined,
          page_size: 100,
        });
        setBacklogItems(result.items || []);
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

  /** Bulk assign to user via single RPC call. */
  const handleBulkAssignUser = useCallback(
    async (assigneeId: string | null) => {
      if (selectedIds.size === 0) return;
      try {
        await bulkUpdate(Array.from(selectedIds), { assignee_id: assigneeId });
        setSelectedIds(new Set());
        await loadBoardData();
      } catch (err) {
        console.error('Failed to bulk assign user:', err);
      }
    },
    [selectedIds, loadBoardData]
  );

  /** Show bulk delete confirmation dialog. */
  const handleBulkDeleteRequest = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }, [selectedIds]);

  /** Execute bulk delete after confirmation. */
  const handleBulkDeleteConfirm = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      await loadBoardData();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      setDeleteError('Failed to delete items. Please try again.');
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

  // -- Drag-and-drop handlers (shared DndContext) ---------------------------

  /** Find a board item across all columns. */
  const findBoardItem = useCallback(
    (id: string): PmBacklogItem | undefined => {
      for (const items of Object.values(columns)) {
        const item = (items as PmBacklogItem[]).find((i) => i.id === id);
        if (item) return item;
      }
      return undefined;
    },
    [columns]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const data = active.data.current;

      if (data?.type === 'backlog-item') {
        // Dragging from backlog panel
        setActiveDragItem(data.item as PmBacklogItem);
        setActiveDragIsBacklog(true);
      } else {
        // Dragging a board card
        const item = findBoardItem(active.id as string);
        if (item) {
          setActiveDragItem(item);
          setActiveDragIsBacklog(false);
        }
      }
    },
    [findBoardItem]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragItem(null);
      setActiveDragIsBacklog(false);

      if (!over) return;

      const data = active.data.current;

      // Board card dropped onto backlog panel -> unassign from sprint
      if (over.id === 'backlog-panel') {
        if (data?.type === 'backlog-item') return; // already in backlog, ignore
        const itemId = active.id as string;
        try {
          await updateItemField(itemId, 'sprint_id', null);
          await loadBoardData();
          await loadBacklogItems();
        } catch (err) {
          console.error('Failed to unassign item from sprint:', err);
        }
        return;
      }

      const targetStatus = resolveColumnStatus(over.id as string, columns);
      if (!targetStatus) return;

      if (data?.type === 'backlog-item') {
        // Backlog item dropped onto a board column
        const item = data.item as PmBacklogItem;
        if (!selectedSprintId) return;

        try {
          // 1. Assign to current sprint
          await assignToSprint([item.id], selectedSprintId);
          // 2. Set the status to match the target column
          if (targetStatus !== 'pending') {
            await updateItemStatus(item.id, targetStatus);
          }
          // 3. Refresh both board and backlog
          await loadBoardData();
          await loadBacklogItems();
        } catch (err) {
          console.error('Failed to assign backlog item to board:', err);
        }
      } else {
        // Board card dragged between columns (existing behavior)
        const itemId = active.id as string;

        let currentStatus: ItemStatus | null = null;
        for (const [status, items] of Object.entries(columns)) {
          if ((items as PmBacklogItem[]).some((i) => i.id === itemId)) {
            currentStatus = status as ItemStatus;
            break;
          }
        }

        if (currentStatus && currentStatus !== targetStatus) {
          await handleStatusChange(itemId, targetStatus);
        }
      }
    },
    [columns, selectedSprintId, loadBoardData, loadBacklogItems, handleStatusChange]
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
    <div className="flex flex-col h-[calc(100vh)] -m-6">
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
          <SwimLaneSelector
            value={swimLane}
            onChange={(mode) => {
              setSwimLane(mode);
              setCollapsedLanes(new Set());
            }}
          />

          {/* Compact card toggle */}
          <button
            onClick={() => setCompactCards(!compactCards)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
              compactCards
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Compact
          </button>
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

      {/* Main content area -- single DndContext wraps board + backlog panel */}
      <DndContext
        sensors={sensors}
        collisionDetection={columnCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
                  ([groupKey, groupColumns]) => {
                    const itemCount = Object.values(groupColumns).reduce(
                      (sum, items) => sum + (items as PmBacklogItem[]).length,
                      0
                    );
                    const isCollapsed = collapsedLanes.has(groupKey);
                    return (
                      <div key={groupKey}>
                        <button
                          onClick={() => toggleLane(groupKey)}
                          className="flex items-center gap-2 w-full text-left py-2 px-1 border-b border-gray-200 mb-3"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm font-semibold text-gray-700">
                            {nameMap.get(groupKey) || groupKey}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                          </span>
                        </button>
                        {!isCollapsed && (
                          <KanbanBoard
                            columns={groupColumns}
                            onQuickAdd={handleQuickAdd}
                            selectedIds={selectedIds}
                            onToggleSelect={handleToggleSelect}
                            onItemUpdated={handleItemUpdated}
                            users={boardUsers}
                            allLabels={boardLabels}
                            compact={compactCards}
                          />
                        )}
                      </div>
                    );
                  }
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
                onQuickAdd={handleQuickAdd}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onItemUpdated={handleItemUpdated}
                users={boardUsers}
                allLabels={boardLabels}
                compact={compactCards}
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

        {/* Drag overlay -- shows card preview for both board cards and backlog items */}
        <DragOverlay>
          {activeDragItem ? (
            activeDragIsBacklog ? (
              <div className="bg-white border border-blue-300 rounded p-2 shadow-lg rotate-2 max-w-[200px]">
                <span className="text-xs text-gray-400 font-mono">#{activeDragItem.item_number}</span>
                <p className="text-xs text-gray-900 font-medium line-clamp-2 mt-0.5">
                  {activeDragItem.title}
                </p>
              </div>
            ) : (
              <KanbanCard item={activeDragItem} isDragOverlay compact={compactCards} />
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onChangeStatus={handleBulkStatusChange}
        onChangePriority={() => {
          // Priority change not implemented in this version
        }}
        onAssignToSprint={handleBulkAssignSprint}
        onAssignUser={handleBulkAssignUser}
        onDelete={handleBulkDeleteRequest}
      />

      {/* Bulk delete confirmation dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          {/* Dialog */}
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm Delete
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete{' '}
              <span className="font-medium">{selectedIds.size}</span>{' '}
              {selectedIds.size === 1 ? 'item' : 'items'}? This action cannot
              be undone.
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
