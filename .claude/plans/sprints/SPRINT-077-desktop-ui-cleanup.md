# SPRINT-077: Desktop UI Cleanup

**Status:** Completed
**Created:** 2026-02-10
**Completed:** 2026-02-10
**Goal:** Clean up stale UI stubs, improve toolbar responsiveness, and fix a system health check error.

---

## Completion Summary

All planned tasks completed and merged. Additional polish work done in PR #796 (toolbar height consistency, settings cleanup, version popup removal, auto-download updates toggle).

### PRs Merged
- **PR #792:** TASK-1944+1945 -- Remove auto export and dark mode stubs from Settings
- **PR #793:** TASK-1947 -- Fix health check provider validation (azure normalization)
- **PR #794:** TASK-1946 -- Responsive toolbar layout for transactions pages
- **PR #795:** TASK-1948 -- Add auto-download updates toggle to Settings
- **PR #796:** Polish pass -- toolbar heights, settings cleanup, version popup removal (IN REVIEW)

---

## Sprint Scope

### In-Scope
- Remove auto export and dark mode TODO stubs from Settings
- Redesign toolbar layout for responsive narrow/wide viewports
- Fix system health check provider validation error

### Additional Work (Unplanned)
- TASK-1948: Auto-download updates toggle in Settings (PR #795)
- Toolbar button height consistency (h-10 matching filter selector) (PR #796)
- Remove stale version number and "Check for Updates" from About section (PR #796)
- Remove VersionPopup component from AppShell (PR #796)
- Add copyright notice to About section (PR #796)
- Move "Check for Updates" button to auto-download settings section (PR #796)

### Out-of-Scope
- Implementing auto export functionality
- Implementing dark mode
- Adding new features to the toolbar
- Modifying TransactionToolbar header (back button / title area)

---

## Tasks

| Task | Title | Priority | Category | Est Tokens | Status | Branch |
|------|-------|----------|----------|------------|--------|--------|
| TASK-1944 + TASK-1945 | Remove Settings stubs (auto export + dark mode) | P2 | cleanup | ~5K | Completed | `fix/task-1944-remove-settings-stubs` |
| TASK-1946 | Responsive toolbar layout redesign | P1 | ui | ~25K | Completed | `feature/task-1946-responsive-toolbar` |
| TASK-1947 | Fix system health check provider error | P0 | bug | ~10K | Completed | `fix/task-1947-health-check-provider` |
| TASK-1948 | Auto-download updates toggle | P2 | feature | ~10K | Completed | (PR #795) |

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

### Phase 2 (Sequential - post-merge polish)

| Task | Files Modified | PR |
|------|---------------|----|
| TASK-1948 | `Settings.tsx`, `preference-handlers.ts` | PR #795 |
| Polish pass | Toolbars, Settings, AppShell | PR #796 |

### Dependency Graph

```
TASK-1944+1945 ─┐
TASK-1946 ──────┼──► All merge independently to develop ──► TASK-1948 + Polish (PR #795, #796)
TASK-1947 ──────┘
```

---

## Testing & Quality Plan

| Task | Testing Requirement |
|------|-------------------|
| TASK-1944+1945 | Remove obsolete test assertions from `Settings.test.tsx`. Verify remaining tests pass. |
| TASK-1946 | Visual verification (no unit tests for pure layout). Existing tests must still pass. |
| TASK-1947 | Add/update test for health check handler with empty string provider. |
| TASK-1948 | Verify auto-download toggle persists preference via Supabase. |

### CI Requirements
- All PRs must pass: `npm run type-check`, `npm run lint`, `npm test`
- Traditional merge (not squash)

---

## Progress Tracking

| Task | Engineer Agent ID | SR Agent ID | PR # | Merged | Actual Tokens |
|------|------------------|-------------|------|--------|---------------|
| TASK-1944+1945 | (auto-captured) | (auto-captured) | #792 | Yes | (auto-captured) |
| TASK-1946 | (auto-captured) | (auto-captured) | #794 | Yes | (auto-captured) |
| TASK-1947 | (auto-captured) | (auto-captured) | #793 | Yes | (auto-captured) |
| TASK-1948 | (auto-captured) | (auto-captured) | #795 | Yes | (auto-captured) |
| Polish pass | - | - | #796 | In Review | - |

---

## Sprint Metrics

| Metric | Value |
|--------|-------|
| Total Estimated Tokens | ~40K (planned) + ~10K (unplanned) = ~50K |
| Total Actual Tokens | (auto-captured from metrics hooks) |
| Variance | TBD |
| PRs Merged | 4 (+ 1 in review) |
| Tasks Completed | 4 planned + 1 unplanned |
