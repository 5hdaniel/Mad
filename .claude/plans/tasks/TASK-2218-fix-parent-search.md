# TASK-2218: Fix Parent Item Search Not Working

**Backlog ID:** BACKLOG-1020
**Sprint:** SPRINT-141
**Phase:** 1 (Bug Fixes)
**Branch:** `fix/task-2218-parent-search`
**Estimated Tokens:** ~15K (ui category, x1.0 multiplier)

---

## Objective

Fix the parent item search in the Create Backlog Item dialog (`CreateTaskDialog.tsx`). When the user clicks "Select parent item..." and types a query, the search should return matching items that can be selected as the parent. Currently, the search is not returning results.

---

## Context

The Create dialog uses `searchItemsForLink()` from `pm-queries.ts` which calls the `pm_search_items_for_link` RPC. The parent search behavior was adapted from the same RPC used in `DependencyPanel.tsx` and `LinkedItemsPanel.tsx`.

**Current behavior:** User clicks "Select parent item...", types in the search box, but no results appear (or results don't show up properly).

**Expected behavior:** Typing at least 1 character should trigger a debounced search against `pm_search_items_for_link`, and results should appear as clickable buttons below the search input.

---

## Requirements

### Must Do:
1. **Investigate the root cause** -- Is the RPC failing? Is the response empty? Is the UI not rendering results?
   - Open browser DevTools Network tab, filter for `pm_search_items_for_link`
   - Check if the RPC is being called at all
   - Check if the response contains data
2. **Fix the search** so results appear when typing in the parent search field
3. **Verify the search excludes self** -- The `searchItemsForLink` call in CreateTaskDialog currently does NOT pass an `excludeId` (because the item doesn't exist yet). Confirm this is correct.
4. **Verify selection works** -- After selecting a parent, the selected parent should display with title and X button to clear

### Must NOT Do:
- Do NOT change the `pm_search_items_for_link` RPC unless it has a confirmed bug
- Do NOT modify `DependencyPanel.tsx` or `LinkedItemsPanel.tsx` (separate fix)
- Do NOT add new dependencies

---

## Acceptance Criteria

- [ ] User can click "Select parent item..." in Create dialog
- [ ] Typing 1+ characters triggers search and shows results within ~300ms debounce
- [ ] Results show `legacy_id` (if present) and title for each item
- [ ] Clicking a result selects it as parent (shows in green box with X to clear)
- [ ] Clearing parent (clicking X) resets to "Select parent item..." link
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## Files to Modify

- `admin-portal/app/dashboard/pm/components/CreateTaskDialog.tsx` -- Fix parent search behavior

## Files to Read (for context)

- `admin-portal/lib/pm-queries.ts` -- `searchItemsForLink()` function (line ~353)
- `admin-portal/app/dashboard/pm/components/DependencyPanel.tsx` -- Working search reference
- `admin-portal/app/dashboard/pm/components/LinkedItemsPanel.tsx` -- Another working search reference

---

## Implementation Notes

**Likely root causes to investigate (in order):**

1. **RPC not being called** -- Check if `parentQuery` state is updating. The `useEffect` at line 106 depends on `parentQuery`. Add a `console.log` to verify.

2. **RPC call failing silently** -- The catch block at line 121 swallows errors. Temporarily add `console.error` to see if the RPC throws.

3. **Response shape mismatch** -- `searchItemsForLink` returns `PmItemSearchResult[]`. Verify the response matches `{ id, title, legacy_id, status, type, priority }`.

4. **UI render conditional blocking results** -- Check the conditional at line 339: `!searchingParent && parentResults.length > 0`. If `searchingParent` is never set to false (race condition), results won't render.

**Fix pattern (based on working reference in DependencyPanel.tsx):**

The DependencyPanel search at lines 63-89 follows the same pattern. Compare the two implementations. The key difference is that CreateTaskDialog calls `searchItemsForLink(parentQuery)` without `excludeId`, which should be fine for parent selection.

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Manual testing:** Open Create dialog, type "BACKLOG" or any known item title fragment, verify results appear

### CI Requirements
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `fix(pm): parent item search in Create Backlog Item dialog`
- **Branch:** `fix/task-2218-parent-search`
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
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Parent search in CreateTaskDialog did not reliably show results; race condition in async effect could leave searchingParent stuck as true or apply stale results; search input did not auto-focus; Enter key in search submitted the form; results showed truncated UUID instead of legacy_id; selected parent displayed in gray
- **After**: Added cancelled-flag pattern to async search effect preventing race conditions; added ref + autoFocus on search input; prevented Enter key from submitting form; results show legacy_id when present; selected parent displays in green with legacy_id
- **Actual Tokens**: ~15K (Est: 15K)
- **PR**: pending

### Notes

**Deviations from plan:**
None. Fixed the search within CreateTaskDialog.tsx only as specified.

**Issues encountered:**
Root cause was a combination of: (1) async race condition in useEffect -- no cancellation mechanism for in-flight RPC calls, allowing stale results or stuck searchingParent state; (2) missing autoFocus on search input; (3) Enter key in search input submitting the parent form. The RPC and pm-queries.ts function were both correct and did not need changes.

---

## Guardrails

**STOP and ask PM if:**
- The RPC itself returns empty results (needs Supabase investigation)
- The fix requires changing pm-queries.ts function signatures
- You encounter blockers not covered in the task file
