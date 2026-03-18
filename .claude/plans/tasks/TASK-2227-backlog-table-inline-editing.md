# TASK-2227: Backlog Table Inline Editing for Status, Priority, Type, Assignee, Area

**Backlog Item:** #1032 (UUID: `f2413290-bb8e-4fb4-a2e1-75537e96d72b`)
**Sprint:** SPRINT-142 (PM UI Polish III)
**Status:** In Progress
**Branch:** `feature/task-2227-backlog-inline-editing`
**Estimated Tokens:** ~30K (UI category, x1.0 multiplier)
**Token Cap:** ~120K (4x)

---

## Objective

Add inline dropdown editing to the backlog table (`TaskTable.tsx`) for the Status, Priority, Type, Assignee, and Area columns. Currently these columns display read-only badges/text. Users must navigate to the detail page to change them. After this task, clicking on any of these cells in the table will open an inline dropdown allowing immediate editing, just like the KanbanCard already supports for Priority and Assignee.

---

## Context

- The backlog table component is at `admin-portal/app/dashboard/pm/components/TaskTable.tsx`
- The backlog page that renders it is at `admin-portal/app/dashboard/pm/backlog/page.tsx`
- Existing inline editing patterns exist in `admin-portal/app/dashboard/pm/components/KanbanCard.tsx`:
  - `PriorityDropdown` - click badge to open dropdown, select new value, calls `updateItemField(id, 'priority', value)`
  - `AssigneeDropdown` - click to open user list, calls `assignItem(id, userId)`
  - `InlineLabelPicker` - click to toggle labels on/off
- All these patterns use: `useState` for open/close, `useRef` + `useEffect` for outside-click detection
- Available RPCs in `admin-portal/lib/pm-queries.ts`:
  - `updateItemField(itemId, field, value)` - for priority, type, area
  - `updateItemStatus(itemId, newStatus)` - for status (validates transitions)
  - `assignItem(itemId, assigneeId)` - for assignee
- Type/enum definitions in `admin-portal/lib/pm-types.ts`:
  - `ItemStatus`, `ItemPriority`, `ItemType` with corresponding `*_LABELS` and `*_COLORS` maps
  - `ALLOWED_TRANSITIONS` map for valid status transitions

---

## Requirements

### Must Do:

1. **Status column:** Replace the read-only `StatusBadge` with an inline dropdown. Clicking the badge opens a dropdown showing only valid transitions from the current status (using `ALLOWED_TRANSITIONS`). On selection, call `updateItemStatus()`. Show current status as selected/highlighted.

2. **Priority column:** Replace the read-only `PriorityBadge` with an inline dropdown. Clicking the badge opens a dropdown with all 4 priority options. On selection, call `updateItemField(id, 'priority', value)`.

3. **Type column:** Replace the read-only `TypeBadge` with an inline dropdown. Clicking the badge opens a dropdown with all 5 type options. On selection, call `updateItemField(id, 'type', value)`.

4. **Assignee column:** Replace the static text with an inline dropdown. Clicking shows a user list (from the `userMap` prop already passed to TaskTable, plus the `users` list from `listAssignableUsers()`). On selection, call `assignItem(id, userId)`. Include "Unassigned" option.

5. **Area column:** Replace the static text with an inline text input or dropdown. Since area is a free-text field, clicking it should show an inline text input. On blur or Enter, call `updateItemField(id, 'area', value)`. Escape cancels the edit.

6. **After any mutation succeeds, update the local item state optimistically** so the UI reflects the change immediately without a full page reload. Pass an `onItemUpdated` callback from the backlog page that triggers a `loadItems()` refresh.

7. **Clicking any inline dropdown must NOT trigger the row's `onClick` navigation** to the detail page. Use `e.stopPropagation()` on the dropdown container.

8. **All dropdowns must close on outside click** (mousedown listener pattern from KanbanCard).

### Must NOT Do:

