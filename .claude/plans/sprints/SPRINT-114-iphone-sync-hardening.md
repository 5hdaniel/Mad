# SPRINT-114: iPhone Sync Hardening

**Created:** 2026-03-05
**Status:** QA Passed -- Awaiting SR Engineer Review
**Goal:** Harden iPhone sync UX with network resilience, test coverage, and persistent progress visibility
**Parent:** SPRINT-110 (discovered items)

---

## Sprint Narrative

SPRINT-110 fixed critical iPhone sync UX bugs. During testing, four follow-up issues were discovered:
- Session validator falsely invalidates sessions when iPhone tethering changes the network source
- No unit tests for the ACID rollback logic added in TASK-2110b
- Sync progress is trapped in a modal — user can't navigate during long syncs
- Renderer loses all progress visibility if it reloads during a sync

This sprint addresses them in dependency order: quick fixes first (848, 849), then the larger UI work (847, which also solves 846).

---

## In-Scope

| Task ID | Backlog | Title | Priority | Est. Complexity | Status | Branch |
|---------|---------|-------|----------|-----------------|--------|--------|
| TASK-2114 | BACKLOG-848 | Session validator network change resilience | Medium | Low | Completed | `fix/TASK-2114-session-validator-retry` |
| TASK-2115 | BACKLOG-849 | Unit tests for ACID rollback logic | Low | Medium | Completed | `test/TASK-2115-rollback-tests` |
| TASK-2116 | BACKLOG-847 | Persistent sync status bar (replaces modal) | High | High | Completed | `feature/TASK-2116-sync-status-bar` |
| TASK-2117 | BACKLOG-846 | Reconnect renderer to in-progress sync | High | Medium | Subsumed by TASK-2119 | — |
| TASK-2119 | BACKLOG-853 | Integrate iPhone sync into SyncOrchestrator | High | High | QA Passed | `feature/TASK-2119-iphone-orchestrator` |
| TASK-2120 | BACKLOG-855 | requestSync: don't block on external-only running | Medium | Low | QA Passed | `feature/TASK-2119-iphone-orchestrator` |
| TASK-2121 | BACKLOG-857 | Persist iPhone lastSyncTime in Supabase per device | Medium | Low | QA Passed | `feature/TASK-2119-iphone-orchestrator` |

## Out of Scope / Deferred

- General session validator refactoring beyond retry logic
- Sync progress estimation improvements (idevicebackup2 limitation)
- Sync cancellation UX improvements beyond ACID rollback

---

## Execution Plan

### Phase 1: Quick Fixes (Parallel)
- **TASK-2114**: Add retry with delay to session validator before treating session as invalid
- **TASK-2115**: Write integration tests for rollback, cancel signal, orphaned file safety

### Phase 2: Persistent Status Bar
- **TASK-2116**: Replace sync modal with persistent status bar visible from any screen
  - Show bytes transferred + file count
  - Allow navigation while sync runs
  - Clicking expands to full details

### Phase 3: Orchestrator Integration (builds on Phase 2)
- **TASK-2119**: Register iPhone sync with SyncOrchestrator
  - iPhone appears as standard pill in SyncStatusIndicator
  - `isRunning` includes iPhone → buttons disable naturally
  - Remove SyncStatusBanner, remove bolted-on iPhone props
  - Keep IPhoneSyncFlow modal with "Details" button
  - Subsumes TASK-2117 reconnect (orchestrator + hook reconnect handles it)

### Phase 4: Data Persistence (builds on Phase 3)
- **TASK-2121**: Persist iPhone lastSyncTime in Supabase per device
  - New `iphone_sync_devices` table with RLS
  - Write lastSyncTime on storage-complete (fire-and-forget)
  - Read lastSyncTime on device connect via IPC
  - Graceful offline fallback (null if Supabase unreachable)

---

## QA Results (2026-03-06)

