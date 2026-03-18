# TASK-2220: Fix Swim Lane Collapse State Lost on Navigation

**Backlog ID:** BACKLOG-1024
**Sprint:** SPRINT-141
**Phase:** 1 (Bug Fixes)
**Branch:** `fix/task-2220-swim-lane-collapse`
**Estimated Tokens:** ~12K (ui category, x1.0 multiplier)

---

## Objective

Fix the board page so that swim lane collapse/expand state persists when the user navigates away and returns. Currently, if a user collapses a swim lane, navigates to a task detail page, and comes back to the board, all lanes are expanded again.

---

## Context

The board page (`board/page.tsx`) maintains `collapsedLanes` as a `useState<Set<string>>`. This state is lost on any navigation because the component unmounts and remounts.

The swim lane toggle at line 486-489 also resets `collapsedLanes` to `new Set()` when changing modes:
```tsx
onChange={(mode) => {
  setSwimLane(mode);
  setCollapsedLanes(new Set());  // <-- resets all collapse state
}}
```

This is acceptable for mode changes but the state should persist across navigation within the same mode.

---

## Requirements

### Must Do:
1. **Persist `collapsedLanes` state** using one of:
   - `localStorage` (recommended -- simple, survives page reload)
   - URL search params (over-engineering for this use case)
2. **Persist `swimLane` mode** alongside collapse state
3. **Restore state on mount** -- When the board page loads, read persisted state and apply it
4. **Clear collapse state when swim lane mode changes** -- This is correct existing behavior, but also clear the persisted state for the old mode
5. **Persist selected sprint ID** -- So the user returns to the same sprint they were viewing

### Must NOT Do:
- Do NOT use a global state management library (no Redux, Zustand, etc.)
- Do NOT modify the KanbanBoard, KanbanCard, or KanbanColumn components
- Do NOT change the DnD behavior

---

## Acceptance Criteria

- [ ] User collapses a swim lane, navigates to task detail, comes back -- lane is still collapsed
- [ ] User changes swim lane mode -- all lanes reset to expanded (existing behavior preserved)
- [ ] User selects a sprint, navigates away, returns -- same sprint is selected
- [ ] Swim lane mode persists across navigation
- [ ] Page reload restores swim lane mode, collapsed lanes, and selected sprint
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/board/page.tsx` -- Add localStorage persistence for board UI state

## Files to Read (for context)

- `admin-portal/app/dashboard/pm/board/page.tsx` -- Current state management (lines 91-120)

---

## Implementation Notes

**Recommended approach: localStorage with a single key**

```typescript
const BOARD_STATE_KEY = 'pm-board-state';

interface BoardPersistedState {
  selectedSprintId: string;
  swimLane: SwimLaneMode;
  collapsedLanes: string[];  // Set serialized as array
}

// On mount: restore from localStorage
useEffect(() => {
  try {
    const saved = localStorage.getItem(BOARD_STATE_KEY);
    if (saved) {
      const parsed: BoardPersistedState = JSON.parse(saved);
      if (parsed.selectedSprintId) setSelectedSprintId(parsed.selectedSprintId);
      if (parsed.swimLane) setSwimLane(parsed.swimLane);
      if (parsed.collapsedLanes) setCollapsedLanes(new Set(parsed.collapsedLanes));
    }
  } catch {
    // Ignore corrupted localStorage
  }
}, []);  // Only on mount

// Persist whenever state changes
useEffect(() => {
  const state: BoardPersistedState = {
    selectedSprintId,
    swimLane,
    collapsedLanes: Array.from(collapsedLanes),
  };
  localStorage.setItem(BOARD_STATE_KEY, JSON.stringify(state));
}, [selectedSprintId, swimLane, collapsedLanes]);
```

**Caution with initial sprint load:**
The existing `loadSprints` effect (lines 126-143) auto-selects the first active sprint. This should only apply when there is NO persisted sprint ID. The restore logic should set `selectedSprintId` BEFORE the sprint list loads, so the auto-select check should be:
```typescript
if (!selectedSprintId && initial) {
  setSelectedSprintId(initial.id);
}
```

But since state initializes as `''`, the check needs to be:
```typescript
// Only auto-select if no persisted sprint was restored
const [restoredSprintId, setRestoredSprintId] = useState<string | null>(null);
```

Or simpler: read localStorage synchronously in the initial `useState`:
```typescript
const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(BOARD_STATE_KEY);
    if (saved) return JSON.parse(saved).selectedSprintId || '';
  } catch {}
  return '';
});
```

This avoids race conditions with the auto-select sprint logic.

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:**
  1. Go to board, select a sprint, switch swim lane to "project"
  2. Collapse one swim lane
  3. Click a card title to go to task detail
  4. Click "Back to Backlog" or use browser back
  5. Verify: same sprint, same swim lane mode, collapsed lane still collapsed
  6. Refresh the page -- state persists
  7. Change swim lane mode -- collapsed lanes reset (correct behavior)

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `fix(pm): persist board swim lane collapse state across navigation`
- **Branch:** `fix/task-2220-swim-lane-collapse`
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
- **Actual Tokens**: ~XK (Est: 12K)
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
- localStorage is not available in the Next.js server component context (should be fine since board/page.tsx is 'use client')
- The sprint auto-select logic conflicts with restore logic in an unexpected way
- You encounter blockers not covered in the task file
