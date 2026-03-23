# SPRINT-O: Quick Wins (2026-03-23)

**Project:** Identity & Provisioning
**Integration Branch:** `int/identity-provisioning`
**Sprint ID:** `ebb9180f-26b8-42e0-b208-b41c7e3df25f`
**Date:** 2026-03-23
**Status:** Active

---

## Sprint Goal

Merge the pending feature gate fix, resolve desktop UI gaps (support widget visibility), improve admin portal support ticket UX (backlog links, reply textarea, internal comment editing).

---

## Tasks

| # | Task | Backlog | Area | Est. Tokens | Execution |
|---|------|---------|------|-------------|-----------|
| 1 | TASK-2311: Merge feature gate fix PR #1400 | BACKLOG-1339 | desktop | ~1K | Manual (merge only) |
| 2 | TASK-2312: Support widget visible on all screens | BACKLOG-1341 | desktop (src/) | ~15K | Sequential |
| 3 | TASK-2313: Backlog links panel on ticket detail | BACKLOG-1343 | admin-portal | ~15K | Parallel with 2 |
| 4 | TASK-2314: Reply textarea bigger + resizable | BACKLOG-1166 | admin-portal | ~2K | Parallel with 3 |
| 5 | TASK-2315: Edit/delete internal comments | BACKLOG-1344 | admin-portal | ~25K | Sequential (after 4, shared file) |

**Total Estimated Tokens:** ~58K (excluding TASK-2311 merge-only)

---

## Dependency Graph

```
TASK-2311 (merge PR #1400)          -- independent, do first
    |
    v
TASK-2312 (support widget)          -- desktop app, independent of admin-portal tasks
TASK-2313 (backlog links panel)     -- admin-portal, parallel-safe with 2312, 2314
TASK-2314 (reply textarea CSS)      -- admin-portal, parallel-safe with 2313
    |
    v
TASK-2315 (edit/delete comments)    -- admin-portal, touches ActivityTimeline.tsx
                                       (same file area as 2314's ReplyComposer)
                                       Run after 2314 to avoid conflicts
```

### Execution Order

**Phase 0 (Manual):** TASK-2311 -- User tests PR #1400, then merge
**Phase 1 (Parallel batch):** TASK-2312, TASK-2313, TASK-2314
**Phase 2 (Sequential):** TASK-2315 (after Phase 1 merges)

---

## Branch Strategy

All branches from `int/identity-provisioning`, all PRs target `int/identity-provisioning`.

| Task | Branch Name |
|------|-------------|
| TASK-2311 | `fix/feature-gate-no-org-failopen` (existing PR #1400) |
| TASK-2312 | `fix/task-2312-support-widget-all-screens` |
| TASK-2313 | `feature/task-2313-backlog-links-panel` |
| TASK-2314 | `fix/task-2314-reply-textarea-resize` |
| TASK-2315 | `feature/task-2315-edit-delete-internal-comments` |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| TASK-2315 requires schema migration (edited_at, edited_by columns) | Keep migration small and additive; no breaking changes |
| TASK-2312 touches AppShell which is a high-traffic file | Check line budget (target 150, trigger >200) |
| TASK-2313 needs RPC to fetch backlog links with item details | May need new Supabase RPC or direct join query |

---

## Completion Tracking

| Task | Status | PR | Merged |
|------|--------|----|--------|
| TASK-2311 | Pending (user test) | #1400 | |
| TASK-2312 | Pending | | |
| TASK-2313 | Pending | | |
| TASK-2314 | Pending | | |
| TASK-2315 | Pending | | |