All 7 test scenarios passed on real hardware (iPhone connected via USB).

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 1 | Full sync stores >0 records | PASS | 639K messages, 1,105 contacts |
| 2 | Cancel then reopen shows ConnectionStatus | PASS | No empty modal |
| 3 | No false notifications on cancel | PASS | Clean cancel flow |
| 4 | DismissSync resets SuccessState | PASS | Reopen shows fresh state |
| 5 | lastSyncTime persists to Supabase | PASS | "Last synced: Just now" after restart |
| 6 | Incremental sync | PASS | 22 messages on second sync |
| 7 | Friendly phase labels | PASS | "Exporting" instead of "backing_up" |

### Additional Bug Fixes Discovered and Resolved During QA

| Fix | Commit | Description |
|-----|--------|-------------|
| Renderer log relay | `65e7dbd3` | electron-log vs logService mismatch in renderer |
| Migration 32 idempotency | `65e7dbd3` | schema.sql created index before column existed |
| Empty modal on cancel-reopen | `65e7dbd3` | syncStateRef guard on onProgress prevents stale updates |
| Stuck SuccessState on reopen | `65e7dbd3` | Added dismissSync to reset state before re-entering flow |
| setState-during-render | `65e7dbd3` | queueMicrotask for registerExternalSync call timing |
| Component logging | `65e7dbd3` | Mount/unmount/click logging across sync UI components |
| Friendly phase labels | `65e7dbd3` | Dashboard pills show "Exporting" not "backing_up" |
| Supabase migration | Applied | iphone_sync_devices table with RLS |

---

## Merge Plan

- Base branch: `develop`
- **Phase 1** (TASK-2114, TASK-2115): Merged independently via separate PRs -- DONE
- **Phase 2** (TASK-2116): Merged via separate PR -- DONE
- **Phase 3+4** (TASK-2119, TASK-2120, TASK-2121): Single branch `feature/TASK-2119-iphone-orchestrator`, single PR #1063
  - All three tasks modify overlapping files (sync-handlers.ts, useIPhoneSync.ts, SyncOrchestratorService.ts)
  - Combined to avoid merge conflicts
  - TASK-2117 subsumed by TASK-2119 (orchestrator reconnect handles it)

---

## Testing Plan

| Task | Test Type | Details |
|------|-----------|---------|
| TASK-2114 | Unit | Mock network change scenarios, verify retry prevents false logout |
| TASK-2115 | Integration | Test rollback deletes, orphan file safety, cancel mid-batch |
| TASK-2116 | Unit + Manual | Status bar renders, progress updates, navigation works during sync |
| TASK-2117 | Integration + Manual | Reload during sync reconnects to progress, status bar shows live data |
| TASK-2121 | Manual | Sync iPhone, restart app, reconnect iPhone -- lastSyncTime should persist |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| TASK-2116 is a significant UI refactor (modal → status bar) | Medium | Keep modal as fallback, feature-flag if needed |
| TASK-2117 depends on main process state query which may not exist | Medium | Investigation needed — may need new IPC channel |
| Session validator retry could mask real session issues | Low | Only retry on network change, not on explicit invalidation |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| SPRINT-114 not 113 | 113 already reserved for admin RBAC in unmerged PR #1045 |
| 848+849 before 847+846 | Quick fixes first, larger UI work depends on understanding the sync state flow |
| 847 before 846 | Persistent status bar (847) largely solves reconnect (846) — build the target first |
| New table vs devices column for 857 | iPhone UDIDs are a different concept from desktop device_id (machine ID). Separate table avoids coupling and schema migration risk |
| TASK-2121 on same branch as TASK-2119 | Both modify sync-handlers.ts and useIPhoneSync.ts; same branch avoids merge conflicts |

---

## Discovered During SPRINT-110

These are the source backlog items:

| Backlog ID | Title | Priority |
|------------|-------|----------|
| BACKLOG-846 | Reconnect renderer to in-progress sync after reload | High |
| BACKLOG-847 | Persistent status bar for sync instead of modal | High |
| BACKLOG-848 | Session validator resilience to network changes | Medium |
| BACKLOG-849 | Unit tests for ACID rollback logic | Low |
