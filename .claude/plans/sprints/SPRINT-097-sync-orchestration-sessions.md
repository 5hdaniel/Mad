# SPRINT-097: Sync Orchestration + Sessions

**Created:** 2026-02-22
**Status:** Completed
**Base:** `develop` (after SPRINT-096 work merged)

---

## Sprint Goal

Improve sync UX with rate limiting and orchestrator awareness, implement cross-platform session management, and eliminate the confusing SyncOrchestrator naming collision.

## Sprint Narrative

Three workstreams addressing different layers of the sync and session infrastructure:

1. **Cross-platform session management** (High): Users can be logged in on multiple desktops and the broker portal simultaneously, but there is no way to see active sessions, no way to sign out all from the broker portal, and desktop doesn't auto-detect when its session is invalidated. This creates security gaps and confusing stale-UI scenarios.

2. **Sync rate limiting** (Medium): Transaction-level email sync has no rate limiter (unlike scan with its 5s cooldown), and sync buttons in TransactionDetails don't know about the global dashboard sync. Users can trigger concurrent syncs that waste API quota and show confusing dual progress indicators.

3. **SyncOrchestrator rename** (Low): SR Engineer identified a naming collision between the electron-side `SyncOrchestrator` (iPhone/Windows device sync) and the renderer-side `SyncOrchestratorService` (sync queue). Pure cosmetic rename to eliminate confusion.

---

## In-Scope

| ID | Title | Task | Batch | Est Tokens | Actual Tokens | PR | Merged | Status |
|----|-------|------|-------|-----------|---------------|-----|--------|--------|
| BACKLOG-800 | Cross-platform session management | TASK-2062 | 1 (parallel) | ~80K | ~80K | #957 | 2026-02-23 | Completed |
| BACKLOG-791 | Rate limiter + disable sync buttons | TASK-2063 | 1 (parallel) | ~30K | ~25K | #956 | 2026-02-23 | Completed |
| BACKLOG-793 | Rename conflicting SyncOrchestrator | TASK-2064 | 2 (after TASK-2063) | ~13K | ~13K | #958 | 2026-02-23 | Completed |

**Total Estimated Tokens:** ~123K (engineering) + ~35K (SR review) = ~158K

---

## Out of Scope

- **Full SyncOrchestrator unification** (BACKLOG-792/BACKLOG-801) -- Routing all sync paths through the orchestrator is a multi-sprint effort. TASK-2063 adds awareness without full routing.
- **Selective per-device sign-out** -- BACKLOG-800 gap #3. Deferred to future sprint.
- **Session timeout/auto-expire** -- BACKLOG-742. Separate item.
- **OAuth token refresh race condition** -- BACKLOG-794. Low priority, no production reports.

---

## Execution Plan

### Batch 1 (Parallel): TASK-2062, TASK-2063

These tasks touch completely different areas:

| Task | Primary Files | Overlap Risk |
|------|--------------|--------------|
| TASK-2062 (Sessions) | `sessionHandlers.ts`, `authBridge.ts`, `Settings.tsx`, `useSessionValidator.ts` (new), broker portal files | None with TASK-2063 |
| TASK-2063 (Rate limiter) | `emailSyncHandlers.ts`, `TransactionDetails.tsx` | None with TASK-2062 |

**Safe for parallel execution.** No shared files.

### Batch 2 (Sequential, after TASK-2063): TASK-2064

TASK-2064 (rename) should run after TASK-2063 because:
- Both are in the sync infrastructure area
- TASK-2063 may add new references to `SyncOrchestrator` in TransactionDetails.tsx (importing useSyncOrchestrator)
- TASK-2064 only renames the ELECTRON-side service, not the renderer-side one, so there should be no actual conflict
- However, running sequentially avoids any risk of merge confusion between "syncOrchestrator" references in different contexts

**Alternative:** If SR confirms TASK-2064 only touches `electron/` files and TASK-2063 only touches `electron/handlers/emailSyncHandlers.ts` + `src/components/TransactionDetails.tsx`, they could run in parallel. SR to decide.

---

## Dependency Graph

```
TASK-2062 (Sessions)         ──┐
TASK-2063 (Rate limiter)     ──┼── Batch 1 (parallel)
                                │
                                ▼
              TASK-2064 (Rename) ── Batch 2
```

---

## Cross-Sprint Dependencies

| Dependency | Sprint | Status |
|-----------|--------|--------|
| SPRINT-096 merged to develop | SPRINT-096 | Must complete first |
| PR #939 (stale session auto-clear) | Already merged | Done |
| PR #944 (desktop onLogout flow fix) | Already merged | Done |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| TASK-2062 is large (~80K) and touches both desktop + broker portal | Clear scope boundaries. Broker portal changes are additive (new button + list). |
| Session polling may cause excessive Supabase API usage | 60-second interval is conservative. Only polls when app is in foreground. |
| TASK-2064 rename may miss references | Type-check will catch any missed references. Run `grep` first. |
| Broker portal changes need separate deployment | Include in same PR for atomic review, deploy broker portal after merge. |

---

## Sprint Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Total Estimated Tokens | ~158K | ~118K (engineering) |
| Number of Tasks | 3 | 3 |
| Parallel Tasks | 2 in Batch 1, 1 in Batch 2 | 2 in Batch 1, 1 in Batch 2 |
| Expected Duration | 1-2 sessions (overnight) | 1 session |

---

## Retrospective

**Date:** 2026-02-23
**Status:** All tasks completed and merged to develop.

### PRs Merged

| Task | PR | Merged |
|------|-----|--------|
| TASK-2062 (cross-platform session management) | #957 | 2026-02-23 |
| TASK-2063 (sync rate limiter) | #956 | 2026-02-23 |
| TASK-2064 (rename SyncOrchestrator) | #958 | 2026-02-23 |

### Additional PR (Out of Sprint Scope)

- **PR #959** (BACKLOG-812): Broker portal login redirect for agent license users. Created and merged during QA testing of TASK-2062's broker portal changes.

### QA Findings

All 3 tasks passed QA. The following backlog items were added during QA:

- **BACKLOG-811:** Selective per-device session sign out (from TASK-2062). Already noted as out-of-scope in the task.
- **BACKLOG-812:** Broker portal login redirect for agent license users (from TASK-2062 QA). Completed immediately as PR #959.

### Notable Observations

- TASK-2063 (rate limiter) was defensive/redundant -- existing UI already disables sync buttons during sync. The rate limiter adds a backend safety net, but no observable behavior change was noted during QA.
- TASK-2062 was the largest task across all 3 sprints (~80K), touching both desktop and broker portal. The dual type declaration issue (window.d.ts + electron/types/ipc.ts) appeared again.
- TASK-2064 (rename) was a straightforward mechanical refactor with no issues.
- Batch execution worked as planned: TASK-2062 and TASK-2063 ran in parallel, TASK-2064 followed after TASK-2063.
