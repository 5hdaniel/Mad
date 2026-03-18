# Task TASK-2210: Board Support Components (SwimLane, BulkAction, BacklogPanel, DepIndicator)

**Status:** In Progress
**Backlog ID:** BACKLOG-970
**Sprint:** SPRINT-138
**Phase:** Phase 2a -- Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2210-board-support-components`
**Estimated Tokens:** ~25K
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

Build four board support components: the swim lane selector toggle, the bulk action bar for multi-select operations, the collapsible backlog side panel for dragging unassigned items onto the board, and the dependency indicator icon shown on blocked cards. These components complement the core kanban components (TASK-2209) and are assembled by the Board page (TASK-2214).

## Non-Goals

- Do NOT build the board page itself (TASK-2214)
- Do NOT build the core kanban components (TASK-2209: KanbanBoard, Column, Card, QuickAdd)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement real-time updates or polling

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/SwimLaneSelector.tsx` (~40 lines)
2. New file: `admin-portal/app/dashboard/pm/components/BulkActionBar.tsx` (~100 lines)
3. New file: `admin-portal/app/dashboard/pm/components/BacklogSidePanel.tsx` (~200 lines)
4. New file: `admin-portal/app/dashboard/pm/components/DependencyIndicator.tsx` (~40 lines)

## File Boundaries

### Files to create (owned by this task):

- `admin-portal/app/dashboard/pm/components/SwimLaneSelector.tsx`
- `admin-portal/app/dashboard/pm/components/BulkActionBar.tsx`
- `admin-portal/app/dashboard/pm/components/BacklogSidePanel.tsx`
- `admin-portal/app/dashboard/pm/components/DependencyIndicator.tsx`

### Files this task must NOT modify:

- All existing PM components
- TASK-2209 components (KanbanBoard, KanbanColumn, KanbanCard, KanbanQuickAdd)
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Any page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] SwimLaneSelector renders toggle buttons: Off, Project, Area, Assignee
- [ ] SwimLaneSelector calls `onChange(mode)` callback when toggled
- [ ] BulkActionBar renders a floating bar with selected count + action buttons
- [ ] BulkActionBar has actions: Change Status, Change Priority, Assign to Sprint, Delete
- [ ] BulkActionBar calls appropriate callbacks for each action
- [ ] BacklogSidePanel is a collapsible right-side panel
- [ ] BacklogSidePanel lists backlog items not assigned to any sprint
- [ ] BacklogSidePanel has search input to filter items
- [ ] BacklogSidePanel items are draggable (using @dnd-kit)
- [ ] DependencyIndicator shows a lock icon with tooltip for blocked items
- [ ] All components accept data via props (no direct RPC calls)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### SwimLaneSelector.tsx (~40 lines)

A simple toggle bar for grouping mode.

```tsx
'use client';

export type SwimLaneMode = 'off' | 'project' | 'area' | 'assignee';

interface SwimLaneSelectorProps {
  value: SwimLaneMode;
  onChange: (mode: SwimLaneMode) => void;
}

const OPTIONS: { value: SwimLaneMode; label: string }[] = [
  { value: 'off', label: 'No Grouping' },
  { value: 'project', label: 'Project' },
  { value: 'area', label: 'Area' },
  { value: 'assignee', label: 'Assignee' },
];

export function SwimLaneSelector({ value, onChange }: SwimLaneSelectorProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

### BulkActionBar.tsx (~100 lines)

A floating bar at the bottom of the viewport when items are selected.

```tsx
'use client';

import { X, ArrowRight, Flag, Calendar, Trash2 } from 'lucide-react';
import type { ItemStatus, ItemPriority } from '@/lib/pm-types';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onChangeStatus: (status: ItemStatus) => void;
  onChangePriority: (priority: ItemPriority) => void;
  onAssignToSprint: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onChangeStatus,
  onChangePriority,
  onAssignToSprint,
  onDelete,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-gray-900 text-white rounded-lg shadow-lg px-4 py-2.5">
        {/* Selected count */}
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="w-px h-5 bg-gray-700" />

        {/* Status dropdown trigger */}
        <button
          onClick={() => onChangeStatus('in_progress')}
          className="flex items-center gap-1 text-sm text-gray-300 hover:text-white"
        >
          <ArrowRight className="h-4 w-4" />
          Move to In Progress
        </button>

        {/* Sprint assignment */}
        <button
          onClick={onAssignToSprint}
          className="flex items-center gap-1 text-sm text-gray-300 hover:text-white"
        >
          <Calendar className="h-4 w-4" />
          Assign Sprint
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>

        <div className="w-px h-5 bg-gray-700" />

        {/* Close */}
        <button onClick={onClearSelection} className="p-1 text-gray-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Note:** The bulk action bar in this task has simplified actions (direct status change). The board page (TASK-2214) can expand this to dropdown selectors for status/priority if desired.

### BacklogSidePanel.tsx (~200 lines)

A collapsible panel on the right side of the board.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { PanelRightClose, PanelRightOpen, Search } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import type { PmBacklogItem } from '@/lib/pm-types';

interface BacklogSidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  items: PmBacklogItem[];
  loading?: boolean;
  onSearch?: (query: string) => void;
}

