'use client';

/**
 * useBoardData -- Data fetching and mutation logic for the Kanban board.
 *
 * Encapsulates:
 * - Sprint, project, user, and label loading
 * - Board column data fetching with fallback
 * - Backlog item loading
 * - Status change (optimistic update)
 * - Quick add item
 * - Item selection toggle
 * - Bulk operations (status, sprint assign, user assign, delete)
 * - Board state persistence to localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import type { SwimLaneMode } from '../../components/SwimLaneSelector';
import {
  listSprints,
  listItems,
  listProjects,
  getBoardTasks,
  updateItemStatus,
  createItem,
  assignItem,
  bulkUpdate,
  bulkDelete,
  assignToSprint,
  listAssignableUsers,
  listLabels,
} from '@/lib/pm-queries';
import type {
  PmBacklogItem,
  PmSprint,
  PmLabel,
  ItemStatus,
  BoardColumns,
  CreateItemParams,
} from '@/lib/pm-types';
import type { AssignableUser } from '../../components/KanbanCard';

// ---------------------------------------------------------------------------
// Board state persistence
// ---------------------------------------------------------------------------

const BOARD_STATE_KEY = 'pm-board-state';

interface BoardPersistedState {
  selectedSprintId: string;
  swimLane: SwimLaneMode;
  collapsedLanes: string[];
  compactCards?: boolean;
}

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
// Hook
// ---------------------------------------------------------------------------

export function useBoardData() {
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
    pending: [], in_progress: [], testing: [], completed: [],
    blocked: [], deferred: [], obsolete: [], reopened: [],
  });
  const [backlogItems, setBacklogItems] = useState<PmBacklogItem[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

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
        selectedSprintId, swimLane,
        collapsedLanes: Array.from(collapsedLanes), compactCards,
      };
      localStorage.setItem(BOARD_STATE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to persist board state to localStorage:', err);
    }
  }, [selectedSprintId, swimLane, collapsedLanes, compactCards]);

  // -- Data fetching -------------------------------------------------------

  useEffect(() => {
    async function loadSprints() {
      try {
        const data = await listSprints();
        const sprintList = Array.isArray(data) ? data : [];
        setSprints(sprintList);
        if (!selectedSprintId) {
          const active = sprintList.find((s) => s.status === 'active');
          const initial = active || sprintList[0];
          if (initial) setSelectedSprintId(initial.id);
        }
      } catch (err) {
        console.error('Failed to load sprints:', err);
      }
    }
    loadSprints();
  }, []);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await listProjects();
        const projects = Array.isArray(data) ? data : [];
        const map = new Map<string, string>();
        for (const p of projects) map.set(p.id, p.name);
        setNameMap(map);
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    }
    loadProjects();
  }, []);

  const refreshLabels = useCallback(() => {
    listLabels().then(setBoardLabels).catch((err) => console.error('Failed to load labels:', err));
  }, []);

  useEffect(() => {
    listAssignableUsers().then(setBoardUsers).catch((err) => console.error('Failed to load users:', err));
    refreshLabels();
  }, [refreshLabels]);

  const loadBoardData = useCallback(async () => {
    if (!selectedSprintId) { setLoading(false); return; }
    try {
      const data = await getBoardTasks(selectedSprintId);
      setColumns(data);
    } catch (err) {
      console.error('Failed to load board tasks:', err);
      try {
        const result = await listItems({ sprint_id: selectedSprintId, page_size: 200 });
        const items = result.items || [];
        setColumns({
          pending: items.filter((i) => i.status === 'pending'),
          in_progress: items.filter((i) => i.status === 'in_progress'),
          testing: items.filter((i) => i.status === 'testing'),
          completed: items.filter((i) => i.status === 'completed'),
          blocked: items.filter((i) => i.status === 'blocked'),
          deferred: items.filter((i) => i.status === 'deferred'),
          obsolete: items.filter((i) => i.status === 'obsolete'),
          reopened: items.filter((i) => i.status === 'reopened'),
        });
      } catch (fallbackErr) {
        console.error('Fallback listItems also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSprintId]);

  const handleItemUpdated = useCallback(() => {
    loadBoardData();
    refreshLabels();
  }, [loadBoardData, refreshLabels]);

  useEffect(() => {
    if (selectedSprintId) { setLoading(true); loadBoardData(); }
  }, [selectedSprintId, loadBoardData]);

  const loadBacklogItems = useCallback(async (search?: string) => {
    setBacklogLoading(true);
    try {
      const result = await listItems({ unassigned_only: true, search: search || undefined, page_size: 100 });
      setBacklogItems(result.items || []);
    } catch (err) {
      console.error('Failed to load backlog items:', err);
    } finally {
      setBacklogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (backlogOpen) loadBacklogItems();
  }, [backlogOpen, loadBacklogItems]);

  // -- Mutations -----------------------------------------------------------

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: ItemStatus) => {
      setColumns((prev) => {
        const updated = { ...prev };
        let movedItem: PmBacklogItem | null = null;
        for (const status of Object.keys(updated) as ItemStatus[]) {
          const items = updated[status] as PmBacklogItem[];
          const idx = items.findIndex((i) => i.id === itemId);
          if (idx !== -1) {
            movedItem = { ...items[idx], status: newStatus };
            updated[status] = [...items.slice(0, idx), ...items.slice(idx + 1)] as typeof items;
            break;
          }
        }
        if (movedItem) {
          const target = (updated[newStatus] || []) as PmBacklogItem[];
          (updated as Record<string, PmBacklogItem[]>)[newStatus] = [...target, movedItem];
        }
        return updated;
      });
      try {
        await updateItemStatus(itemId, newStatus);
      } catch (err) {
        console.error('Failed to update status:', err);
        await loadBoardData();
      }
    },
    [loadBoardData]
  );

  const handleQuickAdd = useCallback(
    async (title: string, status: ItemStatus, groupKey?: string) => {
      if (!selectedSprintId) return;
      try {
        const params: CreateItemParams = { title, sprint_id: selectedSprintId };
        const isRealGroup = groupKey && !groupKey.startsWith('No ') && groupKey !== 'Unassigned';
        if (isRealGroup && swimLane === 'project') params.project_id = groupKey;
        else if (isRealGroup && swimLane === 'area') params.area = groupKey;
        const created = await createItem(params);
        if (status !== 'pending' && created.id) await updateItemStatus(created.id, status);
        if (isRealGroup && swimLane === 'assignee' && created.id) {
          try { await assignItem(created.id, groupKey); } catch { /* non-fatal */ }
        }
        await loadBoardData();
      } catch (err) {
        console.error('Failed to quick-add item:', err);
      }
    },
    [selectedSprintId, swimLane, loadBoardData]
  );

  const handleToggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  const handleBulkStatusChange = useCallback(async (status: ItemStatus) => {
    if (selectedIds.size === 0) return;
    setBulkError(null);
    try {
      await bulkUpdate(Array.from(selectedIds), { status });
      setSelectedIds(new Set());
      await loadBoardData();
    } catch (err) {
      console.error('Failed to bulk update status:', err);
      setBulkError('Failed to update status. Please try again.');
    }
  }, [selectedIds, loadBoardData]);

  const handleBulkAssignSprint = useCallback(async () => {
    if (selectedIds.size === 0 || !selectedSprintId) return;
    try {
      await assignToSprint(Array.from(selectedIds), selectedSprintId);
      setSelectedIds(new Set());
      await loadBoardData();
    } catch (err) {
      console.error('Failed to bulk assign to sprint:', err);
      setBulkError('Failed to assign to sprint. Please try again.');
    }
  }, [selectedIds, selectedSprintId, loadBoardData]);

  const handleBulkAssignUser = useCallback(async (assigneeId: string | null) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdate(Array.from(selectedIds), { assignee_id: assigneeId });
      setSelectedIds(new Set());
      await loadBoardData();
    } catch (err) {
      console.error('Failed to bulk assign user:', err);
      setBulkError('Failed to assign user. Please try again.');
    }
  }, [selectedIds, loadBoardData]);

  const handleBulkDeleteRequest = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }, [selectedIds]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBoardData();
  }, [loadBoardData]);

  const handleBacklogSearch = useCallback((query: string) => {
    loadBacklogItems(query);
  }, [loadBacklogItems]);

  return {
    // State
    sprints,
    selectedSprintId,
    setSelectedSprintId,
    swimLane,
    setSwimLane,
    backlogOpen,
    setBacklogOpen,
    columns,
    backlogItems,
    backlogLoading,
    loading,
    refreshing,
    selectedIds,
    setSelectedIds,
    collapsedLanes,
    setCollapsedLanes,
    compactCards,
    setCompactCards,
    nameMap,
    boardUsers,
    boardLabels,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    deleteError,
    bulkError,
    setBulkError,
    // Actions
    toggleLane,
    loadBoardData,
    loadBacklogItems,
    handleItemUpdated,
    handleStatusChange,
    handleQuickAdd,
    handleToggleSelect,
    handleBulkStatusChange,
    handleBulkAssignSprint,
    handleBulkAssignUser,
    handleBulkDeleteRequest,
    handleBulkDeleteConfirm,
    handleRefresh,
    handleBacklogSearch,
  };
}
