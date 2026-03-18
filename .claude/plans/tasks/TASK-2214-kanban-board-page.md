# Task TASK-2214: Kanban Board Page

**Status:** Pending
**Backlog ID:** BACKLOG-974
**Sprint:** SPRINT-138
**Phase:** Phase 2b -- Pages (after TASK-2209 + TASK-2210)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2214-kanban-board-page`
**Estimated Tokens:** ~25K
**Depends On:** TASK-2209 (kanban core components), TASK-2210 (board support components)

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

Build the Kanban Board page at `/dashboard/pm/board` that assembles all board components into a functioning drag-and-drop board. The page manages data loading, sprint selection, swim lane grouping, drag event handlers that update item status via RPCs, and the backlog side panel for assigning unassigned items to the selected sprint.

This page replaces the placeholder created by TASK-2208.

## Non-Goals

- Do NOT modify any board components (TASK-2209 and TASK-2210 own those)
- Do NOT modify pm-types.ts or pm-queries.ts
- Do NOT add npm dependencies
- Do NOT implement cross-swim-lane drag (changing project requires sidebar, not drag)
- Do NOT implement real-time board updates (polling-based refresh is v2)

## Deliverables

1. Replace file: `admin-portal/app/dashboard/pm/board/page.tsx` (~250 lines, replaces placeholder)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/board/page.tsx` (replace placeholder with real implementation)

### Files this task must NOT modify:

- All PM component files under `pm/components/`
- `admin-portal/lib/pm-types.ts`
- `admin-portal/lib/pm-queries.ts`
- Other page files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Page renders at `/dashboard/pm/board`
- [ ] Sprint selector dropdown at top (list from `listSprints()`)
- [ ] Board loads items via `getBoardTasks(sprintId)` for selected sprint
- [ ] Cards appear in correct status columns (pending, in_progress, testing, completed, blocked)
- [ ] Dragging a card to a different column updates status via `updateItemStatus()`
- [ ] Board refreshes card positions after successful status update
- [ ] SwimLaneSelector toggles grouping (off/project/area/assignee)
- [ ] When swim lanes are on, items are grouped into horizontal sections
- [ ] Backlog side panel toggle button visible
- [ ] Backlog panel shows items not assigned to any sprint (via `listItems({ sprint_id: null })`)
- [ ] Dragging from backlog panel to board assigns item to sprint via `assignToSprint()`
- [ ] KanbanQuickAdd creates items via `createItem()` with correct sprint and status
- [ ] BulkActionBar appears when items are selected
- [ ] Page handles loading and error states
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

### Page Structure

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PmSprint, PmBacklogItem, ItemStatus, BoardColumns } from '@/lib/pm-types';
import {
  getBoardTasks,
  listSprints,
  listItems,
  updateItemStatus,
  assignToSprint,
  createItem,
  bulkUpdate,
  deleteItem,
} from '@/lib/pm-queries';
import { KanbanBoard } from '../components/KanbanBoard';
import { SwimLaneSelector, type SwimLaneMode } from '../components/SwimLaneSelector';
import { BulkActionBar } from '../components/BulkActionBar';
import { BacklogSidePanel } from '../components/BacklogSidePanel';

