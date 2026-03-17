# Task TASK-2204: PM Panel/Picker Components (Links, Dependencies, Labels, Tree, Create Dialog)

**Status:** Pending
**Backlog ID:** BACKLOG-964
**Sprint:** SPRINT-137
**Phase:** Phase 2a -- Shared Components (Parallel)
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2204-pm-panel-picker-components`
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

Create five components for managing item relationships and creation: a linked items panel (related/blocked-by items), a dependency panel, a label picker with color support, a hierarchy tree for parent-child item browsing, and a create-item dialog. These are used on both the backlog page and the task detail page.

## Non-Goals

- Do NOT create the backlog page or detail page (TASK-2205/2206)
- Do NOT create badge, table, filter, sidebar, or timeline components (other tasks)
- Do NOT modify any existing support components
- Do NOT add npm dependencies
- Do NOT implement drag-and-drop (Sprint C)

## Deliverables

1. New file: `admin-portal/app/dashboard/pm/components/LinkedItemsPanel.tsx` (~180 lines)
2. New file: `admin-portal/app/dashboard/pm/components/DependencyPanel.tsx` (~150 lines)
3. New file: `admin-portal/app/dashboard/pm/components/LabelPicker.tsx` (~140 lines)
4. New file: `admin-portal/app/dashboard/pm/components/HierarchyTree.tsx` (~170 lines)
5. New file: `admin-portal/app/dashboard/pm/components/CreateTaskDialog.tsx` (~350 lines)

## File Boundaries

### Files to modify (owned by this task):

- `admin-portal/app/dashboard/pm/components/LinkedItemsPanel.tsx` (new)
- `admin-portal/app/dashboard/pm/components/DependencyPanel.tsx` (new)
- `admin-portal/app/dashboard/pm/components/LabelPicker.tsx` (new)
- `admin-portal/app/dashboard/pm/components/HierarchyTree.tsx` (new)
- `admin-portal/app/dashboard/pm/components/CreateTaskDialog.tsx` (new)

### Files this task must NOT modify:

- `admin-portal/lib/pm-types.ts` -- Owned by TASK-2200
- `admin-portal/lib/pm-queries.ts` -- Owned by TASK-2200
- Any badge components -- Owned by TASK-2201
- Any table/filter components -- Owned by TASK-2202
- Any detail components -- Owned by TASK-2203
- Any support components

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `LinkedItemsPanel` shows linked items with link type, supports search + link/unlink
- [ ] `DependencyPanel` shows depends-on and blocks relationships, supports add/remove with circular dep validation feedback
- [ ] `LabelPicker` shows existing labels as colored pills, supports adding/removing labels with multi-select
- [ ] `HierarchyTree` renders indented tree of parent/child items, supports expand/collapse
- [ ] `CreateTaskDialog` provides a modal form for creating new backlog items with all required fields
- [ ] All components use RPCs from `@/lib/pm-queries` for data operations
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### LinkedItemsPanel.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/RelatedTicketsPanel.tsx` (342 lines)

**Changes from support RelatedTicketsPanel:**
- Replace ticket terminology with item terminology
- Link types: `blocked_by`, `blocks`, `related_to`, `parent_child` (instead of `related`, `duplicate`, `parent`, `child`)
- Use `searchItemsForLink()` for the inline search
- Use `linkItems()` / `unlinkItems()` for link/unlink operations
- Navigate to `/dashboard/pm/tasks/${item.id}` on click

**Props interface:**
```typescript
interface LinkedItemsPanelProps {
  itemId: string;
  links: PmTaskLink[];
  onUpdate: () => void;
}
```

**Each link shows:** item_number, title, status badge (inline colored span), link type label.

### DependencyPanel.tsx

**NEW component** (no direct support equivalent). Shows "Depends On" and "Blocks" sections.

**Layout:**
```
Dependencies
  Depends On:
    [BACKLOG-123] Fix auth flow  [x remove]
    [+ Add dependency]
  Blocks:
    [BACKLOG-456] Deploy script  [x remove]
```

**Implementation:**
- On mount, dependencies are passed in as props (from detail response)
- "Add dependency" opens an inline search (same pattern as LinkedItemsPanel search)
- Adding calls `addDependency(itemId, targetId, 'depends_on')` -- the RPC validates no circular deps
- If RPC throws circular dep error, show inline error message
- Removing calls `removeDependency(dependencyId)`

**Props interface:**
```typescript
interface DependencyPanelProps {
  itemId: string;
  dependencies: PmDependency[];
  onUpdate: () => void;
}
```

### LabelPicker.tsx

**NEW component**. Multi-select label/tag picker with colors.

**Layout:**
```
Labels: [bug-fix] [high-priority] [+ Add label]
        ┌─────────────────────┐
        │ Search labels...    │
        │ [x] bug-fix         │  (checked = already applied)
        │ [ ] enhancement     │
        │ [ ] documentation   │
        │ + Create "new-label"│
        └─────────────────────┘
```

**Implementation:**
- Shows currently applied labels as `LabelBadge` pills (import from sibling -- but since TASK-2201 is parallel, render inline with `style={{ backgroundColor, color }}`)
- Click "Add" opens a dropdown populated from `listLabels()`
- Checking a label calls `addItemLabel(itemId, labelId)`
- Unchecking calls `removeItemLabel(itemId, labelId)`
- If search text doesn't match existing labels, show "Create 'X'" option that calls `createLabel(name)`
- Each label shows its color dot next to the name

