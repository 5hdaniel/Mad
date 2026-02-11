# SPRINT-077: Desktop UI Cleanup

**Status:** In Progress
**Created:** 2026-02-10
**Goal:** Clean up stale UI stubs, improve toolbar responsiveness, and fix a system health check error.

---

## Sprint Scope

### In-Scope
- Remove auto export and dark mode TODO stubs from Settings
- Redesign toolbar layout for responsive narrow/wide viewports
- Fix system health check provider validation error

### Out-of-Scope
- Implementing auto export functionality
- Implementing dark mode
- Adding new features to the toolbar
- Modifying TransactionToolbar header (back button / title area)

---

## Tasks

| Task | Title | Priority | Category | Est Tokens | Status | Branch |
|------|-------|----------|----------|------------|--------|--------|
| TASK-1944 + TASK-1945 | Remove Settings stubs (auto export + dark mode) | P2 | cleanup | ~5K | Pending | `fix/task-1944-remove-settings-stubs` |
| TASK-1946 | Responsive toolbar layout redesign | P1 | ui | ~25K | Pending | `feature/task-1946-responsive-toolbar` |
| TASK-1947 | Fix system health check provider error | P0 | bug | ~10K | Pending | `fix/task-1947-health-check-provider` |

---

## Execution Plan

### Phase 1 (Parallel - 3 worktrees)

All three task groups are independent with no shared files:

| Task(s) | Files Modified | Worktree |
|---------|---------------|----------|
| TASK-1944 + TASK-1945 | `Settings.tsx`, `Settings.test.tsx` | `../Mad-TASK-1944` |
| TASK-1946 | `TransactionsToolbar.tsx`, `TransactionToolbar.tsx` | `../Mad-TASK-1946` |
| TASK-1947 | `system-handlers.ts` or `SystemHealthMonitor.tsx` | `../Mad-TASK-1947` |

**Parallel justification:** Zero shared file overlap. Settings stubs are in `Settings.tsx`, toolbar redesign is in two toolbar-specific files, and the health check fix is in electron handlers. Safe for parallel execution.

### Dependency Graph

```
TASK-1944+1945 ─┐
TASK-1946 ──────┼──► All merge independently to develop
TASK-1947 ──────┘
```

No inter-task dependencies. All tasks branch from and merge to `develop`.

---

## Testing & Quality Plan

| Task | Testing Requirement |
|------|-------------------|
| TASK-1944+1945 | Remove obsolete test assertions from `Settings.test.tsx`. Verify remaining tests pass. |
| TASK-1946 | Visual verification (no unit tests for pure layout). Existing tests must still pass. |
| TASK-1947 | Add/update test for health check handler with empty string provider. |

### CI Requirements
- All PRs must pass: `npm run type-check`, `npm run lint`, `npm test`
- Traditional merge (not squash)

---

## Progress Tracking

| Task | Engineer Agent ID | SR Agent ID | PR # | Merged | Actual Tokens |
|------|------------------|-------------|------|--------|---------------|
| TASK-1944+1945 | - | - | - | No | - |
| TASK-1946 | - | - | - | No | - |
| TASK-1947 | - | - | - | No | - |

---

## Sprint Metrics

| Metric | Value |
|--------|-------|
| Total Estimated Tokens | ~40K |
| Total Actual Tokens | TBD |
| Variance | TBD |
