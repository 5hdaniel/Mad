'use client';

/**
 * useProjectDragDrop -- Encapsulates drag-and-drop logic for the project detail page.
 *
 * Handles:
 * - DnD sensor configuration (PointerSensor 8px + KeyboardSensor)
 * - Drag start/end event handlers
 * - Backlog item → sprint assignment
 * - Sprint item → different sprint reassignment
 * - Sprint item → backlog unassignment
 * - No-op on same-container drops
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
import { assignToSprint, removeFromSprint } from '@/lib/pm-queries';
import type { PmBacklogItem } from '@/lib/pm-types';

interface UseProjectDragDropParams {
  onRefresh: () => void;
}

export function useProjectDragDrop({ onRefresh }: UseProjectDragDropParams) {
  const [activeDragItem, setActiveDragItem] = useState<PmBacklogItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.item) {
      setActiveDragItem(data.item as PmBacklogItem);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragItem(null);

      console.log('[DnD] dragEnd:', { activeId: active.id, overId: over?.id });

      if (!over) {
        console.log('[DnD] No drop target');
        return;
      }

      const data = active.data.current;
      if (!data?.item) {
        console.log('[DnD] No item data on active');
        return;
      }

      const item = data.item as PmBacklogItem;
      const sourceContainerId = data.containerId as string;
      const targetContainerId = over.id as string;

      console.log('[DnD] Move:', { itemId: item.id, itemNumber: item.item_number, from: sourceContainerId, to: targetContainerId });

      // No-op: dropped on same container
      if (sourceContainerId === targetContainerId) {
        console.log('[DnD] Same container, no-op');
        return;
      }

      try {
        if (targetContainerId === 'backlog-panel') {
          console.log('[DnD] Unassigning from sprint');
          await removeFromSprint([item.id]);
        } else {
          console.log('[DnD] Assigning to sprint:', targetContainerId);
          await assignToSprint([item.id], targetContainerId);
        }
        console.log('[DnD] Success, refreshing');
        onRefresh();
      } catch (err) {
        console.error('[DnD] Failed to move item:', err);
      }
    },
    [onRefresh]
  );

  return {
    sensors,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
  };
}
