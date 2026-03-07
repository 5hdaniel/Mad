# SPRINT-115: Admin Portal Polish & Hardening

**Status:** Ready
**Created:** 2026-03-06
**Integration Branch:** `int/sprint-115-admin-polish`
**Merge Target:** `develop`

---

## Sprint Goal

Clean up deferred tech debt from SPRINT-113 SR code review findings -- shared components, createClient() memoization, and defense-in-depth page-level permission checks. Small, focused sprint to harden the admin portal before building impersonation on top of it.

## Dependencies

- **SPRINT-113** (Admin RBAC) -- MERGED (PR #1062). Establishes the permission system and components this sprint refactors.
- Can run in **PARALLEL with SPRINT-114** (iPhone Sync Hardening) -- entirely different codebase (admin-portal vs Electron).

## Context

During SPRINT-113 SR Engineer code review, several tech debt items were identified and logged as BACKLOG-877, 878, and 882. These were deferred from SPRINT-113 to avoid scope creep but should be addressed before building impersonation (SPRINT-116) on top of the admin portal.

---

## In-Scope

| Backlog | Title | Priority | Type | Est. Tokens |
|---------|-------|----------|------|-------------|
| BACKLOG-877 | Create shared ConfirmationDialog component | Medium | refactor | ~8K |
| BACKLOG-878 | Add consistent createClient() memoization | Medium | refactor | ~5K |
| BACKLOG-882 | Add page-level permission checks as defense-in-depth | High | feature | ~8K |

**Total Estimated:** ~21K tokens

## Out of Scope / Deferred

- Impersonation UI (SPRINT-116)
- Audit log SOC 2 enhancements (SPRINT-117)
- Additional SR findings already addressed in SPRINT-113 Phase 3

---

## Execution Plan

### Phase 1: All Tasks (Parallel)

All three tasks touch different files with no shared dependencies:

- **BACKLOG-877** -- `components/shared/ConfirmationDialog.tsx` (new), updates to `RemoveUserDialog.tsx` and `DeleteRoleDialog.tsx`
- **BACKLOG-878** -- Various page/component files that call `createClient()` inline
- **BACKLOG-882** -- Page-level server components (`/dashboard/users/page.tsx`, `/dashboard/audit-log/page.tsx`, etc.)

**Safe for parallel execution:** Different files, no shared code paths.

---

## Merge Plan

- Base branch: `develop`
- Integration branch: `int/sprint-115-admin-polish`
- Separate branch per task with individual PRs to integration branch
- All three tasks can merge independently (no ordering required)
- Integration branch merges to `develop` after all tasks complete

---

## Testing Plan

| Backlog | Test Type | Details |
|---------|-----------|---------|
| BACKLOG-877 | Manual | ConfirmationDialog renders correctly in remove user and delete role flows; existing behavior preserved |
| BACKLOG-878 | Manual + Build | `npm run build` passes; no regression in pages using Supabase client |
| BACKLOG-882 | Manual | Access protected pages without middleware (direct URL); verify server-side permission check redirects unauthorized users |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| ConfirmationDialog refactor breaks existing modal behavior | Medium | Keep existing dialog API surface; refactor is cosmetic/structural only |
| createClient() memoization causes stale auth state | Low | Use standard Next.js Supabase pattern (createClient per request in server components, memoized in client) |
| Page-level permission checks create double-redirect | Low | Check should be a fallback only; middleware handles primary gating |

---

## Acceptance Criteria

- [ ] Shared ConfirmationDialog component used by RemoveUserDialog and DeleteRoleDialog
- [ ] No inline `createClient()` calls inside callbacks -- all memoized or properly scoped
- [ ] All protected pages have server-side permission checks as defense-in-depth
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Existing admin portal functionality preserved (no regressions)
