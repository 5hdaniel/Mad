# SPRINT-115: Admin Portal Polish

**Created:** 2026-03-06
**Status:** Completed
**Goal:** Harden admin portal with shared components, singleton client, permission checks, and pending invitation visibility

---

## Sprint Narrative

SPRINT-113 built the RBAC system. SR Engineer review surfaced multiple code quality issues. This sprint addresses the highest-impact items: shared ConfirmationDialog, client memoization, page-level permission checks, and a missing feature (pending invitations not visible in Internal Users table).

---

## In-Scope

| Task | Backlog | Title | Status | PR |
|------|---------|-------|--------|-----|
| — | BACKLOG-877 | Shared ConfirmationDialog component | Completed | #1072 |
| — | BACKLOG-878 | Consistent createClient() memoization | Completed | #1071 |
| — | BACKLOG-882 | Page-level permission checks (defense-in-depth) | Completed | #1074 |
| — | BACKLOG-890 | Show pending invitations in Internal Users table | Completed | #1075 |
| — | — | Fix RLS policy: use auth.jwt() instead of auth.users subquery | Completed | #1076 |

## Out of Scope / Deferred

- Audit log search debounce (BACKLOG-879)
- Modal accessibility improvements (BACKLOG-881)
- Format date deduplication (BACKLOG-876)

---

## Merge Plan

- Integration branch: `int/sprint-115-admin-polish`
- All PRs merged to integration branch, then integration merged to develop via PR #1076
- All CI checks passed

---

## QA Results (2026-03-07)

| # | Test Case | Result |
|---|-----------|--------|
| 1 | Confirmation dialog renders and works | PASS |
| 2 | Pending invitations visible + cancel works | PASS |
| 3 | Permission page checks redirect unauthorized users | PASS |
| 4 | Permission cache refreshes on role change | PASS |

### Bug Found During QA

- `pending_internal_invitations` RLS policies used `(SELECT email FROM auth.users ...)` but `authenticated` role lacks SELECT on `auth.users`. Fixed by switching to `auth.jwt() ->> 'email'`. Applied to production DB and migration file.
