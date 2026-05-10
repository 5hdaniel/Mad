'use client';

/**
 * useBoardDragDrop -- Encapsulates drag-and-drop logic for the Kanban board.
 *
 * Handles:
 * - DnD sensor configuration (pointer + keyboard)
 * - Drag start/end event handlers
 * - Board card lookup across columns
 * - Backlog item drag-to-board assignment
 * - Board card drag-to-backlog unassignment
 * - Status changes on column drop
 */

import { useState, useCallback } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { resolveColumnStatus } from '../../components/KanbanBoard';
import {
  parseSwimLaneCellId,
  SWIM_LANE_NEW_PROJECT_ID,
} from '../lib/swim-lane-ids';
import {
  updateItemStatus,
  updateItemField,
  assignToSprint,
} from '@/lib/pm-queries';
import type { PmBacklogItem, ItemStatus, BoardColumns } from '@/lib/pm-types';
import type { SwimLaneMode } from '../../components/SwimLaneSelector';

interface UseBoardDragDropParams {
  columns: BoardColumns;
  selectedSprintId: string;
  swimLane: SwimLaneMode;
  loadBoardData: () => Promise<void>;
  loadBacklogItems: (search?: string) => Promise<void>;
  handleStatusChange: (itemId: string, newStatus: ItemStatus) => Promise<void>;
}

export function useBoardDragDrop({
  columns,
  selectedSprintId,
  swimLane,
  loadBoardData,
  loadBacklogItems,
  handleStatusChange,
}: UseBoardDragDropParams) {
  const [activeDragItem, setActiveDragItem] = useState<PmBacklogItem | null>(null);
  const [activeDragIsBacklog, setActiveDragIsBacklog] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

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
        setActiveDragItem(data.item as PmBacklogItem);
        setActiveDragIsBacklog(true);
      } else {
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
      const overId = over.id as string;

      // Board card dropped onto backlog panel -> unassign from sprint
      if (overId === 'backlog-panel') {
        if (data?.type === 'backlog-item') return;
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

      // Ghost "new project" row -> assign backlog item to sprint (keeps its own project_id).
      // Existing sprint cards dropped here are a no-op (their project is already
      // determined by their own project_id; to change project, drop on a specific row).
      if (overId === SWIM_LANE_NEW_PROJECT_ID) {
        if (data?.type !== 'backlog-item') return;
        const item = data.item as PmBacklogItem;
        if (!selectedSprintId) return;
        try {
          await assignToSprint([item.id], selectedSprintId);
          await loadBoardData();
          await loadBacklogItems();
        } catch (err) {
          console.error('Failed to assign backlog item to sprint (ghost row):', err);
        }
        return;
      }

      const targetStatus = resolveColumnStatus(overId, columns);
      if (!targetStatus) return;

      // Try to extract target project from a structured swim-lane cell id.
      // Only the 'project' swim-lane dimension triggers cross-project moves.
      const parsedCell = parseSwimLaneCellId(overId);
      const targetProjectId =
        parsedCell && parsedCell.dimension === 'project' && swimLane === 'project'
          ? parsedCell.groupKey
          : null;

      if (data?.type === 'backlog-item') {
        const item = data.item as PmBacklogItem;
        if (!selectedSprintId) return;

        try {
          await assignToSprint([item.id], selectedSprintId);
          // If dropped onto a specific project row whose key differs from the
          // item's current project_id, move it to that project.
          if (
            targetProjectId &&
            targetProjectId !== 'No Project' &&
            item.project_id !== targetProjectId
          ) {
            await updateItemField(item.id, 'project_id', targetProjectId);
          }
          if (targetStatus !== 'pending') {
            await updateItemStatus(item.id, targetStatus);
          }
          await loadBoardData();
          await loadBacklogItems();
        } catch (err) {
          console.error('Failed to assign backlog item to board:', err);
        }
      } else {
        const itemId = active.id as string;

        // Find the current item to compare current project + status.
        let currentStatus: ItemStatus | null = null;
        let currentItem: PmBacklogItem | null = null;
        for (const [status, items] of Object.entries(columns)) {
          const found = (items as PmBacklogItem[]).find((i) => i.id === itemId);
          if (found) {
            currentStatus = status as ItemStatus;
            currentItem = found;
            break;
          }
        }
        if (!currentItem || !currentStatus) return;

        const statusChanged = currentStatus !== targetStatus;
        // Cross-project move only applies in project swim-lane mode and when
        // the target row represents a real project (not "No Project").
        const projectChanged =
          targetProjectId !== null &&
          targetProjectId !== 'No Project' &&
          currentItem.project_id !== targetProjectId;

        if (!statusChanged && !projectChanged) return;

        try {
          if (projectChanged && statusChanged) {
            // Both changes: run in parallel, then refresh once.
            await Promise.all([
              updateItemField(itemId, 'project_id', targetProjectId!),
              updateItemStatus(itemId, targetStatus),
            ]);
            await loadBoardData();
          } else if (projectChanged) {
            await updateItemField(itemId, 'project_id', targetProjectId!);
            await loadBoardData();
          } else if (statusChanged) {
            // Preserve optimistic-update behavior via handleStatusChange.
            await handleStatusChange(itemId, targetStatus);
          }
        } catch (err) {
          console.error('Failed to apply drag update:', err);
          // Error path: reload to revert any partial optimistic state.
          await loadBoardData();
        }
      }
    },
    [columns, selectedSprintId, swimLane, loadBoardData, loadBacklogItems, handleStatusChange]
  );

  return {
    sensors,
    activeDragItem,
    activeDragIsBacklog,
    handleDragStart,
    handleDragEnd,
  };
}