export function BacklogSidePanel({
  isOpen,
  onToggle,
  items,
  loading = false,
  onSearch,
}: BacklogSidePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  function handleSearch(query: string) {
    setSearchQuery(query);
    onSearch?.(query);
  }

  return (
    <>
      {/* Toggle button when closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-white border border-r-0 border-gray-200 rounded-l-lg p-2 shadow-sm hover:bg-gray-50 z-10"
        >
          <PanelRightOpen className="h-4 w-4 text-gray-500" />
        </button>
      )}

      {/* Panel */}
      <div
        className={`transition-all duration-300 ${
          isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        } border-l border-gray-200 bg-white flex flex-col flex-shrink-0`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Backlog</h3>
          <button onClick={onToggle} className="p-1 text-gray-400 hover:text-gray-600">
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search backlog..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
            />
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              No unassigned items
            </p>
          ) : (
            items.map((item) => (
              <BacklogPanelItem key={item.id} item={item} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// Individual draggable item within the panel
function BacklogPanelItem({ item }: { item: PmBacklogItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `backlog-${item.id}`,
    data: { type: 'backlog-item', item },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white border border-gray-200 rounded p-2 cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {item.legacy_id && (
        <span className="text-xs text-gray-400 font-mono">{item.legacy_id}</span>
      )}
      <p className="text-xs text-gray-900 font-medium line-clamp-2 mt-0.5">
        {item.title}
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-gray-400">{item.type}</span>
        <span className="text-xs text-gray-300">|</span>
        <span className="text-xs text-gray-400">{item.priority}</span>
      </div>
    </div>
  );
}
```

### DependencyIndicator.tsx (~40 lines)

A lock icon shown on blocked cards.

```tsx
'use client';

import { Lock, AlertTriangle } from 'lucide-react';

interface DependencyIndicatorProps {
  /** Number of blocking dependencies */
  blockingCount: number;
  /** Whether the item is currently blocked */
  isBlocked: boolean;
  /** Tooltip text describing what blocks this item */
  tooltip?: string;
}

export function DependencyIndicator({
  blockingCount,
  isBlocked,
  tooltip,
}: DependencyIndicatorProps) {
  if (blockingCount === 0 && !isBlocked) return null;

  return (
    <div className="relative group inline-flex items-center">
      {isBlocked ? (
        <Lock className="h-3.5 w-3.5 text-red-500" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}
```

## Integration Notes

- **Imports from:** `@dnd-kit/core` (BacklogSidePanel uses `useDraggable`), `@/lib/pm-types`
- **Used by:** TASK-2214 (Board page)
- **Parallel with:** TASK-2209 (kanban core), TASK-2211, TASK-2212, TASK-2213
- **BacklogSidePanel must be inside a DndContext** -- the Board page (TASK-2214) wraps everything in a single DndContext. The panel items use `useDraggable` and the board columns use `useDroppable`.
- **SwimLaneSelector exports:** `SwimLaneMode` type (used by Board page for grouping logic)

## Do / Don't

### Do:
- Export `SwimLaneMode` type from SwimLaneSelector.tsx
- Use `useDraggable` (not `useSortable`) for backlog panel items -- they are dragged TO the board, not sorted within the panel
- Add `data: { type: 'backlog-item', item }` to draggable items so the board can distinguish them from column drags
- Set input text color explicitly (`text-gray-900 bg-white`) to avoid inherited dark theme issues

### Don't:
- Do NOT make RPC calls inside these components (data comes from parent)
- Do NOT implement dropdown selectors for status/priority in BulkActionBar (keep it simple; v2 enhancement)
- Do NOT add real-time polling in BacklogSidePanel (parent manages data)
- Do NOT use absolute positioning that breaks in the board layout

## When to Stop and Ask

- If `useDraggable` conflicts with the `useSortable` in KanbanColumn (DndContext scoping issue)
- If you need to add types to pm-types.ts
- If the floating BulkActionBar causes z-index issues with the sidebar

## Testing Expectations

### Unit Tests
- **Required:** No (presentational components, verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add board support components (swim lanes, bulk actions, backlog panel, deps)`
- **Branch:** `feature/TASK-2210-board-support-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new component files | +8K |
| Code volume | ~380 lines total | +7K |
| @dnd-kit integration | BacklogSidePanel uses useDraggable | +5K |
| Build verification | Type check + lint + build | +3K |
| Pattern reuse | BulkActionBar follows existing patterns | -2K |

**Confidence:** Medium (BacklogSidePanel + DndContext interaction is the unknown)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-03-16*

### Agent ID
```
Engineer Agent ID: agent-a396c95b
```

### Checklist

```
Files created:
- [x] admin-portal/app/dashboard/pm/components/SwimLaneSelector.tsx
- [x] admin-portal/app/dashboard/pm/components/BulkActionBar.tsx
- [x] admin-portal/app/dashboard/pm/components/BacklogSidePanel.tsx
- [x] admin-portal/app/dashboard/pm/components/DependencyIndicator.tsx

Verification:
- [x] npx tsc --noEmit passes
- [x] npm run lint passes
- [x] npm run build passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | auto-captured |
| Duration | auto-captured |

**Variance:** PM Est ~25K vs Actual (auto-captured)

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #1200
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
