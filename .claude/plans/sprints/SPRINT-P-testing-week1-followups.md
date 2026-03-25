# SPRINT-P: Testing Week 1 Follow-ups (2026-03-24)

**Sprint ID (Supabase):** `50cf7254-68ec-4ee3-9228-226707dfcec9`
**Date:** 2026-03-24
**Status:** Active
**Base Branch:** `develop` (int/identity-provisioning merged)

---

## Sprint Goal

Address follow-up items from SPRINT-O user testing. Mark already-completed items, fix UI bugs (SSO card padding, Contact Support button), clean up feature gate code (logging levels, constant extraction), implement edit/delete for internal comments, and add auto-role assignment for contacts.

---

## Status Summary

### Already Completed (from SPRINT-O)

| # | Backlog | Title | Status | Notes |
|---|---------|-------|--------|-------|
| - | BACKLOG-1340 | Auto-sync email attachment linking | **Completed** | Merged in SPRINT-O |
| - | BACKLOG-1341 | Support widget on all screens | **Completed** | Merged in SPRINT-O |
| - | BACKLOG-1347 | Account verification setup failed | **Completed** | Merged in SPRINT-O |

These three items are already `completed` in Supabase. No further action needed.

### Active Sprint Items

| # | Task | Backlog | Area | Type | Priority | Est. Tokens | Execution |
|---|------|---------|------|------|----------|-------------|-----------|
| 1 | TASK-2316 | BACKLOG-1351 | desktop (electron/) | chore | low | ~10K | Phase 1 (Parallel) |
| 2 | TASK-2317 | BACKLOG-1352 | desktop (electron/) | chore | low | ~5K | Phase 1 (Parallel) |
| 3 | TASK-2318 | BACKLOG-1349 | desktop (src/) | bug | medium | ~10K | Phase 1 (Parallel) |
| 4 | TASK-2319 | BACKLOG-1350 | desktop (src/) | bug | medium | ~15K | Phase 1 (Parallel) |
| 5 | TASK-2315 | BACKLOG-1344 | admin-portal | feature | medium | ~25K | Phase 2 (Sequential) |
| 6 | TASK-2320 | BACKLOG-1355 | desktop (electron/ + src/) | feature | medium | ~40K | Phase 2 (Sequential) |

**Total Estimated Tokens:** ~105K

---

## Dependency Graph

```
Phase 1 (Parallel — no shared files)
├── TASK-2316: Feature gate logging cleanup (electron/handlers/featureGateHandlers.ts + electron/services/featureGateService.ts)
├── TASK-2317: Extract team features deny list (electron/handlers/featureGateHandlers.ts)
├── TASK-2318: SSO post-login card padding (src/components/onboarding/shell/OnboardingShell.tsx)
└── TASK-2319: Contact Support opens widget (src/appCore/state/machine/components/ErrorScreen.tsx + src/components/onboarding/steps/AccountVerificationStep.tsx)

Phase 2 (After Phase 1 merges — independent of each other)
├── TASK-2315: Edit/delete internal comments (admin-portal — Supabase migration + admin-portal UI)
└── TASK-2320: Auto-assign default roles (electron/ schema + service + src/ UI)
```

### Why This Grouping?

**Phase 1 tasks are parallel-safe:**
- TASK-2316 and TASK-2317 both touch `featureGateHandlers.ts` — BUT TASK-2317 is a subset of the same file. **These two MUST be sequential** (run 2317 after 2316 merges, or combine into one task).
- TASK-2318 touches onboarding shell CSS — isolated from other tasks.
- TASK-2319 touches ErrorScreen and AccountVerificationStep — isolated from 2318's shell file.

**IMPORTANT: TASK-2316 and TASK-2317 share `featureGateHandlers.ts`. They should be combined or run sequentially within Phase 1.**

**Revised Phase 1 execution:**
```
Phase 1a (Parallel):
├── TASK-2316 + TASK-2317 (combined — same file, related cleanup)
├── TASK-2318 (SSO card padding — isolated)
└── TASK-2319 (Contact Support button — isolated)

Phase 2 (After Phase 1 merges, parallel with each other):
├── TASK-2315 (edit/delete comments — admin-portal only)
└── TASK-2320 (auto-assign roles — desktop only)
```

---

## Branch Strategy

All branches from `develop`, all PRs target `develop`.

| Task | Branch Name | Target |
|------|-------------|--------|
| TASK-2316 + TASK-2317 | `fix/task-2316-feature-gate-cleanup` | `develop` |
| TASK-2318 | `fix/task-2318-sso-card-padding` | `develop` |
| TASK-2319 | `fix/task-2319-contact-support-widget` | `develop` |
| TASK-2315 | `feature/task-2315-edit-delete-internal-comments` | `develop` |
| TASK-2320 | `feature/task-2320-auto-assign-contact-roles` | `develop` |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TASK-2315 requires Supabase migration | Low | Medium | Migration is additive only (new columns) |
| TASK-2320 requires SQLite schema change | Medium | Medium | Use migration system; test rollback |
| TASK-2316/2317 merge conflict if not combined | High | Low | Combine into single task |
| TASK-2319 may need SupportWidget API changes | Low | Low | Widget already supports external trigger via state |

---

## Testing & Quality Plan

| Task | Unit Tests | Manual Testing | CI Gates |
|------|-----------|----------------|----------|
| TASK-2316+2317 | Update existing featureGate tests if log levels checked | Verify no warn spam in console | type-check, lint, test |
| TASK-2318 | No (CSS-only change) | Resize window to small screen, verify card padding | type-check, lint |
| TASK-2319 | No (UI wiring change) | Trigger error screen, click Contact Support, verify widget opens | type-check, lint, test |
| TASK-2315 | No (RPC + UI, tested via admin portal) | Post note, edit, delete, verify indicators | type-check, admin-portal build |
| TASK-2320 | Test role persistence logic | Add contact to transaction, verify role remembered on next transaction | type-check, lint, test |

---

## Completion Tracking

| Task | Status | PR | Merged |
|------|--------|----|--------|
| TASK-2316+2317 | Pending | | |
| TASK-2318 | Pending | | |
| TASK-2319 | Pending | | |
| TASK-2315 | Pending (from SPRINT-O) | | |
| TASK-2320 | Pending | | |
