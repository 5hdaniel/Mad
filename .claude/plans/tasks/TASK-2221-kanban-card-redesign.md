# TASK-2221: Kanban Card Redesign -- Compact Layout + Inline Editing

**Backlog ID:** BACKLOG-994
**Sprint:** SPRINT-141
**Phase:** 2 (Core Features)
**Branch:** `feature/task-2221-kanban-card-redesign`
**Estimated Tokens:** ~35K (ui category, x1.0 multiplier)

---

## Objective

Redesign the KanbanCard component for higher information density and in-place editing. The new layout should show: Row 1 (checkbox + legacy_id | priority pill), Row 2-3 (title, line-clamp-2), Row 4 (assignee avatar+name | labels). Add inline editing for priority, assignee, and labels directly from the card. Also fix empty column drag-and-drop behavior.

---

## Context

The current KanbanCard (`KanbanCard.tsx`, 128 lines) shows:
- Checkbox (bulk select)
- Legacy ID
- Title (link, line-clamp-2)
- Bottom row: priority badge + assignee circle
- Labels

The redesign compacts the layout and adds inline editing so users can change priority, assignee, and labels without navigating to the detail page.

---

## Requirements

### Must Do:
1. **Redesign card layout** with these rows:
   - **Row 1:** Checkbox (left) + legacy_id (left) | Priority pill (right) -- priority pill is clickable for inline edit
   - **Row 2-3:** Title (line-clamp-2, clickable link to detail page)
   - **Row 4:** Assignee avatar+name (left) | Label pills (right, max 2 visible + overflow count)

2. **Inline priority editing:** Click the priority pill -> dropdown appears with options (low/medium/high/critical). Selecting one calls `updateItemField(item.id, 'priority', newValue)` and updates the card.

3. **Inline assignee editing:** Click the assignee area -> dropdown of assignable users appears (via `listAssignableUsers()`). Selecting one calls `assignItem(item.id, userId)`.

4. **Inline label editing:** Click the labels area -> LabelPicker-style dropdown appears. Can add/remove labels.

5. **Fix empty column drag-drop:** Ensure dragging a card into an empty column works. The `useDroppable` on KanbanColumn should accept drops even when the column has 0 cards. The `min-h-[8rem]` on the card container ensures a droppable area exists.

6. **Keep the card draggable** -- The `useSortable` hook must still work. Inline editing should use `onClick` with `e.stopPropagation()` to not interfere with drag.

### Must NOT Do:
- Do NOT add inline title editing (title editing stays on detail page)
- Do NOT change the DnD library or board-level DnD logic
- Do NOT add new npm dependencies

### SR Review Update:
- You MAY modify `board/page.tsx`, `KanbanBoard.tsx`, and `KanbanColumn.tsx` for prop threading (e.g., passing `onItemUpdated` callback and `users` list down the chain)
- `listAssignableUsers()` MUST be loaded ONCE at board page level and passed down as props — do NOT call it per card
- The original "Do NOT modify board/page.tsx" constraint is RELAXED for prop threading only

---

## Acceptance Criteria

