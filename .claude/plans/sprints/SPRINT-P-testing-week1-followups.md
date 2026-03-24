# SPRINT-P: Testing Week 1 Follow-ups

**Project:** Identity & Provisioning
**Integration Branch:** `int/identity-provisioning`
**Sprint ID:** `50cf7254-68ec-4ee3-9228-226707dfcec9`
**Date:** 2026-03-23
**Status:** Active

---

## Sprint Goal

Address follow-up items from SPRINT-O and user testing: investigate auto-sync attachment linking failure and account verification race condition, fix SSO post-login card layout, wire up Contact Support button, expand support widget to all screens, add internal comment editing, and clean up feature gate logging per SR Engineer recommendations.

---

## Investigation-First Pattern

BACKLOG-1340 and BACKLOG-1347 use the investigation-first pattern. Investigation tasks (Phase 1) are read-only -- no file modifications. Implementation tasks in Phase 2 are conditional on investigation findings.

---

## Tasks

| # | Task | Backlog | Area | Priority | Category | Est. Tokens | Phase |
|---|------|---------|------|----------|----------|-------------|-------|
| 1 | TASK-2316: Investigate auto-sync attachment linking | BACKLOG-1340 | desktop (electron/) | HIGH | investigation | ~15K | 1 (Investigation) |
| 2 | TASK-2317: Investigate account verification race condition | BACKLOG-1347 | desktop (electron/) | HIGH | investigation | ~15K | 1 (Investigation) |
| 3 | TASK-2318: Fix SSO post-login card layout on small screens | BACKLOG-1349 | desktop (src/) | MEDIUM | ui | ~8K | 2 (Parallel) |
| 4 | TASK-2319: Wire Contact Support button to support widget | BACKLOG-1350 | desktop (src/) | MEDIUM | ui | ~10K | 2 (Parallel) |
| 5 | TASK-2312: Support widget visible on all screens | BACKLOG-1341 | desktop (src/) | MEDIUM | ui | ~15K | 2 (Parallel) |
| 6 | TASK-2315: Edit/delete internal comments | BACKLOG-1344 | admin-portal | MEDIUM | service | ~25K | 2 (Sequential) |
| 7 | TASK-2320: Feature gate logging cleanup | BACKLOG-1351 | desktop (electron/) | LOW | cleanup | ~5K | 3 (Parallel) |
| 8 | TASK-2321: Extract team features deny list constant | BACKLOG-1352 | desktop (electron/) | LOW | cleanup | ~3K | 3 (Parallel) |
| -- | TASK-2322: Fix auto-sync attachment linking | BACKLOG-1340 | desktop (electron/) | HIGH | service | ~25K | 2 (Conditional) |
| -- | TASK-2323: Fix account verification race condition | BACKLOG-1347 | desktop (electron/) | HIGH | service | ~20K | 2 (Conditional) |

**Total Estimated Tokens (implementation):** ~141K (including conditional tasks)
**Total Estimated Tokens (if no bugs found):** ~81K (excluding conditional tasks)
**SR Review Overhead:** ~40K (8-10 tasks)
**Grand Total:** ~121K-181K

---

## Dependency Graph

```
Phase 1: Investigation (Parallel, read-only)
  TASK-2316 (investigate auto-sync attachments)  ──┐
  TASK-2317 (investigate account verification)   ──┤
                                                    │
  >>> PM CHECKPOINT: Review findings, decide <<<    │
                                                    v
Phase 2: Implementation (Mixed)
  TASK-2322 (fix auto-sync)        -- CONDITIONAL on TASK-2316 findings
  TASK-2323 (fix account verify)   -- CONDITIONAL on TASK-2317 findings
  TASK-2318 (SSO card layout)      -- parallel-safe, isolated file
  TASK-2319 (Contact Support btn)  -- parallel-safe, touches ErrorScreen.tsx
  TASK-2312 (support widget)       -- parallel-safe, touches AppShell.tsx
  TASK-2315 (edit/delete comments) -- sequential (schema migration + admin-portal)

Phase 3: Cleanup (Parallel)
  TASK-2320 (logging cleanup)      -- featureGateHandlers.ts + featureGateService.ts
  TASK-2321 (deny list constant)   -- featureGateHandlers.ts only
  NOTE: 2320 and 2321 both touch featureGateHandlers.ts.
        Run 2321 AFTER 2320, or combine into single task.
```

### Execution Order

