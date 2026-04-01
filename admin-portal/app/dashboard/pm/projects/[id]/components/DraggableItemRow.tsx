'use client';

/**
 * DraggableItemRow -- Flex-based draggable card for project detail page.
 *
 * Uses useDraggable (NOT useSortable) since items are dragged between
 * containers (backlog <-> sprints), not sorted within a list.
 *
 * Layout: item_number | title | status badge | priority badge
 * Visual: opacity-50 when dragging, cursor-grab
 */

import { useDraggable } from '@dnd-kit/core';
import Link from 'next/link';
import type { PmBacklogItem } from '@/lib/pm-types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/lib/pm-types';

interface DraggableItemRowProps {
  item: PmBacklogItem;
  projectId: string;
  /** The container this item belongs to (sprint id or 'backlog-panel') */
  containerId: string;
  /** Render as overlay (no draggable bindings) */
  isDragOverlay?: boolean;
}

export function DraggableItemRow({
  item,
  projectId,
  containerId,
  isDragOverlay = false,
}: DraggableItemRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item, containerId },
    disabled: isDragOverlay,
  });

  const itemUrl = `/dashboard/pm/tasks/${item.id}?from=project&projectId=${projectId}`;

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      className={`flex items-center gap-3 px-3 py-2 rounded-md border bg-white transition-all ${
        isDragging ? 'opacity-50' : ''
      } ${
        isDragOverlay
          ? 'shadow-lg rotate-1 border-blue-300'
          : 'border-gray-200 hover:border-blue-300 cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Item number */}
      <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
        #{item.item_number}
      </span>

      {/* Title */}
      <Link
        href={itemUrl}
        className="flex-1 text-sm text-gray-900 font-medium truncate hover:text-blue-600 hover:underline"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      >
        {item.title}
      </Link>

      {/* Status badge */}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[item.status]}`}
      >
        {STATUS_LABELS[item.status]}
      </span>

      {/* Priority badge */}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${PRIORITY_COLORS[item.priority]}`}
      >
        {PRIORITY_LABELS[item.priority]}
      </span>
    </div>
  );
}
