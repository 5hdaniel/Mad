# SPRINT-128: Admin Portal Polish + Quick Wins

**Created:** 2026-03-12
**Completed:** 2026-03-12
**Status:** Completed
**Goal:** Ship accumulated quick wins (notification prompt, login retry, settings scroll), fix Individual plan assignment defect, and polish admin portal navigation with cross-links.

---

## Sprint Narrative

This sprint collects five independent improvements that have been accumulating in the backlog. Three are quick wins that can ship in parallel with minimal risk (Batch 1), and two are admin portal enhancements that touch different pages and can also run in parallel (Batch 2).

The highest-priority item is BACKLOG-936: preventing assignment of Individual-tier plans to organizations. This is a data integrity defect introduced by the new tier system in SPRINT-127 -- the `admin_assign_org_plan` RPC has no tier validation, and the admin UI dropdown shows all plans without filtering. Both layers need a guard.

The remaining items are quality-of-life improvements: removing the redundant macOS notification permission prompt (BACKLOG-834), reducing aggressive login retries (BACKLOG-920), adding scroll-to-highlight for the "Adjust Limits" button (BACKLOG-835), and adding cross-links between admin portal detail pages (BACKLOG-934).

---

## Prerequisites

- **SPRINT-127** (License/Plan/Tier Unification Phase 1-2): COMPLETED -- tier constraints schema, `tier_rank()` function, and admin plan management RPCs are in place.
- **SPRINT-126** (Feature Gate Rework): COMPLETED -- admin portal plan management UI exists.

---

## In-Scope