**Phase 1 (Parallel -- read-only investigation):** TASK-2316, TASK-2317
**PM Checkpoint:** Review investigation results, decide PROCEED/SKIP on conditional tasks
**Phase 2 (Mixed):**
  - Parallel batch A: TASK-2318, TASK-2319, TASK-2312
  - Sequential: TASK-2315 (can run parallel with batch A since it is admin-portal)
  - Conditional: TASK-2322 (if TASK-2316 confirms bug), TASK-2323 (if TASK-2317 confirms bug)
**Phase 3 (Sequential pair):** TASK-2320 then TASK-2321 (shared file)

---

## Branch Strategy

All branches from `int/identity-provisioning`, all PRs target `int/identity-provisioning`.

| Task | Branch Name | Notes |
|------|-------------|-------|
| TASK-2316 | `claude/task-2316-investigate-autosync` | Investigation only, no file changes |
| TASK-2317 | `claude/task-2317-investigate-verification` | Investigation only, no file changes |
| TASK-2318 | `fix/task-2318-sso-card-layout` | |
| TASK-2319 | `fix/task-2319-contact-support-button` | |
| TASK-2312 | `fix/task-2312-support-widget-all-screens` | (existing, from SPRINT-O) |
| TASK-2315 | `feature/task-2315-edit-delete-internal-comments` | (existing, from SPRINT-O) |
| TASK-2320 | `fix/task-2320-feature-gate-logging` | |
| TASK-2321 | `fix/task-2321-feature-gate-denylist-constant` | |
| TASK-2322 | `fix/task-2322-autosync-attachment-fix` | Conditional |
| TASK-2323 | `fix/task-2323-verification-race-condition` | Conditional |

---

## Moved from SPRINT-O

| Item | Reason |
|------|--------|
| BACKLOG-1341 / TASK-2312 | Not started in SPRINT-O |
| BACKLOG-1344 / TASK-2315 | Not started in SPRINT-O |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| TASK-2320 and TASK-2321 share `featureGateHandlers.ts` | Merge conflicts | Run sequentially (2320 first, then 2321) |
| TASK-2322 scope unknown until investigation | Could be large | Investigation-first; PM checkpoint before committing |
| TASK-2323 DB init ordering is core infrastructure | High risk if changes cascade | Limit scope to Sentry logging improvements first; ordering fix only if clearly safe |
| TASK-2315 requires schema migration | Migration conflicts | Run after Phase 2 parallel batch merges |

---

## Testing & Quality Plan

### Per-Task Testing

| Task | Unit Tests | Manual Testing | CI |
|------|-----------|----------------|-----|
| TASK-2316 | N/A (investigation) | N/A | N/A |
| TASK-2317 | N/A (investigation) | N/A | N/A |
| TASK-2318 | No (CSS-only) | Resize window to verify card padding | type-check, lint |
| TASK-2319 | Update ErrorScreen test | Click Contact Support in error state | type-check, lint, test |
| TASK-2312 | Update SupportWidget tests if needed | Navigate all screens, verify ? icon | type-check, lint, test |
| TASK-2315 | No (RPC + UI) | Full CRUD on internal comments | type-check, admin-portal build |
| TASK-2320 | No (log level only) | Verify logs in console | type-check, lint |
| TASK-2321 | No (constant extraction) | Verify feature gate still works | type-check, lint, test |
| TASK-2322 | TBD (based on investigation) | Manual: email sync with attachments | type-check, lint, test |
| TASK-2323 | TBD (based on investigation) | Full onboarding flow (SSO) | type-check, lint, test |

### Quality Gates

- [ ] All PRs pass CI (type-check, lint, test, build)
- [ ] No regressions in existing onboarding flow
- [ ] Feature gates still function correctly after cleanup
- [ ] Support widget accessible on all screens post-merge

---

## Completion Tracking

| Task | Status | PR | Merged | Actual Tokens |
|------|--------|----|--------|---------------|
| TASK-2316 | Pending | | | |
| TASK-2317 | Pending | | | |
| TASK-2318 | Pending | | | |
| TASK-2319 | Pending | | | |
| TASK-2312 | Pending | | | |
| TASK-2315 | Pending | | | |
| TASK-2320 | Pending | | | |
| TASK-2321 | Pending | | | |
| TASK-2322 | Pending (conditional) | | | |
| TASK-2323 | Pending (conditional) | | | |

---

## Sprint Retrospective

### Estimation Accuracy
| Task | Est Tokens | Actual Tokens | Variance | Notes |
|------|-----------|---------------|----------|-------|

### Issues Encountered
| # | Task | Issue | Severity | Resolution | Time Impact |
|---|------|-------|----------|------------|-------------|

### What Went Well
-

### What Didn't Go Well
-

### Lessons for Future Sprints
-
