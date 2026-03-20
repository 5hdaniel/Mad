# Task TASK-2205: PM Backlog Page

**Status:** Pending
**Backlog ID:** BACKLOG-965
**Sprint:** SPRINT-137
**Phase:** Phase 2b -- Pages (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2205-pm-backlog-page`
**Estimated Tokens:** ~18K
**Depends On:** TASK-2200 (types/queries), TASK-2201 (badges), TASK-2202 (table/filters), TASK-2204 (tree/create dialog)

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

Create the backlog list page at `/dashboard/pm/backlog` that assembles all shared components into a filterable, searchable, paginated view of all PM backlog items with tree toggle and create-item capability. This is the primary page for browsing and managing the PM backlog.

## Non-Goals

- Do NOT create or modify shared components (they already exist from TASK-2201/2202/2204)
- Do NOT implement drag-and-drop reordering (Sprint C)
- Do NOT implement bulk actions bar (Sprint C)
- Do NOT create the task detail page (TASK-2206)
- Do NOT add npm dependencies

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/backlog/page.tsx` (~180 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/backlog/page.tsx` (new)

### Files this task must NOT modify:

- All files under `admin-portal/app/dashboard/pm/components/` -- Owned by TASK-2201/2202/2203/2204
- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- `admin-portal/app/dashboard/pm/page.tsx` -- Owned by TASK-2207
- Any support pages or components

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Page renders at `/dashboard/pm/backlog`
- [ ] Header shows "Backlog" title with item count and "Create Item" button
- [ ] `TaskStatsCards` displays aggregate stats at top
- [ ] `TaskSearchBar` provides full-text search (debounced)
- [ ] `TaskFilters` provides dropdowns for status/priority/type/area/sprint/project
- [ ] `SavedViewSelector` allows saving/loading filter configurations
- [ ] `TaskTable` shows paginated results with proper columns
- [ ] Tree view toggle button switches between flat list and `HierarchyTree`
- [ ] Clicking a table row navigates to `/dashboard/pm/tasks/[id]`
- [ ] "Create Item" button opens `CreateTaskDialog`
- [ ] Creating an item refreshes the list
- [ ] Filter changes reset to page 1
- [ ] Page handles loading and error states
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Implementation Notes

**Pattern template:** `admin-portal/app/dashboard/support/page.tsx` (149 lines)

This page follows the exact same structure as the support page. The support page is the gold standard -- follow its layout, state management, and component composition pattern.

### Page Structure

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, List, GitBranch } from 'lucide-react';
import { listItems } from '@/lib/pm-queries';
import type { PmBacklogItem, ItemStatus, ItemPriority, ItemType } from '@/lib/pm-types';
import { TaskStatsCards } from '../components/TaskStatsCards';
import { TaskFilters } from '../components/TaskFilters';
import { TaskTable } from '../components/TaskTable';
import { TaskSearchBar } from '../components/TaskSearchBar';
import { SavedViewSelector } from '../components/SavedViewSelector';
import { HierarchyTree } from '../components/HierarchyTree';
import { CreateTaskDialog } from '../components/CreateTaskDialog';

export default function BacklogPage() {
  // Items state
  const [items, setItems] = useState<PmBacklogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<ItemStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<ItemPriority | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // View mode
  const [treeMode, setTreeMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const pageSize = 50;

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listItems({
        status: statusFilter,
        priority: priorityFilter,
        type: typeFilter,
        area: areaFilter,
        sprint_id: sprintFilter,
        project_id: projectFilter,
        search: searchQuery || undefined,
        parent_id: treeMode ? undefined : undefined, // flat mode: no parent filter; tree mode: root items only
        page,
        page_size: pageSize,
      });
      setItems(data.items);
      setTotalCount(data.total_count);
      setTotalPages(Math.ceil(data.total_count / pageSize));
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, typeFilter, areaFilter, sprintFilter, projectFilter, searchQuery, page, treeMode]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Reset to page 1 when filters change (same pattern as support page)
  // ... filter change handlers ...

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with title, tree toggle, create button */}
      {/* Stats Cards */}
      {/* Search Bar + Saved View Selector (side by side) */}
      {/* Filters */}
      {/* Conditional: TaskTable (flat) or HierarchyTree (tree mode) */}
      {/* Create Dialog */}
    </div>
  );
}
```

### Header Layout

```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Backlog</h1>
    <p className="text-sm text-gray-500 mt-1">{totalCount} items</p>
  </div>
  <div className="flex items-center gap-3">
    {/* Tree toggle */}
    <button
      onClick={() => setTreeMode(!treeMode)}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${
        treeMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700'
      }`}
    >
      {treeMode ? <GitBranch className="h-4 w-4" /> : <List className="h-4 w-4" />}
      {treeMode ? 'Tree View' : 'Flat View'}
    </button>
    {/* Create button */}
    <button onClick={() => setShowCreateDialog(true)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
      <Plus className="h-4 w-4" />
      Create Item
    </button>
  </div>
</div>
```

### Saved View Integration

The `SavedViewSelector` and `TaskSearchBar` sit side by side above the filters:

```tsx
<div className="flex items-center gap-4 mb-4">
  <div className="flex-1">
    <TaskSearchBar onSearch={handleSearch} />
  </div>
  <SavedViewSelector
    currentFilters={{ status: statusFilter, priority: priorityFilter, type: typeFilter, area: areaFilter, sprint_id: sprintFilter, project_id: projectFilter }}
    onLoadView={(filters) => {
      // Apply saved filter values to state
      setStatusFilter(filters.status || null);
      // ... etc
      setPage(1);
    }}
  />
</div>
```

### Tree Mode vs Flat Mode

- **Flat mode (default):** Render `<TaskTable>` with all items
- **Tree mode:** Render `<HierarchyTree>` with root items (those with no parent_id). When loading in tree mode, set `parent_id` filter to null to get only root items, then HierarchyTree handles lazy-loading children.

## Integration Notes

- **Imports from:** `@/lib/pm-types`, `@/lib/pm-queries` (TASK-2200)
- **Uses components from:** TASK-2201 (badges via TaskTable), TASK-2202 (TaskTable, TaskFilters, TaskSearchBar, TaskStatsCards, SavedViewSelector), TASK-2204 (HierarchyTree, CreateTaskDialog)
- **Parallel with:** TASK-2206, TASK-2207 (different page routes)
- **Next.js routing:** The file at `app/dashboard/pm/backlog/page.tsx` auto-registers as `/dashboard/pm/backlog`

## Do / Don't

### Do:
- Follow the support page structure exactly (same state management pattern)
- Reset page to 1 when any filter changes
- Show loading skeleton while data loads
- Handle error state gracefully
- Use `useRouter` for navigation on item click

### Don't:
- Do NOT add client-side sorting (RPC handles sort)
- Do NOT cache items in localStorage (fresh fetch on filter change)
- Do NOT modify the component files -- only import and compose them
- Do NOT add URL search params syncing (v2 feature)

## When to Stop and Ask

- If any component from TASK-2201/2202/2204 is missing or has different props than expected
- If `listItems()` RPC return shape doesn't match `ItemListResponse`
- If the `pm/backlog/` directory doesn't exist (create it)

## Testing Expectations

### Unit Tests
- **Required:** No (page-level assembly, verified via type-check + manual E2E)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add backlog list page with filters, search, and tree view`
- **Branch:** `feature/TASK-2205-pm-backlog-page`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~18K

**Token Cap:** 72K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new file | +5K |
| Code volume | ~180 lines | +5K |
| Pattern reuse | Very high -- near-identical to support page | -5K |
| Integration complexity | Composing many components | +3K |

**Confidence:** High

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
- [ ] admin-portal/app/dashboard/pm/backlog/page.tsx

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

**Variance:** PM Est ~18K vs Actual ~XK

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information

**PR Number:** #XXX
**Merged To:** feature/pm-module

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
