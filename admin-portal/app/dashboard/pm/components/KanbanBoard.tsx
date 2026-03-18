'use client';

/**
 * KanbanBoard -- DndContext container for drag-and-drop status columns.
 *
 * Renders one KanbanColumn per board status and manages the active drag
 * overlay. All data flows through props; the parent page handles RPC calls.
 */

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import type { PmBacklogItem, ItemStatus, BoardColumns, PmLabel } from '@/lib/pm-types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard, type AssignableUser } from './KanbanCard';

/** Statuses that appear as board columns (subset of ItemStatus). */
type BoardStatus = keyof BoardColumns;

// Board columns in display order
const COLUMN_ORDER: BoardStatus[] = [
  'pending',
  'in_progress',
  'testing',
  'completed',
  'blocked',
];

/** Set of valid column IDs for quick lookup. */
const COLUMN_IDS = new Set<string>(COLUMN_ORDER);

/** Custom collision: prefer pointerWithin (exact hit), fall back to closestCenter. */
const columnCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) return within;
  return closestCenter(args);
};

interface KanbanBoardProps {
  columns: BoardColumns;
  onStatusChange: (itemId: string, newStatus: ItemStatus) => Promise<void>;
  onQuickAdd?: (title: string, status: ItemStatus) => Promise<void>;
  /** Optional: items currently selected for bulk actions */
  selectedIds?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
  onItemUpdated?: () => void;
  users?: AssignableUser[];
  allLabels?: PmLabel[];
  /** When true, cards render in compact (title-only) mode */
  compact?: boolean;
}

export function KanbanBoard({
  columns,
  onStatusChange,
  onQuickAdd,
  selectedIds,
  onToggleSelect,
  onItemUpdated,
  users,
  allLabels,
  compact,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<PmBacklogItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Prevent accidental drags
    }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    // Find the item across all columns
    for (const items of Object.values(columns)) {
      const item = (items as PmBacklogItem[]).find((i) => i.id === active.id);
      if (item) {
        setActiveItem(item);
        break;
      }
    }
  }

  /** Resolve an over-target ID to its column status.
   *  If the ID is a column status directly, return it.
   *  Otherwise, find which column contains the item with that ID. */
  function resolveColumnStatus(overId: string): ItemStatus | null {
    if (COLUMN_IDS.has(overId)) return overId as ItemStatus;
    // overId is a card ID — find which column it belongs to
    for (const [status, items] of Object.entries(columns)) {
      if ((items as PmBacklogItem[]).some((i) => i.id === overId)) {
        return status as ItemStatus;
      }
    }
    return null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const itemId = active.id as string;
    const newStatus = resolveColumnStatus(over.id as string);
    if (!newStatus) return;

    // Find current status
    let currentStatus: ItemStatus | null = null;
    for (const [status, items] of Object.entries(columns)) {
      if ((items as PmBacklogItem[]).some((i) => i.id === itemId)) {
        currentStatus = status as ItemStatus;
        break;
      }
    }

    if (currentStatus && currentStatus !== newStatus) {
      await onStatusChange(itemId, newStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-16rem)]">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={columns[status] || []}
            onQuickAdd={
              onQuickAdd ? (title) => onQuickAdd(title, status) : undefined
            }
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onItemUpdated={onItemUpdated}
            users={users}
            allLabels={allLabels}
            compact={compact}
          />
        ))}
      </div>

      {/* Drag overlay -- shows card being dragged */}
      <DragOverlay>
        {activeItem ? (
          <KanbanCard item={activeItem} isDragOverlay compact={compact} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