- Do NOT change the table's column layout, widths, or ordering
- Do NOT modify pm-queries.ts or pm-types.ts (use existing RPCs and types as-is)
- Do NOT add new dependencies/packages
- Do NOT implement drag-and-drop or multi-select inline editing
- Do NOT change the HierarchyTree view (tree mode is out of scope)

---

## Acceptance Criteria

- [ ] Clicking a Status badge in the table opens a dropdown showing only valid next statuses
- [ ] Clicking a Priority badge opens a dropdown with all 4 priority options
- [ ] Clicking a Type badge opens a dropdown with all 5 type options
- [ ] Clicking an Assignee cell opens a dropdown with all assignable users + "Unassigned"
- [ ] Clicking an Area cell allows inline text editing
- [ ] All dropdowns close on outside click
- [ ] All mutations call the correct RPC and update the UI on success
- [ ] Row click-to-navigate still works on non-editable cells (ID, Title, Est, Created)
- [ ] `npm run type-check` passes in admin-portal
- [ ] No console errors during inline editing operations

---

## Files to Modify

- `admin-portal/app/dashboard/pm/components/TaskTable.tsx` - Add inline editing dropdowns for all 5 columns
- `admin-portal/app/dashboard/pm/backlog/page.tsx` - Pass `onItemUpdated` callback and users list to TaskTable

## Files to Read (for context)

- `admin-portal/app/dashboard/pm/components/KanbanCard.tsx` - Reference patterns for PriorityDropdown, AssigneeDropdown
- `admin-portal/lib/pm-queries.ts` - Available RPCs
- `admin-portal/lib/pm-types.ts` - Enum types, LABELS/COLORS maps, ALLOWED_TRANSITIONS

---

## Testing Expectations

### Unit Tests
- **Required:** No (UI polish, pattern already established in KanbanCard)
- **Existing tests to verify:** `npm test` must pass without regression

### CI Requirements
- [ ] `npm run type-check` passes (admin-portal)
- [ ] `npm run lint` passes (admin-portal)
- [ ] No new TypeScript errors

---

## PR Preparation

- **Title:** `feat(pm): add inline editing to backlog table for status, priority, type, assignee, area`
- **Branch:** `feature/task-2227-backlog-inline-editing`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-17*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test) -- 60/60 pass
- [x] Type check passes (tsc --noEmit) -- zero errors
- [x] Lint passes (npm run lint) -- no new warnings

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Backlog table shows read-only badges for status/priority/type and plain text for assignee/area
- **After**: All 5 columns are inline-editable via dropdown/input directly in the table
- **Actual Tokens**: ~_K (Est: 30K)
- **PR**: [URL after PR created]

### Implementation Details

**TaskTable.tsx changes:**
- Added 5 inline editing sub-components: `InlineStatusDropdown`, `InlinePriorityDropdown`, `InlineTypeDropdown`, `InlineAssigneeDropdown`, `InlineAreaEditor`
- Status dropdown shows only valid transitions using `ALLOWED_TRANSITIONS` map
- Priority/Type dropdowns show all options with current value highlighted
- Assignee dropdown includes "Unassigned" option, uses `assignItem` RPC
- Area uses inline text input with Enter to save, Escape to cancel, blur to save
- All dropdown containers use `e.stopPropagation()` to prevent row navigation
- All dropdowns close on outside click via `mousedown` listener pattern (same as KanbanCard)
- New props `onItemUpdated` and `users` are optional -- backward compatible with existing usages
- Added `data-inline-edit` attribute to editable cells for row click detection

**backlog/page.tsx changes:**
- Added `users` state to store raw user list alongside userMap
- Pass `onItemUpdated={loadItems}` and `users={users}` to TaskTable

### Notes

**Deviations from plan:**
None. Implementation follows the task spec exactly.

**Issues encountered:**
None. Worktree had no node_modules (expected for worktrees), ran npm install before type-checking.

---

## Guardrails

**STOP and ask PM if:**
- You need to modify pm-queries.ts or pm-types.ts
- The ALLOWED_TRANSITIONS map does not cover a needed transition
- You discover the TaskTable is used in other pages that would be affected
- You encounter blockers not covered in the task file
