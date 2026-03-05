# SPRINT-110: iPhone Sync UX Fixes

**Created:** 2026-03-05
**Status:** Completed
**Goal:** Fix critical UX issues discovered during iPhone sync testing on Windows
**SR Review:** APPROVED WITH CHANGES (2026-03-05)

---

## Sprint Narrative

During hands-on testing of the iPhone sync flow on Windows, four UX issues were discovered:
1. The backup size estimate is wildly inaccurate (showed 10.6 GB / ~1.9 GB)
2. Terminology says "Backing up" but should say "Exporting"
3. Session validator kills the UI mid-sync, but the sync process keeps running headless
4. Cancelling a sync leaves partial data in the database

Issues range from cosmetic (rename) to critical (session kill during sync, partial data on cancel).

---

## In-Scope

| Task ID | Backlog | Title | Priority | Est. Complexity | Branch |
|---------|---------|-------|----------|-----------------|--------|
| TASK-2107 | BACKLOG-842 | Fix backup size estimate overflow | High | Low | `fix/TASK-2107-size-estimate` |
| TASK-2108 | BACKLOG-843 | Rename "Backing up" to "Exporting" | Medium | Low | `fix/TASK-2108-rename-exporting` |
| TASK-2109 | BACKLOG-844 | Prevent session validator from killing UI during sync | Critical | Medium | `fix/TASK-2109-session-sync-aware` |
| TASK-2110a | BACKLOG-845 | ACID rollback investigation (read-only) | High | Medium | N/A (investigation) |
| TASK-2110b | BACKLOG-845 | ACID rollback implementation | High | High | `fix/TASK-2110-acid-rollback` |

## Out of Scope / Deferred

- Improving the size estimate algorithm itself (would require changes to idevicebackup2 integration)
- General session validator refactoring beyond sync-awareness

---

## Execution Plan

### Phase 1: Quick UI Fixes + Investigation (Parallel)
- **TASK-2107**: Fix size estimate overflow (renderer-only)
- **TASK-2108**: Rename "Backing up" to "Exporting" (renderer-only)
- **TASK-2110a**: Investigate main process storage/cancel flow (read-only, no code changes)

### Phase 2: Session Safety
- **TASK-2109**: Add sync-awareness to session validator using module-level ref pattern

### Phase 3: ACID Rollback (after investigation findings)
- **TASK-2110b**: Implement rollback based on TASK-2110a findings

---

## Merge Plan (SR Review: per-task branches)

- Base branch: `develop`
- **Separate branch per task** with individual PRs to develop
- TASK-2107 and TASK-2108 merge independently (prevents TASK-2110 from blocking quick fixes)
- TASK-2109 merges after Phase 1
- TASK-2110b merges last

---

## Testing Plan

| Task | Test Type | Details |
|------|-----------|---------|
| TASK-2107 | Unit | Verify estimate hidden when bytesProcessed > estimatedTotalBytes; verify no regression for estimatedTotalBytes === 0/undefined |
| TASK-2108 | Unit | Verify phase title text changes; verify line 293 "backup completes" also updated |
| TASK-2109 | Unit + Integration | Unit test for defer path in useSessionValidator; integration test for deferred logout during active sync; verify new sync blocked after deferred logout flag set |
| TASK-2110b | Integration | Verify cancelled sync rolls back partial messages/contacts/attachments from DB and disk |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| TASK-2110 requires main process changes with no existing transaction support | High - 600k+ inserts unprotected | Investigation-first pattern; split into 2110a/2110b |
| Session validator changes could mask real session issues | Security | Only pause during active sync; block new syncs after deferred logout |
| Attachment files on disk not cleaned up on cancel | Data leak | TASK-2110b must address file cleanup in message-attachments/ |
| TASK-2107 + TASK-2108 modify same file | Merge conflict | Trivial rebase for second to merge |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Hide estimate rather than recalculate | idevicebackup2 doesn't provide accurate total size; hiding is honest |
| Defer logout during sync (not cancel sync on logout) | Sync can take hours; losing progress is worse than a delayed logout |
| Module-level ref for cross-hook communication | Simplest approach; avoids React context/event bus; safe in single-threaded renderer |
| Per-task branches instead of shared branch | SR review: prevents TASK-2110 complexity from blocking simpler fixes |
| Split TASK-2110 into investigation + implementation | SR review: main process has no transaction support; scope larger than initially estimated |

---

## Discovered During Sprint (Unresolved)

Issues found during hands-on testing that need a future sprint:

| Backlog ID | Title | Priority | Notes |
|------------|-------|----------|-------|
| BACKLOG-846 | Reconnect renderer to in-progress sync after reload | High | Hot reload/app restart kills progress UI but sync keeps running headless. User sees dead "Sync In Progress" banner. |
| BACKLOG-847 | Persistent status bar for sync instead of modal | High | Move sync progress to a non-blocking status bar so user can navigate during long syncs. Also solves BACKLOG-846. |
| BACKLOG-848 | Session validator resilience to network changes | Medium | iPhone tethering switches Windows network source, triggering false session invalidation and logout. |
| BACKLOG-849 | Unit tests for ACID rollback logic | Low | SR review found no tests for rollbackSession, deleteBySessionId, cancel signal mid-batch, or content-addressed file safety. |

**Recommendation:** BACKLOG-846 + 847 are the highest-impact items — they affect every sync session. Consider bundling them into a single sprint since 847 (persistent status bar) largely solves 846 (reconnect).
