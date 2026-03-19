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
  updateItemStatus,
  updateItemField,
  assignToSprint,
} from '@/lib/pm-queries';
import type { PmBacklogItem, ItemStatus, BoardColumns } from '@/lib/pm-types';

interface UseBoardDragDropParams {
  columns: BoardColumns;
  selectedSprintId: string;
  loadBoardData: () => Promise<void>;
  loadBacklogItems: (search?: string) => Promise<void>;
  handleStatusChange: (itemId: string, newStatus: ItemStatus) => Promise<void>;
}

export function useBoardDragDrop({
  columns,
  selectedSprintId,
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

      // Board card dropped onto backlog panel -> unassign from sprint
      if (over.id === 'backlog-panel') {
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

      const targetStatus = resolveColumnStatus(over.id as string, columns);
      if (!targetStatus) return;

      if (data?.type === 'backlog-item') {
        const item = data.item as PmBacklogItem;
        if (!selectedSprintId) return;

        try {
          await assignToSprint([item.id], selectedSprintId);
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

  return {
    sensors,
    activeDragItem,
    activeDragIsBacklog,
    handleDragStart,
    handleDragEnd,
  };
}
