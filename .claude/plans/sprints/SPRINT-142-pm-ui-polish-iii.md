# SPRINT-142: PM UI Polish III

**Sprint ID (Supabase):** `5d564ed5-293d-4621-99de-de21786988e3`
**Status:** Active
**Created:** 2026-03-17

---

## Sprint Goal

Deliver inline editing across the PM module -- backlog table, board cards, and detail pages -- plus minor board layout and sprint management improvements. Focus is on reducing the click-to-navigate pattern; users should be able to edit key fields directly in list/card context.

---

## In-Scope

| Task | Backlog # | Title | Priority | Status | Est Tokens | Actual Tokens |
|------|-----------|-------|----------|--------|------------|---------------|
| TASK-2227 | 1032 | Backlog Table: Inline editing for Status, Priority, Type, Assignee, Area | Medium | In Progress | ~30K | - |
| TASK-2228 | 1033 | PM Module: Inline edit for project name/description, task title, sprint name/description | Medium | Pending | ~35K | - |
| TASK-2229 | 1029 | Board: Allow creating custom labels inline from kanban card label picker | Medium | Pending | ~25K | - |
| TASK-2230 | 1028 | Board: Make kanban columns wider/flexible to reduce title wrapping | Medium | Pending | ~15K | - |
| TASK-2231 | 1031 | Sprint Detail: Add delete sprint button | Low | Pending | ~20K | - |
| TASK-2232 | 1027 | Board: Add search filter to assignee dropdown on kanban cards | Low | Pending | ~20K | - |

---

## Dependency Analysis

| Task | Depends On | Shared Files | Parallel Safe? |
|------|-----------|--------------|----------------|
| TASK-2227 | None | `TaskTable.tsx`, `pm-queries.ts` | Yes (isolated) |
| TASK-2228 | None | Detail pages (project, sprint, task) | Yes (different files) |
| TASK-2229 | None | `KanbanCard.tsx`, `pm-queries.ts` (createLabel) | Yes (isolated) |
| TASK-2230 | None | Board layout CSS/components | Yes (isolated) |
| TASK-2231 | None | Sprint detail page | Seq after TASK-2228 (shares sprint detail page) |
| TASK-2232 | None | `KanbanCard.tsx` (AssigneeDropdown) | Seq after TASK-2229 (shares KanbanCard.tsx) |

**Execution Plan:**
- **Batch 1 (parallel-safe):** TASK-2227, TASK-2228, TASK-2229, TASK-2230
- **Batch 2 (sequential after batch 1):** TASK-2231 (after TASK-2228), TASK-2232 (after TASK-2229)

**Execution order per user request:** Start with TASK-2227 first, then proceed in priority order.

---

## Testing & Quality Plan

- All inline editing changes must preserve existing keyboard navigation
- Dropdown components must close on outside click and Escape key
- Status changes must respect `ALLOWED_TRANSITIONS` from `pm-types.ts`
- All mutations must call the appropriate RPC (`updateItemField`, `updateItemStatus`, `assignItem`)
- Optimistic UI updates preferred, with rollback on error
- Type check (`npm run type-check`) must pass
- No new test files required (UI polish, no business logic changes), but existing tests must not break

---

## Sprint Retrospective

*(To be filled after sprint completion)*

### Estimation Accuracy

| Task | Est Tokens | Actual Tokens | Variance |
|------|------------|---------------|----------|
| TASK-2227 | ~30K | - | - |
| TASK-2228 | ~35K | - | - |
| TASK-2229 | ~25K | - | - |
| TASK-2230 | ~15K | - | - |
| TASK-2231 | ~20K | - | - |
| TASK-2232 | ~20K | - | - |

### Issues Summary

*(Aggregated from task handoffs)*

### What Went Well / Didn't / Lessons Learned

*(Post-sprint)*
