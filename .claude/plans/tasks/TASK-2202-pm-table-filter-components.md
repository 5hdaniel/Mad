# Task TASK-2202: PM Table, Filters, Search, Stats, and Saved Views Components

**Status:** Pending
**Backlog ID:** BACKLOG-962
**Sprint:** SPRINT-137
**Phase:** Phase 2a -- Shared Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2202-pm-table-filter-components`
**Estimated Tokens:** ~25K
**Depends On:** TASK-2200 (types + queries must exist)

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

Create five components for the backlog list page: a paginated task table, filter dropdowns, search bar, stats summary cards, and a saved view selector. These form the "list view" layer of the PM module.

## Non-Goals

- Do NOT create the backlog page itself (TASK-2205)
- Do NOT create badge components (TASK-2201)
- Do NOT create detail-page components (TASK-2203)
- Do NOT modify any existing support components
- Do NOT add npm dependencies

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/TaskTable.tsx` (~280 lines)
2. New file: `admin-portal/app/dashboard/pm/components/TaskFilters.tsx` (~150 lines)
3. New file: `admin-portal/app/dashboard/pm/components/TaskSearchBar.tsx` (~60 lines)
4. New file: `admin-portal/app/dashboard/pm/components/TaskStatsCards.tsx` (~100 lines)
5. New file: `admin-portal/app/dashboard/pm/components/SavedViewSelector.tsx` (~120 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/components/TaskTable.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskFilters.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskSearchBar.tsx` (new)
- `admin-portal/app/dashboard/pm/components/TaskStatsCards.tsx` (new)
- `admin-portal/app/dashboard/pm/components/SavedViewSelector.tsx` (new)

### Files this task must NOT modify:

- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- `admin-portal/app/dashboard/pm/components/TaskStatusBadge.tsx` -- Owned by TASK-2201
- `admin-portal/app/dashboard/pm/components/TaskPriorityBadge.tsx` -- Owned by TASK-2201
- `admin-portal/app/dashboard/pm/components/TaskTypeBadge.tsx` -- Owned by TASK-2201
- Any support components under `admin-portal/app/dashboard/support/components/`

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `TaskTable` renders a paginated table of PM backlog items with columns: ID, Title, Type, Status, Priority, Area, Sprint, Assignee, Est Tokens
- [ ] `TaskTable` supports row click to navigate to task detail (`/dashboard/pm/tasks/[id]`)
- [ ] `TaskTable` supports checkbox selection for bulk operations
- [ ] `TaskFilters` provides dropdowns for: Status, Priority, Type, Area, Sprint, Project
- [ ] `TaskSearchBar` provides debounced full-text search input
- [ ] `TaskStatsCards` fetches and displays aggregate stats from `pm_get_stats` RPC
- [ ] `SavedViewSelector` lets user load, save, and delete filter configurations
- [ ] All components import types from `@/lib/pm-types` and queries from `@/lib/pm-queries`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### TaskTable.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/TicketTable.tsx` (265 lines)

**Changes from support TicketTable:**
- Different columns: replace ticket_number/subject/requester/assignee/status/priority/created with item_number/title/type/status/priority/area/sprint/est_tokens
- Add checkbox column for bulk select (first column)
- Add tree indentation support: if item has `parent_id`, indent title with left padding
- Row click navigates to `/dashboard/pm/tasks/${item.id}` (use `useRouter`)
- Import `PmBacklogItem` from `@/lib/pm-types`
- Use inline badge rendering (import `TaskStatusBadge`, `TaskPriorityBadge`, `TaskTypeBadge` from sibling components) -- NOTE: these are from TASK-2201, which runs in parallel. For now, render status/priority/type as plain text spans with color classes from the color maps in pm-types. The page task (TASK-2205) will integrate the badge components.

**Props interface:**
```typescript
interface TaskTableProps {
  items: PmBacklogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  searchActive?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  treeMode?: boolean; // indent children under parents
}
```

**Pagination:** Same pattern as TicketTable -- Previous/Next buttons, page X of Y display.

### TaskFilters.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/TicketFilters.tsx` (109 lines)

**Changes from support TicketFilters:**
- Replace status/priority/category dropdowns with: Status, Priority, Type, Area, Sprint, Project
- Status values: `ItemStatus` type from pm-types
- Priority values: `ItemPriority` type from pm-types
- Type values: `ItemType` type from pm-types
- Area: free text or dropdown with common values ('admin-portal', 'electron', 'broker-portal', 'service', 'schema', 'ui')
- Sprint: fetch from `listSprints()` for dropdown options
- Project: fetch from `listProjects()` for dropdown options

**Props interface:**
```typescript
interface TaskFiltersProps {
  status: ItemStatus | null;
  priority: ItemPriority | null;
  type: ItemType | null;
  area: string | null;
  sprintId: string | null;
  projectId: string | null;
  onStatusChange: (status: ItemStatus | null) => void;
  onPriorityChange: (priority: ItemPriority | null) => void;
  onTypeChange: (type: ItemType | null) => void;
  onAreaChange: (area: string | null) => void;
  onSprintChange: (sprintId: string | null) => void;
  onProjectChange: (projectId: string | null) => void;
}
```

### TaskSearchBar.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/SearchBar.tsx` (58 lines)

**Changes:** Only the placeholder text changes. Use `"Search backlog items..."` instead of `"Search tickets..."`.

Same debounce pattern (300ms), same search icon, same clear button.

### TaskStatsCards.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/StatsCards.tsx` (88 lines)

**Changes from support StatsCards:**
- Call `getStats()` from `@/lib/pm-queries` instead of support stats
- Display: Total Items, Pending, In Progress, Blocked, Completed (this sprint)
- Use same card layout pattern (grid of stat cards)
- Each card shows a count and label

### SavedViewSelector.tsx

**NEW component** (no support equivalent). A dropdown that lets users:

1. Load a saved view (applies filter state)
2. Save current filters as a new view
3. Delete a saved view

```typescript
interface SavedViewSelectorProps {
  currentFilters: Record<string, unknown>;
  onLoadView: (filters: Record<string, unknown>) => void;
}
```

**Implementation sketch:**
- On mount, call `listSavedViews()` to populate dropdown
- Dropdown shows view names + a "Save Current View" option at bottom
- "Save" opens a small inline text input for view name, then calls `saveView()`
- Each view has a delete button (X), calls `deleteSavedView()`
- Loading a view calls `onLoadView(view.filters_json)`

## Integration Notes

- **Imports from:** `@/lib/pm-types`, `@/lib/pm-queries` (TASK-2200)
- **Used by:** TASK-2205 (Backlog page), TASK-2207 (Dashboard page -- uses TaskStatsCards)
- **Parallel with:** TASK-2201, TASK-2203, TASK-2204 (different files, no overlap)

## Do / Don't

### Do:
- Follow support component patterns for layout and styling
- Use `useCallback` for filter change handlers
- Use `useState` + `useEffect` for data fetching in StatsCards and SavedViewSelector
- Keep table responsive with `overflow-x-auto`
- Use `text-gray-900 bg-white` on form inputs (per project convention)

### Don't:
- Do NOT fetch data in TaskTable (it receives items as props)
- Do NOT duplicate badge rendering logic -- use color maps from pm-types inline
- Do NOT add sorting to TaskTable (RPC handles sort order)
- Do NOT use `react-select` or any external dropdown library

## When to Stop and Ask

- If `pm-types.ts` or `pm-queries.ts` don't export the expected functions/types
- If the sprint/project dropdown data needs a different RPC than `listSprints`/`listProjects`
- If you need to add a new RPC wrapper not in pm-queries.ts

## Testing Expectations

### Unit Tests
- **Required:** No (presentational components verified via type-check + visual)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add table, filters, search, stats, and saved view components`
- **Branch:** `feature/TASK-2202-pm-table-filter-components`
- **Target:** `feature/pm-module`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 5 new files | +10K |
| Code volume | ~710 lines total | +10K |
| Pattern reuse | High for 4/5 components | -5K |
| SavedViewSelector | New component, no template | +5K |

**Confidence:** Medium-High

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
- [ ] admin-portal/app/dashboard/pm/components/TaskTable.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskFilters.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskSearchBar.tsx
- [ ] admin-portal/app/dashboard/pm/components/TaskStatsCards.tsx
- [ ] admin-portal/app/dashboard/pm/components/SavedViewSelector.tsx

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