| Task | Backlog | Title | Batch | Category | Est. Tokens | Status |
|------|---------|-------|-------|----------|-------------|--------|
| TASK-2162 | BACKLOG-834 | Defer macOS notification permission prompt | 1 | electron | ~3K | Completed (PR #1135) |
| TASK-2163 | BACKLOG-920 | Reduce login retry from 3 to 1 | 1 | ui | ~1K | Completed (PR #1136) |
| TASK-2164 | BACKLOG-835 | Adjust Limits button scroll-to-highlight | 1 | ui | ~20K | Completed (PR #1137) |
| TASK-2165 | BACKLOG-936 | Prevent Individual plan assignment to orgs | 2 | schema + admin-portal | ~20K | Completed (PR #1138) |
| TASK-2166 | BACKLOG-934 | Admin Portal UX cross-links and navigation | 2 | admin-portal | ~20K | Completed (PR #1139) |

**Total Engineer Estimate: ~64K tokens**

---

## Out of Scope / Deferred

- Phase 3-4 schema cleanup from SPRINT-127 preview (drop `organizations.plan`, deprecate `subscription_tier`, etc.)
- Broker Portal Settings / org-level feature overrides (BACKLOG-935)
- Admin Portal Delete Plan with Org Protection (BACKLOG-933) -- deferred pending this sprint
- Breadcrumb component for admin portal (lower priority part of BACKLOG-934, can be a follow-up)
- Plan list page org count column (lower priority part of BACKLOG-934)

---

## Execution Plan

### Batch 1: Quick Wins (Parallel -- 3 worktrees)

| Task | Files Modified | Overlap? |
|------|---------------|----------|
| TASK-2162 | `electron/main.ts`, `electron/handlers/updaterHandlers.ts` | No -- electron-only files |
| TASK-2163 | `src/components/Login.tsx` | No -- renderer component only |
| TASK-2164 | `src/components/dashboard/SyncStatusIndicator.tsx`, `src/appCore/AppRouter.tsx`, Settings-related files | No -- different renderer files |

**Verdict:** Safe for parallel execution. No shared files.

### Batch 2: Admin Portal (Parallel -- 2 worktrees)

| Task | Files Modified | Overlap? |
|------|---------------|----------|
| TASK-2165 | `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx`, `admin-portal/lib/admin-queries.ts`, new Supabase migration | Shares `admin-queries.ts` with TASK-2166 (see note) |
| TASK-2166 | `admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx`, `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx`, `admin-portal/app/dashboard/plans/[id]/page.tsx` | No overlap with TASK-2165 page files |

**Shared file note:** Both tasks could touch `admin-portal/lib/admin-queries.ts` -- TASK-2165 may add a tier-filtered query variant, and TASK-2166 may add an orgs-by-plan query. However, these are additive (new exported functions), not modifying existing code. Merge conflicts are unlikely but SR Engineer should verify during review.

**Verdict:** Safe for parallel execution with SR review of `admin-queries.ts` merge.

---

## Dependency Graph

```
(no cross-batch dependencies)

Batch 1 (parallel, all branch from develop):
  TASK-2162 (electron notification) ─┐
  TASK-2163 (login retry)           ─┤─→ SR Review → Merge all 3
  TASK-2164 (scroll-to-highlight)   ─┘

Batch 2 (parallel, branch from develop after Batch 1 merge):
  TASK-2165 (individual plan guard) ─┐─→ SR Review → Merge both
  TASK-2166 (admin crosslinks)      ─┘
```

### Execution Order

| Batch | Tasks | Execution | Rationale |
|-------|-------|-----------|-----------|
| 1 | TASK-2162, TASK-2163, TASK-2164 | **Parallel** (3 worktrees) | Completely independent files -- electron, Login.tsx, SyncStatusIndicator/AppRouter |
| 2 | TASK-2165, TASK-2166 | **Parallel** (2 worktrees) | Different admin portal pages; minor additive overlap in `admin-queries.ts` |

---

## Merge Plan

- All PRs target `develop`
- No integration branch needed (tasks are independent or parallel-safe)
- Each task uses its own branch:
  - `fix/BACKLOG-834-defer-notification-prompt`
  - `fix/BACKLOG-920-reduce-login-retry`
  - `feature/BACKLOG-835-adjust-limits-scroll`
  - `fix/BACKLOG-936-prevent-individual-plan-on-orgs`
  - `feature/BACKLOG-934-admin-crosslinks`
- Batch 1 merges first, then Batch 2 branches from updated develop
- SR Engineer reviews all tasks in each batch before merge

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `checkForUpdates()` changes auto-update behavior on other platforms | Medium | Low | The method still triggers update download; only difference is no OS notification. App already has in-app `UpdateNotification` component. Test on macOS to confirm no regression. |
| Login retry reduction causes failed logins to not retry at all | Low | Low | Changing from 3 to 1, not 0. User still gets one automatic retry plus manual "Try Again" button. |
| Scroll-to-highlight flickers or misses target element | Low | Medium | Pattern already proven in `handleContinueSetup` (AppRouter.tsx:136-148). Follow same approach with `setTimeout` + `scrollIntoView`. |
| Individual plan filter breaks if tier column is null | Medium | Low | `getActivePlans()` already returns full plan objects with tier. Filter `plan.tier !== 'individual'` is safe. RPC validation uses `tier_rank()` which handles all valid tiers. |
| Admin crosslinks show broken links for deleted orgs/plans | Low | Low | Links go to existing detail pages which already handle `notFound()`. No new failure mode. |
| `admin-queries.ts` merge conflict between TASK-2165 and TASK-2166 | Low | Medium | Both add new functions (additive). SR Engineer merges in order and resolves if needed. |

---

## Testing Plan

| Surface | Requirement | Owner |
|---------|-------------|-------|
| macOS notification prompt | App does NOT trigger OS notification permission on first launch | TASK-2162 |
| Auto-update still works | Updates download and in-app notification appears | TASK-2162 |
| Login retry count | Browser opens max 2 times (initial + 1 retry), not 4 | TASK-2163 |
| Manual retry | "Try Again" button still works after max retries exhausted | TASK-2163 |
| Adjust Limits scroll | Clicking "Adjust Limits" opens Settings AND scrolls to correct card | TASK-2164 |
| Highlight animation | Target card gets visual highlight that auto-removes | TASK-2164 |
| Individual plan filtered | Individual plan does not appear in org plan assignment dropdown | TASK-2165 |
| RPC tier validation | `admin_assign_org_plan` rejects Individual plan for orgs | TASK-2165 |
| Valid plan assignment | Team, Enterprise, Custom plans still assign successfully | TASK-2165 |
| User -> Org link | Org name in user detail is a clickable link to org page | TASK-2166 |
| User -> Plan link | Plan info visible with link from user detail page | TASK-2166 |
| Plan -> Orgs section | Plan detail page shows list of orgs using that plan | TASK-2166 |
| Admin portal builds | `npm run build` succeeds for admin-portal | TASK-2165, TASK-2166 |
| CI gates | Type-check, lint, test suite pass | All tasks |

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| Batch 1 Engineer work (TASK-2162 + TASK-2163 + TASK-2164) | ~24K |
| Batch 2 Engineer work (TASK-2165 + TASK-2166) | ~40K |
| SR Review (5 reviews x ~10K avg) | ~50K |
| PM overhead | ~5K |
| **Total Sprint** | **~119K** |

### Estimation Basis

- TASK-2162: One-line fix in two files, electron category. Minimal.
- TASK-2163: One constant change, ui category. Minimal.
- TASK-2164: UI scroll pattern exists in codebase; replicate with modifications. Increased to ~20K after SR review identified full `onOpenSettings` prop chain spanning 9 files. ui x 1.0 multiplier.
- TASK-2165: Schema migration + UI filter + RPC update. schema x 1.3 applied to base ~15K.
- TASK-2166: UI-only changes across 3 admin portal components + 1 new query. ui x 1.0 multiplier.

---

## Task Files

- `.claude/plans/tasks/archive/TASK-2162-defer-notification-prompt.md`
- `.claude/plans/tasks/archive/TASK-2163-reduce-login-retry.md`
- `.claude/plans/tasks/archive/TASK-2164-adjust-limits-scroll.md`
- `.claude/plans/tasks/archive/TASK-2165-prevent-individual-plan-on-orgs.md`
- `.claude/plans/tasks/archive/TASK-2166-admin-crosslinks.md`

---

## Sprint Results

**Sprint Completed:** 2026-03-12

### Merged PRs

| Task | PR | Title | Status |
|------|----|-------|--------|
| TASK-2162 | #1135 | fix(electron): defer macOS notification prompt | Merged |
| TASK-2163 | #1136 | fix(ui): reduce login retry from 3 to 1 | Merged |
| TASK-2164 | #1137 | feature(ui): scroll to and highlight limits card | Merged |
| TASK-2165 | #1138 | fix(schema+admin): prevent Individual plan on orgs | Merged |
| TASK-2166 | #1139 | feature(admin): admin cross-links + RLS fix | Merged |
| Cleanup | #1140 | chore: type consistency + dead code removal | Merged |

### Summary

All 5 tasks completed and merged successfully across 2 batches of parallel execution. Cleanup PR #1140 addressed type consistency and dead code removal identified during SR review. QA passed all tasks.
