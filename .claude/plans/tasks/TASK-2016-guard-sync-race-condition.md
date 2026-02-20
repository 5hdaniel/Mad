# TASK-2016: Guard sync race condition at startup

**Backlog ID:** BACKLOG-599
**Sprint:** SPRINT-088
**Phase:** Phase 1 (Parallel - sync service, no overlap with other tasks)
**Branch:** `fix/task-2016-guard-sync-race-condition`
**Estimated Tokens:** ~8K

---

## Objective

Fix the race condition where `startPeriodicSync()` in `submissionSyncService.ts` fires before the database has finished initializing. Add a guard that ensures the database is ready before any sync operation attempts to use it.

---

## Context

### Investigation Findings

- **File:** `electron/services/submissionSyncService.ts`
- **Import:** Line 19 imports `databaseService`
- **`startPeriodicSync()` method:** Line 253
- **Database access points:** Lines 188, 424, 483, 537 all call `databaseService.getRawDatabase()`
- **Problem:** `startPeriodicSync()` can be called (e.g., from app initialization code) before `databaseService` has completed its async initialization. When `getRawDatabase()` is called on an uninitialized service, it either returns null/undefined or throws.

### How the Race Condition Manifests

1. App starts up
2. Main process kicks off various services in parallel
3. `submissionSyncService.startPeriodicSync()` is called
4. It immediately tries to sync, calling `databaseService.getRawDatabase()`
5. If `databaseService` hasn't finished initializing (async SQLite open + migrations), the call fails
6. Error may be silent (caught internally) or cause a visible crash depending on error handling

### Related Architecture

- `databaseService` has an async `initialize()` method that opens the SQLite connection and runs migrations
- Other services (like `LoadingOrchestrator`) already wait for DB init via the state machine
- `submissionSyncService` appears to be started independently, without waiting for the DB gate

---

## Requirements

### Must Do

1. **Add a database readiness check** in `startPeriodicSync()` before starting the sync interval
2. **Add a database readiness check** at the top of the sync execution method (the function that `startPeriodicSync` calls on each interval tick) -- belt and suspenders
3. **Implementation approach (choose one):**
   - **Option A (Preferred):** Check `databaseService.isInitialized()` or equivalent method at the start of sync. If not ready, skip silently and log at debug level. The next interval tick will retry.
   - **Option B:** Have `startPeriodicSync()` await `databaseService.whenReady()` (if such a promise exists) before starting the interval.
   - **Option C:** Move the `startPeriodicSync()` call site to after the database init completes (in the app initialization sequence).
4. **Add a log message** (via logService) when sync is skipped due to DB not ready, so it is diagnosable
5. **Verify the fix** by checking the call site where `startPeriodicSync()` is invoked -- ensure it cannot fire before DB init

### Must NOT Do

- Do NOT add a delay/sleep as a workaround
- Do NOT modify databaseService initialization logic
- Do NOT change the sync interval timing

### Acceptance Criteria

- [ ] `startPeriodicSync()` does not throw if called before DB is ready
- [ ] Sync gracefully skips and retries on next interval if DB is not ready
- [ ] Log message emitted when sync skipped (debug level)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] No regression in sync behavior when DB is ready

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/submissionSyncService.ts` | Add DB readiness guard in `startPeriodicSync()` and sync execution |
| Possibly: the file that calls `startPeriodicSync()` | Verify ordering relative to DB init |

---

## Implementation Summary

_To be filled by Engineer after implementation._

| Field | Value |
|-------|-------|
| Agent ID | |
| Branch | |
| PR | |
| Files Changed | |
| Tests Added/Modified | |
| Actual Tokens | |