**Props interface:**
```typescript
interface LabelPickerProps {
  itemId: string;
  currentLabels: PmLabel[];
  onUpdate: () => void;
}
```

### HierarchyTree.tsx

**NEW component**. Renders a tree view of items with parent-child relationships.

**Used on the backlog page** when "tree mode" is toggled on. Shows items indented by their parent_id hierarchy.

**Layout:**
```
v [BACKLOG-100] Epic: Admin Portal Improvements
    v [BACKLOG-101] Feature: Dark Mode
        [BACKLOG-102] Task: Add theme toggle
        [BACKLOG-103] Task: Dark mode CSS
    > [BACKLOG-104] Feature: Performance (3 children)
```

**Implementation:**
- Receives a flat list of items, builds tree in-memory using `parent_id`
- Each node is collapsible (v = expanded, > = collapsed)
- Click on item navigates to detail page
- Shows item_number, title, status color dot, child count
- Indent using `pl-${depth * 4}` Tailwind classes (max depth 4)
- Lazy-load children: when expanding a node that has `child_count > 0` but no loaded children, call `listItems({ parent_id: itemId })`

**Props interface:**
```typescript
interface HierarchyTreeProps {
  items: PmBacklogItem[]; // root-level items (parent_id = null)
  onItemClick: (itemId: string) => void;
}
```

### CreateTaskDialog.tsx

**Pattern template:** `admin-portal/app/dashboard/support/components/CreateTicketDialog.tsx` (613 lines) -- **simplified**

**Changes from support CreateTicketDialog:**
- Remove requester search, contact fields, recent tickets panel
- Replace form fields with PM fields:
  - Title (required text input)
  - Description (optional textarea)
  - Type (dropdown: feature/bug/chore/refactor/test/docs/security/performance)
  - Priority (dropdown: low/medium/high/critical)
  - Area (dropdown: admin-portal/electron/broker-portal/service/schema/ui)
  - Parent (optional -- search + select for nesting under an epic)
  - Sprint (optional dropdown from `listSprints()`)
  - Project (optional dropdown from `listProjects()`)
  - Est Tokens (optional number input)
  - Start Date / Due Date (optional date inputs)
- On submit, call `createItem()` from pm-queries
- On success, call `onCreated()` callback and close dialog

**Props interface:**
```typescript
interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultParentId?: string; // pre-fill parent for "add child" action
  defaultSprintId?: string; // pre-fill sprint
  defaultProjectId?: string; // pre-fill project
}
```

**Dialog pattern:** Use the same dialog/overlay pattern as CreateTicketDialog:
```tsx
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="fixed inset-0 bg-black/50" onClick={onClose} />
    <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      {/* form content */}
    </div>
  </div>
)}
```

## Integration Notes

- **Imports from:** `@/lib/pm-types`, `@/lib/pm-queries` (TASK-2200)
- **Used by:** TASK-2205 (Backlog page uses HierarchyTree + CreateTaskDialog), TASK-2206 (Detail page uses LinkedItemsPanel + DependencyPanel + LabelPicker)
- **Parallel with:** TASK-2201, TASK-2202, TASK-2203 (different files, no overlap)

## Do / Don't

### Do:
- Follow the RelatedTicketsPanel pattern for search + link/unlink UI
- Use inline error display for circular dependency violations
- Show loading spinners during async operations
- Use `text-gray-900 bg-white` on all form inputs
- Keep the CreateTaskDialog form simple (no multi-step wizard)

### Don't:
- Do NOT implement drag-and-drop in HierarchyTree (Sprint C feature)
- Do NOT add file attachments to CreateTaskDialog (v2)
- Do NOT implement bulk label operations
- Do NOT recurse deeper than 4 levels in HierarchyTree
- Do NOT fetch all items for HierarchyTree -- use parent_id filtering

## When to Stop and Ask

- If `pm-queries.ts` doesn't have `searchItemsForLink`, `linkItems`, `unlinkItems`
- If `addDependency` RPC circular dep error format is unclear
- If HierarchyTree performance is poor with large item counts (>500)
- If you need to add RPCs not defined in pm-queries.ts

## Testing Expectations

### Unit Tests
- **Required:** No (interactive components verified via type-check + manual testing)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## PR Preparation

- **Title:** `feat(pm): add linked items, dependencies, labels, hierarchy, and create dialog`
- **Branch:** `feature/TASK-2204-pm-panel-picker-components`
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
| Code volume | ~990 lines total | +10K |
| LinkedItemsPanel | Adapts from RelatedTicketsPanel | -3K |
| CreateTaskDialog | Adapts from CreateTicketDialog | -2K |
| New components | DependencyPanel, LabelPicker, HierarchyTree | +8K |

**Confidence:** Medium

**Risk factors:**
- HierarchyTree lazy-loading requires careful state management
- DependencyPanel circular dep error handling from RPC
- CreateTaskDialog is large but well-templated

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
- [ ] admin-portal/app/dashboard/pm/components/LinkedItemsPanel.tsx
- [ ] admin-portal/app/dashboard/pm/components/DependencyPanel.tsx
- [ ] admin-portal/app/dashboard/pm/components/LabelPicker.tsx
- [ ] admin-portal/app/dashboard/pm/components/HierarchyTree.tsx
- [ ] admin-portal/app/dashboard/pm/components/CreateTaskDialog.tsx

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
