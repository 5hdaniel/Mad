# Task TASK-2209: Kanban Board Components (KanbanBoard, Column, Card, QuickAdd)

**Status:** Pending
**Backlog ID:** BACKLOG-969
**Sprint:** SPRINT-138
**Phase:** Phase 2a -- Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2209-kanban-board-components`
**Estimated Tokens:** ~30K
**Depends On:** TASK-2208 (@dnd-kit installed)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Build the four core Kanban board components using @dnd-kit: the board container with DndContext, droppable status columns, draggable task cards, and an inline quick-add card. These are the foundational drag-and-drop components that the Board page (TASK-2214) will assemble.

## Non-Goals

- Do NOT build the board page itself (TASK-2214)
- Do NOT implement swim lanes (TASK-2210: SwimLaneSelector)
- Do NOT implement bulk actions (TASK-2210: BulkActionBar)
- Do NOT implement the backlog side panel (TASK-2210: BacklogSidePanel)
- Do NOT implement dependency indicators (TASK-2210: DependencyIndicator)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies (already installed by TASK-2208)

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/KanbanBoard.tsx` (~200 lines)
2. New file: `admin-portal/app/dashboard/pm/components/KanbanColumn.tsx` (~120 lines)
3. New file: `admin-portal/app/dashboard/pm/components/KanbanCard.tsx` (~100 lines)
4. New file: `admin-portal/app/dashboard/pm/components/KanbanQuickAdd.tsx` (~60 lines)

## File Boundaries

### Files to create (owned by this task):

- `admin-portal/app/dashboard/pm/components/KanbanBoard.tsx`
- `admin-portal/app/dashboard/pm/components/KanbanColumn.tsx`
- `admin-portal/app/dashboard/pm/components/KanbanCard.tsx`
- `admin-portal/app/dashboard/pm/components/KanbanQuickAdd.tsx`

### Files this task must NOT modify:

- All existing PM components (TaskTable, TaskFilters, badges, etc.)
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Any page files
- Any files outside admin-portal/

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] KanbanBoard renders a DndContext with columns for: pending, in_progress, testing, completed, blocked
- [ ] KanbanColumn renders as a droppable container with header showing status + item count
- [ ] KanbanCard renders item title, priority badge, assignee avatar/initial, and is draggable
- [ ] Dragging a card from one column to another calls `onStatusChange(itemId, newStatus)` callback
- [ ] KanbanQuickAdd shows an "Add" button that expands to a title input + submit
- [ ] Components accept data via props (no direct RPC calls inside components)
- [ ] Components are properly typed with TypeScript (no `any`)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### KanbanBoard.tsx (~200 lines)

The board container manages the DndContext and handles drag events.

```tsx
'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { PmBacklogItem, ItemStatus, BoardColumns } from '@/lib/pm-types';
import { STATUS_LABELS } from '@/lib/pm-types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

// Board columns in display order
const COLUMN_ORDER: ItemStatus[] = ['pending', 'in_progress', 'testing', 'completed', 'blocked'];

interface KanbanBoardProps {
  columns: BoardColumns;
  onStatusChange: (itemId: string, newStatus: ItemStatus) => Promise<void>;
  onQuickAdd?: (title: string, status: ItemStatus) => Promise<void>;
  /** Optional: items currently selected for bulk actions */
  selectedIds?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
}

export function KanbanBoard({
  columns,
  onStatusChange,
  onQuickAdd,
  selectedIds,
  onToggleSelect,
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    // The "over" container ID is the column status
    const newStatus = over.id as ItemStatus;
    const itemId = active.id as string;

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
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-16rem)]">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={columns[status] || []}
            onQuickAdd={onQuickAdd ? (title) => onQuickAdd(title, status) : undefined}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>

      {/* Drag overlay -- shows card being dragged */}
      <DragOverlay>
        {activeItem ? (
          <KanbanCard item={activeItem} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### KanbanColumn.tsx (~120 lines)

A droppable column that contains sortable cards.

```tsx
'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { PmBacklogItem, ItemStatus } from '@/lib/pm-types';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/pm-types';
import { KanbanCard } from './KanbanCard';
import { KanbanQuickAdd } from './KanbanQuickAdd';

interface KanbanColumnProps {
  status: ItemStatus;
  items: PmBacklogItem[];
  onQuickAdd?: (title: string) => Promise<void>;
  selectedIds?: Set<string>;
  onToggleSelect?: (itemId: string) => void;
}

