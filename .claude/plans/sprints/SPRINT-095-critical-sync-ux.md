# SPRINT-095: Critical Sync UX

**Created:** 2026-02-22
**Status:** Planned
**Base:** `develop` (with all SPRINT-094 / Phase 0 work merged: PRs #940, #942, #943, #944)

---

## Sprint Goal

Fix the most user-visible sync UX bugs so that sync operations provide clear feedback, dismiss properly, and handle offline gracefully.

## Sprint Narrative

QA testing revealed several critical UX gaps in sync and network operations. The sync progress bar stays visible permanently after completion, network-dependent buttons spin or hang when offline, migration failures leave the app unbootable with no recovery path, and network failures are silently lost with no diagnostic trail. These are all user-facing issues that erode trust in the application.

---

## In-Scope

| ID | Title | Task | Batch | Est Tokens | Actual Tokens | PR | Merged | Status |
|----|-------|------|-------|-----------|---------------|-----|--------|--------|
| BACKLOG-798 | Sync progress bar auto-dismiss | TASK-2055 | 1 (parallel) | ~25K | - | - | - | Pending |
| BACKLOG-799 | Block network-dependent actions when offline | TASK-2056 | 1 (parallel) | ~60K | - | - | - | Pending |
| BACKLOG-787 | Migration failure auto-restore | TASK-2057 | 1 (parallel) | ~50K | - | - | - | Pending |
| BACKLOG-797 | Local failure logging for offline diagnostics | TASK-2058 | 2 (after TASK-2056) | ~40K | - | - | - | Pending |

**Total Estimated Tokens:** ~175K (engineering) + ~60K (SR review) = ~235K

---

## Out of Scope

- **Graceful read-only mode during sync** (BACKLOG-790) -- Separate feature, different sprint.
- **Sync history/logs screen** (BACKLOG-004) -- Diagnostic log (TASK-2058) is a stepping stone, but full UI is out of scope.
- **Auto-sync scheduling** -- Manual sync only in this sprint.
- **Cloud-side failure logging** (Sentry enhancements beyond migration capture) -- TASK-2057 adds Sentry for migration failures only.
- **Retry logic for failed operations** -- This sprint logs failures; retry is a follow-up.

---

## Execution Plan

### Batch 1 (Parallel): TASK-2055, TASK-2056, TASK-2057

These three tasks touch different areas of the codebase with minimal overlap:

| Task | Primary Files | Overlap Risk |
|------|--------------|--------------|
| TASK-2055 | `SyncStatusIndicator.tsx`, `SyncOrchestratorService.ts` | None with others |
| TASK-2056 | `Dashboard.tsx`, `Settings.tsx`, `NetworkContext.tsx`, fetch services | None with TASK-2055/2057 |
| TASK-2057 | `databaseService.ts`, `sqliteBackupService.ts` | None with TASK-2055/2056 |

SR Engineer to confirm parallel safety during Technical Review.

### Batch 2 (Sequential, after TASK-2056 merges): TASK-2058

TASK-2058 (failure logging) depends on TASK-2056 (offline blocking) because:
- Both touch network error handling paths
- TASK-2058 adds catch blocks that complement TASK-2056's timeout additions
- The failure log surfaces errors that TASK-2056's timeouts generate

---

## Dependency Graph

```
TASK-2055 (sync dismiss)     ──┐
TASK-2056 (offline blocking) ──┼── Batch 1 (parallel)
TASK-2057 (migration restore)──┘
                                │
                                ▼
                    TASK-2058 (failure logging) ── Batch 2
```

---

## Risks

| Risk | Mitigation |
|------|-----------|
| SyncOrchestratorService `isRunning` state not transitioning correctly | TASK-2055 investigates root cause; may need fix in service AND component |
| Timeout values (10-15s) may be too aggressive for slow connections | TASK-2056 should use conservative 15s default with configurable override |
| Migration auto-restore could mask data corruption | TASK-2057 requires backup integrity verification before restore |
| Failure log SQLite table could grow unbounded | TASK-2058 must implement retention (e.g., last 500 entries or 30 days) |

---

## Technical Review Checklist (SR Engineer)

- [ ] Confirm Batch 1 tasks have no shared file conflicts
- [ ] Review branch strategy for each task
- [ ] Add technical considerations to each task file
- [ ] Flag any architectural concerns