- [ ] Card layout matches the 4-row design: checkbox+id|priority, title, assignee|labels
- [ ] Priority pill is clickable; dropdown lets user change priority inline
- [ ] Priority change calls RPC and updates card without full board reload
- [ ] Assignee area is clickable; dropdown shows user list
- [ ] Assignee change calls RPC and updates card without full board reload
- [ ] Labels area is clickable; can add/remove labels inline
- [ ] Card is still draggable (useSortable works)
- [ ] Inline edit dropdowns close when clicking outside
- [ ] Empty columns accept card drops (no regression)
- [ ] Card title links to task detail page
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/components/KanbanCard.tsx` -- Complete redesign
- `admin-portal/app/dashboard/pm/components/KanbanColumn.tsx` -- May need minor adjustments for empty column fix

## Files to Read (for context)

- `admin-portal/lib/pm-queries.ts` -- `updateItemField()`, `assignItem()`, `listAssignableUsers()`, `addItemLabel()`, `removeItemLabel()`, `listLabels()`
- `admin-portal/lib/pm-types.ts` -- `PmBacklogItem`, `ItemPriority`, `PRIORITY_LABELS`, `PRIORITY_COLORS`
- `admin-portal/app/dashboard/pm/components/LabelPicker.tsx` -- Existing label picker pattern to reuse
- `admin-portal/app/dashboard/pm/components/TaskSidebar.tsx` -- Existing assignee/priority edit pattern

---

## Implementation Notes

**New KanbanCard layout:**

```tsx
<div ref={setNodeRef} style={style} {...attributes} {...listeners}
     className="bg-white rounded-lg border p-2.5 cursor-grab ...">
  {/* Row 1: Checkbox + ID | Priority pill */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {onToggleSelect && <input type="checkbox" ... />}
      <span className="text-xs text-gray-400 font-mono">{item.legacy_id}</span>
    </div>
    <PriorityDropdown priority={item.priority} onUpdate={...} />
  </div>

  {/* Row 2-3: Title */}
  <Link href={...} className="block text-sm font-medium text-gray-900 mt-1 line-clamp-2"
        onClick={e => e.stopPropagation()}>
    {item.title}
  </Link>

  {/* Row 4: Assignee | Labels */}
  <div className="flex items-center justify-between mt-2">
    <AssigneeDropdown assigneeId={item.assignee_id} onUpdate={...} />
    <LabelChips labels={item.labels} onUpdate={...} />
  </div>
</div>
```

**Inline dropdown pattern:**
```tsx
function PriorityDropdown({ priority, onUpdate }: { priority: ItemPriority; onUpdate: (p: ItemPriority) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={(e) => { e.preventDefault(); setOpen(!open); }}
              className={`px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[priority]}`}>
        {PRIORITY_LABELS[priority]}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-20 py-1 w-28">
          {(['low','medium','high','critical'] as ItemPriority[]).map(p => (
            <button key={p} onClick={() => { onUpdate(p); setOpen(false); }}
                    className="w-full text-left px-3 py-1 text-xs hover:bg-gray-50">
              <span className={`inline-block px-1.5 py-0.5 rounded ${PRIORITY_COLORS[p]}`}>
                {PRIORITY_LABELS[p]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Important: stopPropagation on all interactive elements**
All clickable elements inside the card (checkbox, priority dropdown, assignee dropdown, label picker, title link) MUST call `e.stopPropagation()` to prevent triggering the drag handler.

**KanbanCard props will expand:**
```typescript
interface KanbanCardProps {
  item: PmBacklogItem;
  isDragOverlay?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onItemUpdated?: () => void;  // NEW: callback when card data changes via inline edit
}
```

The parent `KanbanBoard` (which renders via `KanbanColumn`) needs to pass `onItemUpdated` so the board refreshes after an inline edit. Check if the existing `onStatusChange` callback pattern works, or add a new prop.

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Board page, verify cards show new 4-row layout
  2. Click priority pill -> dropdown opens -> select "High" -> pill updates to orange "High"
  3. Click assignee area -> user dropdown opens -> select user -> avatar+name updates
  4. Click label area -> can add/remove labels
  5. Drag card between columns -> works as before
  6. Drag card to empty column -> card drops successfully
  7. Click title -> navigates to task detail

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(pm): redesign KanbanCard with compact layout and inline editing`
- **Branch:** `feature/task-2221-kanban-card-redesign`
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
- **Actual Tokens**: ~XK (Est: 35K)
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
- Inline editing dropdowns conflict with drag-and-drop in a way that cannot be solved with stopPropagation
- The card becomes too tall for the compact design goal (should be shorter or equal height to current card)
- listAssignableUsers() returns empty or fails (RPC issue)
- You need to modify KanbanBoard.tsx or board/page.tsx significantly
- You encounter blockers not covered in the task file