export function KanbanColumn({
  status,
  items,
  onQuickAdd,
  selectedIds,
  onToggleSelect,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-gray-50 rounded-lg p-3 flex flex-col ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          <span className="text-xs text-gray-400">{items.length}</span>
        </div>
      </div>

      {/* Cards */}
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 min-h-[4rem]">
          {items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              isSelected={selectedIds?.has(item.id)}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(item.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>

      {/* Quick add at bottom */}
      {onQuickAdd && <KanbanQuickAdd onAdd={onQuickAdd} />}
    </div>
  );
}
```

### KanbanCard.tsx (~100 lines)

A draggable card representing a backlog item.

```tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import type { PmBacklogItem } from '@/lib/pm-types';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/pm-types';

interface KanbanCardProps {
  item: PmBacklogItem;
  isDragOverlay?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function KanbanCard({
  item,
  isDragOverlay = false,
  isSelected = false,
  onToggleSelect,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
      className={`bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'
      } ${isDragOverlay ? 'shadow-lg rotate-2' : ''}`}
    >
      {/* Checkbox for bulk select */}
      {onToggleSelect && (
        <div className="mb-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
          />
        </div>
      )}

      {/* Legacy ID */}
      {item.legacy_id && (
        <span className="text-xs text-gray-400 font-mono">{item.legacy_id}</span>
      )}

      {/* Title (link to detail) */}
      <Link
        href={`/dashboard/pm/tasks/${item.id}`}
        className="block text-sm font-medium text-gray-900 hover:text-blue-600 mt-0.5 line-clamp-2"
        onClick={(e) => e.stopPropagation()}
      >
        {item.title}
      </Link>

      {/* Bottom row: priority + assignee */}
      <div className="flex items-center justify-between mt-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}>
          {PRIORITY_LABELS[item.priority]}
        </span>

        {/* Assignee initials circle (placeholder) */}
        {item.assignee_id && (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-500 font-medium">
              {/* First letter of assignee -- full name resolution is a v2 concern */}
              A
            </span>
          </div>
        )}
      </div>

      {/* Labels */}
      {item.labels && item.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: label.color + '20', color: label.color }}
            >
              {label.name}
            </span>
          ))}
          {item.labels.length > 3 && (
            <span className="text-xs text-gray-400">+{item.labels.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

### KanbanQuickAdd.tsx (~60 lines)

Inline "add item" at column bottom.

```tsx
'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface KanbanQuickAddProps {
  onAdd: (title: string) => Promise<void>;
}

export function KanbanQuickAdd({ onAdd }: KanbanQuickAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed);
      setTitle('');
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-2 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 py-1 w-full"
      >
        <Plus className="h-4 w-4" />
        Add item
      </button>
    );
  }

  return (
    <div className="mt-2 bg-white rounded-lg border border-gray-200 p-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setIsOpen(false); setTitle(''); }
        }}
        placeholder="Enter title..."
        autoFocus
        className="w-full text-sm border-none focus:outline-none focus:ring-0 p-1 text-gray-900 bg-white placeholder-gray-400"
        disabled={submitting}
      />
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={() => { setIsOpen(false); setTitle(''); }}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
```

### Key @dnd-kit Concepts

- **DndContext** wraps the entire board. Provides drag state management.
- **useDroppable** on each column makes it a drop target. The `id` should be the status string.
- **useSortable** on each card makes it draggable AND sortable within a column.
- **DragOverlay** renders the card being dragged (follows cursor). The original card becomes semi-transparent.
- **closestCorners** collision detection works well for kanban boards.
- **PointerSensor** with `activationConstraint: { distance: 8 }` prevents click events from being treated as drags.

## Integration Notes

- **Imports from:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@/lib/pm-types`
- **Used by:** TASK-2214 (Board page)
- **Parallel with:** TASK-2210 (board support), TASK-2211 (sprint), TASK-2212 (charts), TASK-2213 (projects)
- **Data flow:** Components receive data via props. The Board page (TASK-2214) handles RPC calls and passes data down.

## Do / Don't

### Do:
- Use @dnd-kit's `closestCorners` collision detection (works best for kanban)
- Add `activationConstraint: { distance: 8 }` to prevent accidental drags
- Make cards link to task detail via `Link` component
- Use DragOverlay for the ghost card (better UX than CSS transform alone)
- Keep components data-agnostic (receive via props, emit via callbacks)

### Don't:
- Do NOT make RPC calls inside these components (data comes from parent)
- Do NOT implement swim lanes here (TASK-2210)
- Do NOT add backlog panel dragging here (TASK-2210)
- Do NOT use native HTML5 DnD API (use @dnd-kit exclusively)
- Do NOT add animations beyond the DragOverlay's built-in transform

## When to Stop and Ask

- If @dnd-kit types conflict with the project's TypeScript config
- If `useSortable` causes hydration mismatches in Next.js (may need `dynamic` import)
- If you need to modify pm-types.ts to add board-specific types

## Testing Expectations

### Unit Tests
- **Required:** No (presentational components, verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add kanban board core components with @dnd-kit drag-and-drop`
- **Branch:** `feature/TASK-2209-kanban-board-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new component files | +8K |
| @dnd-kit learning curve | New library, well-documented | +10K |
| Code volume | ~480 lines total | +8K |
| TypeScript typing | @dnd-kit has good types | +2K |
| Build verification | Type check + lint + build | +2K |

**Confidence:** Medium (new library -- @dnd-kit -- is well-documented but untested in this codebase)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] admin-portal/app/dashboard/pm/components/KanbanBoard.tsx
- [ ] admin-portal/app/dashboard/pm/components/KanbanColumn.tsx
- [ ] admin-portal/app/dashboard/pm/components/KanbanCard.tsx
- [ ] admin-portal/app/dashboard/pm/components/KanbanQuickAdd.tsx

Verification:
- [ ] npx tsc --noEmit passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~30K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
