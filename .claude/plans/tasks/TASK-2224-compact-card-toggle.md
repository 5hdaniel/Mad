# TASK-2224: Board -- Compact Card Toggle (Title-Only View)

**Backlog ID:** BACKLOG-1019
**Sprint:** SPRINT-141
**Phase:** 3 (Medium Features)
**Branch:** `feature/task-2224-compact-card-toggle`
**Estimated Tokens:** ~15K (ui category, x1.0 multiplier)

---

## Objective

Add a compact card toggle to the board page header that collapses Kanban cards to a title-only view. This increases density when users want to see more cards at once without the full card details (priority, assignee, labels).

---

## Context

After TASK-2221 (Kanban Card Redesign), cards show 4 rows: checkbox+ID|priority, title, assignee|labels. The compact mode collapses this to just the title row with a minimal ID prefix.

**DEPENDENCY:** This task MUST wait for TASK-2221 to merge first, as it modifies the same `KanbanCard.tsx` component.

---

## Requirements

### Must Do:
1. **Add a "Compact" toggle button** in the board page header bar (next to the swim lane selector)
   - Toggle between "Default" and "Compact" views
   - Persist preference in localStorage (alongside the board state from TASK-2220)
2. **Pass `compact` prop to KanbanCard** -- When true, render title-only layout
3. **Compact layout:** Show only:
   - Legacy ID (inline, before title, gray monospace)
   - Title (single line, truncated)
   - Small colored dot for priority (instead of pill)
4. **Default layout:** Full 4-row layout from TASK-2221 (no change)
5. **Ensure drag-and-drop still works in compact mode**

### Must NOT Do:
- Do NOT modify the DnD logic in KanbanBoard or KanbanColumn
- Do NOT change the card redesign from TASK-2221 (only add the compact variant)
- Do NOT add new npm dependencies

---

## Acceptance Criteria

- [ ] Board header has a "Compact" toggle button (icon or segmented control)
- [ ] Clicking toggle switches all cards between default and compact view
- [ ] Compact view: cards show only ID + title + priority dot (single row)
- [ ] Default view: full 4-row card layout (from TASK-2221)
- [ ] Compact preference persists via localStorage
- [ ] Cards remain draggable in compact mode
- [ ] Card title still links to task detail page in compact mode
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/components/KanbanCard.tsx` -- Add `compact` prop and compact render path
- `admin-portal/app/dashboard/pm/board/page.tsx` -- Add compact toggle button and pass prop through KanbanBoard -> KanbanColumn -> KanbanCard

## Files to Read (for context)

- `admin-portal/app/dashboard/pm/components/KanbanBoard.tsx` -- How props flow to columns
- `admin-portal/app/dashboard/pm/components/KanbanColumn.tsx` -- How props flow to cards

---

## Implementation Notes

**KanbanCard compact mode:**

```tsx
interface KanbanCardProps {
  item: PmBacklogItem;
  isDragOverlay?: boolean;
  isSelected?: boolean;
  compact?: boolean;          // NEW
  onToggleSelect?: () => void;
  onItemUpdated?: () => void;
}

// Inside the component:
if (compact) {
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
         className="bg-white rounded border border-gray-200 px-2 py-1.5 cursor-grab hover:bg-gray-50 flex items-center gap-2">
      {/* Priority dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT_COLORS[item.priority]}`} />
      {/* ID */}
      {item.legacy_id && (
        <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{item.legacy_id}</span>
      )}
      {/* Title */}
      <Link href={`/dashboard/pm/tasks/${item.id}`}
            className="text-xs text-gray-800 truncate flex-1"
            onClick={e => e.stopPropagation()}>
        {item.title}
      </Link>
    </div>
  );
}

// Priority dot color map:
const PRIORITY_DOT_COLORS: Record<ItemPriority, string> = {
  low: 'bg-gray-300',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
};
```

**Board header toggle:**

Add next to the SwimLaneSelector:
```tsx
<button
  onClick={() => {
    setCompactCards(!compactCards);
    // Persist to localStorage (extend BOARD_STATE_KEY from TASK-2220)
  }}
  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
    compactCards
      ? 'bg-blue-50 border-blue-200 text-blue-700'
      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
  }`}
>
  <List className="h-3.5 w-3.5" />
  Compact
</button>
```

**Prop threading:**
The `compact` boolean needs to flow: `BoardPage -> KanbanBoard -> KanbanColumn -> KanbanCard`.

Check if KanbanBoard and KanbanColumn already have a generic props passthrough, or add the `compact` prop to their interfaces.

**localStorage integration:**
If TASK-2220 (swim lane collapse persistence) is already merged, extend the same `BoardPersistedState` interface:
```typescript
interface BoardPersistedState {
  selectedSprintId: string;
  swimLane: SwimLaneMode;
  collapsedLanes: string[];
  compactCards: boolean;  // NEW
}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Board page: verify "Compact" toggle appears in header
  2. Click toggle: all cards collapse to single-line title-only view
  3. Click toggle again: cards expand to full 4-row layout
  4. Compact mode: verify priority dot color matches item priority
  5. Compact mode: click card title navigates to detail page
  6. Compact mode: drag card between columns works
  7. Refresh page: compact preference persists

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(pm): compact card toggle for board view`
- **Branch:** `feature/task-2224-compact-card-toggle`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 15K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- TASK-2221 is not yet merged (hard dependency)
- Prop threading through KanbanBoard -> KanbanColumn -> KanbanCard requires significant refactoring
- The compact layout does not fit well with the card redesign from TASK-2221
- You encounter blockers not covered in the task file
