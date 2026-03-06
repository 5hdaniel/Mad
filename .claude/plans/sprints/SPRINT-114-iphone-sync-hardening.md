# SPRINT-114: iPhone Sync Hardening

**Created:** 2026-03-05
**Status:** In Progress
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
| TASK-2119 | BACKLOG-853 | Integrate iPhone sync into SyncOrchestrator | High | High | Testing | `feature/TASK-2119-iphone-orchestrator` |

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

---

## Merge Plan

- Base branch: `develop`
- Separate branch per task with individual PRs to develop
- TASK-2114 and TASK-2115 merge independently (Phase 1)
- TASK-2116 merges after Phase 1
- TASK-2117 merges last (depends on 2116)

---

## Testing Plan

| Task | Test Type | Details |
|------|-----------|---------|
| TASK-2114 | Unit | Mock network change scenarios, verify retry prevents false logout |
| TASK-2115 | Integration | Test rollback deletes, orphan file safety, cancel mid-batch |
| TASK-2116 | Unit + Manual | Status bar renders, progress updates, navigation works during sync |
| TASK-2117 | Integration + Manual | Reload during sync reconnects to progress, status bar shows live data |

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

---

## Discovered During SPRINT-110

These are the source backlog items:

| Backlog ID | Title | Priority |
|------------|-------|----------|
| BACKLOG-846 | Reconnect renderer to in-progress sync after reload | High |
| BACKLOG-847 | Persistent status bar for sync instead of modal | High |
| BACKLOG-848 | Session validator resilience to network changes | Medium |
| BACKLOG-849 | Unit tests for ACID rollback logic | Low |