export default function BoardPage() {
  // State
  const [sprints, setSprints] = useState<PmSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [columns, setColumns] = useState<BoardColumns>({ pending: [], in_progress: [], testing: [], completed: [], blocked: [] });
  const [loading, setLoading] = useState(true);
  const [swimLane, setSwimLane] = useState<SwimLaneMode>('off');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [backlogItems, setBacklogItems] = useState<PmBacklogItem[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);

  // Load sprints on mount
  useEffect(() => {
    async function loadSprints() {
      try {
        const data = await listSprints();
        setSprints(data);
        // Auto-select active sprint
        const active = data.find((s) => s.status === 'active');
        if (active) setSelectedSprintId(active.id);
        else if (data.length > 0) setSelectedSprintId(data[0].id);
      } catch (err) {
        console.error('Failed to load sprints:', err);
      }
    }
    loadSprints();
  }, []);

  // Load board when sprint changes
  useEffect(() => {
    if (!selectedSprintId) return;
    async function loadBoard() {
      setLoading(true);
      try {
        const data = await getBoardTasks(selectedSprintId);
        setColumns(data);
      } catch (err) {
        console.error('Failed to load board:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBoard();
  }, [selectedSprintId]);

  // Load backlog items when panel opens
  useEffect(() => {
    if (!backlogOpen) return;
    async function loadBacklog() {
      setBacklogLoading(true);
      try {
        const result = await listItems({ sprint_id: undefined, page_size: 50 });
        // Filter to items without a sprint
        setBacklogItems(result.items.filter((i) => !i.sprint_id));
      } catch (err) {
        console.error('Failed to load backlog:', err);
      } finally {
        setBacklogLoading(false);
      }
    }
    loadBacklog();
  }, [backlogOpen]);

  // Drag handlers
  const handleStatusChange = useCallback(async (itemId: string, newStatus: ItemStatus) => {
    try {
      await updateItemStatus(itemId, newStatus);
      // Refresh board
      if (selectedSprintId) {
        const data = await getBoardTasks(selectedSprintId);
        setColumns(data);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [selectedSprintId]);

  const handleQuickAdd = useCallback(async (title: string, status: ItemStatus) => {
    if (!selectedSprintId) return;
    try {
      await createItem({ title, sprint_id: selectedSprintId });
      // Refresh board
      const data = await getBoardTasks(selectedSprintId);
      setColumns(data);
    } catch (err) {
      console.error('Failed to create item:', err);
    }
  }, [selectedSprintId]);

  // Toggle card selection
  const handleToggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  // Render
  return (
    <div className="max-w-full mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Board</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Sprint selector */}
          <select
            value={selectedSprintId || ''}
            onChange={(e) => setSelectedSprintId(e.target.value || null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 bg-white"
          >
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === 'active' ? ' (Active)' : ''}
              </option>
            ))}
          </select>

          {/* Swim lane selector */}
          <SwimLaneSelector value={swimLane} onChange={setSwimLane} />

          {/* Backlog panel toggle */}
          <button
            onClick={() => setBacklogOpen(!backlogOpen)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              backlogOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Backlog
          </button>
        </div>
      </div>

      {/* Board + Backlog Panel */}
      <div className="flex">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-72 h-96 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <KanbanBoard
              columns={columns}
              onStatusChange={handleStatusChange}
              onQuickAdd={handleQuickAdd}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          )}
        </div>

        <BacklogSidePanel
          isOpen={backlogOpen}
          onToggle={() => setBacklogOpen(!backlogOpen)}
          items={backlogItems}
          loading={backlogLoading}
        />
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onChangeStatus={async (status) => {
          await bulkUpdate(Array.from(selectedIds), { status });
          setSelectedIds(new Set());
          if (selectedSprintId) setColumns(await getBoardTasks(selectedSprintId));
        }}
        onChangePriority={async (priority) => {
          await bulkUpdate(Array.from(selectedIds), { priority });
          setSelectedIds(new Set());
          if (selectedSprintId) setColumns(await getBoardTasks(selectedSprintId));
        }}
        onAssignToSprint={() => { /* v2: sprint picker dialog */ }}
        onDelete={async () => {
          for (const id of selectedIds) await deleteItem(id);
          setSelectedIds(new Set());
          if (selectedSprintId) setColumns(await getBoardTasks(selectedSprintId));
        }}
      />
    </div>
  );
}
```

### Swim Lane Grouping

When swim lane mode is not `'off'`, group items within each column by the selected field (project, area, or assignee). This is a UI-only grouping -- the data structure stays the same, just rendered in sections.

```tsx
// Example swim lane grouping logic
function groupByField(items: PmBacklogItem[], mode: SwimLaneMode): Map<string, PmBacklogItem[]> {
  if (mode === 'off') return new Map([['all', items]]);

  const grouped = new Map<string, PmBacklogItem[]>();
  for (const item of items) {
    let key: string;
    switch (mode) {
      case 'project': key = item.project_id || 'No Project'; break;
      case 'area': key = item.area || 'No Area'; break;
      case 'assignee': key = item.assignee_id || 'Unassigned'; break;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  return grouped;
}
```

**Note:** Full swim lane rendering with horizontal sections is the most complex part of this page. If it proves too complex within the token budget, implement it as a simple filter dropdown instead (filter by project/area/assignee rather than visual swim lanes). Consult PM if unsure.

### Backlog Panel Integration

The BacklogSidePanel uses `useDraggable` inside the board's `DndContext`. When an item is dropped from the backlog panel onto a board column:
1. The `handleDragEnd` in KanbanBoard receives a drag event with `active.data.type === 'backlog-item'`
2. The page detects this and calls `assignToSprint()` + `updateItemStatus()` to place the item

This cross-container drag is the trickiest integration. The board page must extend the KanbanBoard's `handleDragEnd` or provide a wrapper `DndContext` that handles both column drags and backlog-to-board drags.

**Simpler alternative:** If DndContext scoping issues arise, implement the backlog assignment as a button click ("Assign to Sprint") rather than drag-and-drop. Notify PM if you take this route.

## Integration Notes

- **Imports from:** TASK-2209 components (KanbanBoard), TASK-2210 components (SwimLaneSelector, BulkActionBar, BacklogSidePanel), `@/lib/pm-queries`, `@/lib/pm-types`
- **Replaces:** TASK-2208 placeholder at `pm/board/page.tsx`
- **Parallel with:** TASK-2215, TASK-2216, TASK-2217 (different page routes)

## Do / Don't

### Do:
- Auto-select the first active sprint on mount
- Refresh board data after every status change
- Set explicit text color on select elements (`text-gray-900 bg-white`)
- Handle the case where no sprints exist (show a message)
- Clear selection after bulk actions complete

### Don't:
- Do NOT implement real-time polling (manual refresh only for now)
- Do NOT implement cross-swim-lane drag (that would change project/area, which should only happen via sidebar)
- Do NOT block column-to-column drag based on ALLOWED_TRANSITIONS (let the RPC reject invalid transitions and show an error)
- Do NOT modify KanbanBoard or other component files

## When to Stop and Ask

- If DndContext scoping causes issues between board columns and backlog panel
- If swim lane grouping significantly exceeds the line budget (~250 lines for this file)
- If `getBoardTasks()` returns data in unexpected shape

## Testing Expectations

### Unit Tests
- **Required:** No (page-level component with RPC calls, verified via type-check + manual E2E)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add kanban board page with drag-and-drop, swim lanes, and backlog panel`
- **Branch:** `feature/TASK-2214-kanban-board-page`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 page file (replace placeholder) | +3K |
| Code volume | ~250 lines | +8K |
| State management | Sprint selection, columns, backlog, selection | +5K |
| DndContext integration | Cross-container drag (backlog + board) | +5K |
| Swim lane grouping logic | Map-based grouping | +3K |
| Build verification | Type check + lint + build | +3K |

**Confidence:** Medium (cross-container drag and swim lanes are the unknowns)

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
Files modified:
- [ ] admin-portal/app/dashboard/pm/board/page.tsx (replaced placeholder)

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

**Variance:** PM Est ~25K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
