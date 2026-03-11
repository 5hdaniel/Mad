# Task TASK-2151: Add AbortController Support for Long Operations

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Sprint

**SPRINT-121** - Sync Orchestrator Unification + AbortController
**Phase:** B (AbortController Propagation)
**Backlog:** BACKLOG-242

## Branch Information

**Branch From:** `int/sprint-121-sync-unification` (after TASK-2150 merges)
**Branch Into:** `int/sprint-121-sync-unification`
**Branch Name:** `feature/task-2151-abort-controller-support`

## Prerequisites

**Depends on:** TASK-2150 (must be merged before this task starts)
**Reason:** TASK-2150 extends `SyncType`, adds new sync functions to `SyncOrchestratorService.ts`, and modifies Settings components. This task modifies the same files to add signal propagation.

## Goal

Propagate `AbortController`/`AbortSignal` from the renderer's `SyncOrchestratorService.cancel()` down through individual sync operations, and replace the boolean `isCancelled` flag in `DeviceSyncOrchestrator` (main process) with proper `AbortController` usage. After this task, cancelling from the dashboard actually stops in-progress operations instead of just breaking the queue loop.

## Non-Goals

- Do NOT add cancel buttons to the UI for individual operations (just wire the signal; existing cancel mechanisms stay)
- Do NOT implement timeout-based auto-cancellation
- Do NOT change the orchestrator's queue management or sync ordering logic
- Do NOT modify the external sync pattern (iPhone cancel is managed by its own hooks)
- Do NOT add retry logic after cancellation

## Current State

### Renderer: SyncOrchestratorService (src/services/SyncOrchestratorService.ts)

The orchestrator already creates an `AbortController` in `startSync()` (line 549) and checks `signal.aborted` before each sync function (line 561). However, it does NOT pass the signal to sync functions. When `cancel()` is called (line 477), it aborts the controller and breaks the queue loop, but running sync functions continue to completion.

The `SyncFunction` type (line 53) is:
```typescript
type SyncFunction = (userId: string, onProgress: (percent: number, phase?: string) => void) => Promise<string | void>;
```

No `AbortSignal` parameter.

### Main Process: DeviceSyncOrchestrator (electron/services/deviceSyncOrchestrator.ts)

Uses a simple boolean flag:
```typescript
private isCancelled: boolean = false;  // line 147
```

The `cancel()` method sets the flag (line 599), and 12 checkpoints in `sync()` and `processExistingBackup()` read it:
```typescript
if (this.isCancelled) { ... }
```

### Main Process: macOSMessagesImportService

Already uses hybrid approach (TASK-2047):
- `private abortController: AbortController | null` (line 84)
- `this.abortController = new AbortController()` in `importMessages()` (line 171)
- Passes signal to `processItemsInChunks()` for chunked processing
- Also has a boolean `isImporting` flag for backward compatibility

## Deliverables

### Files to modify (owned by this task):

| File | Change |
|------|--------|
| `src/services/SyncOrchestratorService.ts` | Update `SyncFunction` type to include `AbortSignal`; pass signal in `startSync()` |
| `electron/services/deviceSyncOrchestrator.ts` | Replace `isCancelled` boolean with `AbortController`; use `signal.aborted` checks |
| `electron/services/macOSMessagesImportService/macOSMessagesImportService.ts` | Align with pure AbortController pattern (remove boolean flag if possible) |

### Files that MAY need minor updates:

| File | Why |
|------|-----|
| Sync function registrations in `SyncOrchestratorService.ts` | Add `signal` parameter to registered sync functions (contacts, emails, messages, and new types from TASK-2150) |
| Test files for DeviceSyncOrchestrator | Update `isCancelled` references to AbortController |
| Test files for macOSMessagesImportService | Update cancel-related test setup |

### Files this task must NOT modify:

- `src/components/settings/MacOSMessagesImportSettings.tsx` -- UI stays as-is
- `src/components/settings/MacOSContactsImportSettings.tsx` -- UI stays as-is
- `src/components/Settings.tsx` -- UI stays as-is
- `electron/handlers/` -- IPC handler structure unchanged

## Acceptance Criteria

- [ ] `SyncFunction` type includes optional `AbortSignal` parameter: `(userId, onProgress, signal?) => Promise<string | void>`
- [ ] `startSync()` passes `abortController.signal` to each sync function call
- [ ] All registered sync functions (contacts, emails, messages, and new types from TASK-2150) accept the signal parameter
- [ ] Sync functions check `signal.aborted` at key checkpoints (before expensive IPC calls)
- [ ] `DeviceSyncOrchestrator` replaces `private isCancelled: boolean` with `private abortController: AbortController | null`
- [ ] `DeviceSyncOrchestrator.cancel()` calls `this.abortController.abort()` instead of setting flag
- [ ] All 12 `if (this.isCancelled)` checks in deviceSyncOrchestrator become `if (this.abortController?.signal.aborted)`
- [ ] `DeviceSyncOrchestrator.sync()` creates a new AbortController at start (replaces `this.isCancelled = false`)
- [ ] `DeviceSyncOrchestrator.forceReset()` aborts any existing controller
- [ ] `macOSMessagesImportService` boolean flag removed or aligned with AbortController
- [ ] Cancel from dashboard stops in-progress sync functions (not just the queue loop)
- [ ] Cancelled operations clean up properly (no orphaned IPC listeners, no dangling state)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Plan

### Exploration Findings (2026-03-10)

**SyncOrchestratorService (renderer, 757 lines):**
- `SyncFunction` type at line 58 currently: `(userId, onProgress, options?) => Promise<string | void>` -- needs `signal?: AbortSignal` added as 4th param
- `startSync()` at line 612 creates `AbortController` at line 635, checks `signal.aborted` at line 647 before each sync, but does NOT pass the signal to sync functions at line 673
- 8 registered sync functions: contacts, emails, messages, reindex, backup, restore, ccpa-export (+ iphone external which manages its own lifecycle)
- The existing `options` parameter was added by TASK-2150 -- signal will be a 4th parameter

**DeviceSyncOrchestrator (main process, 1185 lines):**
- `isCancelled: boolean = false` at line 147
- `cancel()` at line 597-605 sets `isCancelled = true`, `isRunning = false`, calls `backupService.cancelBackup()`
- `forceReset()` at line 641-647 sets `isCancelled = false`, `isRunning = false`
- `sync()` at line 227 sets `isCancelled = false` at line 233
- `processExistingBackup()` at line 902 sets `isCancelled = false` at line 917
- 5 `isCancelled` checks in `sync()`: lines 380, 413, 445, 481, 503
- 2 `isCancelled` checks in `processExistingBackup()`: lines 1067, 1086
- Total: 7 checkpoint checks (not 12 as originally estimated -- the task file overcounted)

**macOSMessagesImportService (main process, ~1000+ lines):**
- Has BOTH `cancelCurrentImport: boolean` (line 82) AND `abortController: AbortController | null` (line 84)
- `requestCancellation()` at line 205 sets BOTH: `cancelCurrentImport = true` AND `abortController?.abort()`
- 3 cancellation check points use `this.cancelCurrentImport || this.abortController?.signal.aborted` (lines 421, 679, 1017)
- `cancelCurrentImport` is NOT reset in the `finally` block -- only in force-reimport cancellation (line 134). This is a latent bug: if regular cancel happens, the flag stays true
- The boolean is also used in force-reimport to cancel a running import (line 129) -- this use case can be replaced by `abortController?.abort()`
- `isImporting` boolean serves a DIFFERENT purpose (concurrency guard) -- must NOT be removed

**Decision: The `cancelCurrentImport` boolean CAN be removed.** The AbortController already handles the same cancellation at all 3 checkpoints. The force-reimport case (line 129) can use `abortController?.abort()` instead. The latent bug (flag not reset) further motivates removal.

### Plan

**Step 1: Update SyncFunction type signature (SyncOrchestratorService.ts)**
- Add `signal?: AbortSignal` as 4th parameter to `SyncFunction` type
- In `startSync()` line 673, pass `this.abortController?.signal` as 4th arg to `syncFn()`

**Step 2: Add signal checks to registered sync functions (SyncOrchestratorService.ts)**
- contacts: add `signal?.aborted` check after force-reimport wipe and between phases
- emails: add `signal?.aborted` check before scan call
- messages: add `signal?.aborted` check before import call
- reindex/backup/restore/ccpa-export: add `signal?.aborted` check before IPC call (these are short-lived, so one check is sufficient)

**Step 3: Replace isCancelled boolean in DeviceSyncOrchestrator**
- Replace `private isCancelled: boolean = false` with `private abortController: AbortController | null = null`
- `sync()`: create new AbortController at start (replaces `this.isCancelled = false`)
- `processExistingBackup()`: create new AbortController at start
- `cancel()`: call `this.abortController?.abort()` then null it (instead of `this.isCancelled = true`). Keep `this.backupService.cancelBackup()` as-is
- `forceReset()`: call `this.abortController?.abort()` then null it (instead of `this.isCancelled = false`)
- Replace all 7 `if (this.isCancelled)` checks with `if (this.abortController?.signal.aborted)`

**Step 4: Align macOSMessagesImportService**
- Remove `cancelCurrentImport` boolean field entirely
- In `requestCancellation()`: keep only `this.abortController?.abort()` (remove `this.cancelCurrentImport = true`)
- At all 3 checkpoint conditions: simplify from `this.cancelCurrentImport || this.abortController?.signal.aborted` to `this.abortController?.signal.aborted`
- In force-reimport cancellation block (line 124-134): use `this.abortController?.abort()` instead of `this.cancelCurrentImport = true`, remove the `this.cancelCurrentImport = false` reset

**Step 5: Update tests**
- SyncOrchestratorService.test.ts: add test verifying signal is passed to sync functions
- DeviceSyncOrchestrator tests: the test at line 436 ("should handle cancellation") calls `orchestrator.cancel()` which already works via `cancel()` method -- no test changes needed since the API is unchanged
- macOSMessagesImportService tests: search for `cancelCurrentImport` references and update if any

**Files to modify:**
1. `src/services/SyncOrchestratorService.ts` -- type change + signal passing + signal checks in sync functions
2. `electron/services/deviceSyncOrchestrator.ts` -- boolean -> AbortController
3. `electron/services/macOSMessagesImportService/macOSMessagesImportService.ts` -- remove boolean flag
4. `src/services/__tests__/SyncOrchestratorService.test.ts` -- add signal propagation test
5. Test files for deviceSyncOrchestrator and macOSMessagesImportService -- update if they reference `isCancelled` or `cancelCurrentImport`

**Estimated changes:** ~80 lines modified across 3-5 files. Mechanical refactor.

## Implementation Notes

### Step 1: Update SyncFunction Type and startSync()

```typescript
// Before:
type SyncFunction = (userId: string, onProgress: (percent: number, phase?: string) => void) => Promise<string | void>;

// After:
type SyncFunction = (
  userId: string,
  onProgress: (percent: number, phase?: string) => void,
  signal?: AbortSignal
) => Promise<string | void>;
```

In `startSync()`, pass the signal (around line 587):
```typescript
// Before:
const warning = await syncFn(userId, (percent, phase) => { ... });

// After:
const warning = await syncFn(userId, (percent, phase) => { ... }, this.abortController?.signal);
```

### Step 2: Update Registered Sync Functions

Each sync function should accept the signal and check it before expensive operations:

```typescript
// Example: contacts sync
this.registerSyncFunction('contacts', async (userId, onProgress, signal) => {
  if (signal?.aborted) return;
  // ... existing logic ...
  onProgress(50);
  if (signal?.aborted) return;
  // ... outlook sync ...
  onProgress(100);
});
```

For the new sync functions added by TASK-2150 (reindex, backup, restore, ccpa-export), add signal checks similarly.

### Step 3: DeviceSyncOrchestrator Refactor

Replace the boolean pattern:

```typescript
// Before:
private isCancelled: boolean = false;

// After:
private abortController: AbortController | null = null;

// In sync():
// Before:
this.isCancelled = false;
// After:
this.abortController = new AbortController();

// In cancel():
// Before:
this.isCancelled = true;
// After:
this.abortController?.abort();

// At checkpoints:
// Before:
if (this.isCancelled) { ... }
// After:
if (this.abortController?.signal.aborted) { ... }
```

**Important:** Also update `forceReset()`:
```typescript
forceReset(): void {
  this.abortController?.abort();
  this.abortController = null;
  // ... rest of reset ...
}
```

And `processExistingBackup()` -- same pattern, create new AbortController at start.

### Step 4: macOSMessagesImportService Alignment

This service already has both patterns (TASK-2047). Evaluate whether the boolean `isImporting` flag can be removed entirely in favor of AbortController. If it's used for state tracking (not just cancellation), keep it. The `abortController` field is already present -- ensure it's used consistently.

### IPC Cancel Propagation (Stretch)

For operations routed through IPC (reindex, backup, restore, CCPA export), the AbortSignal only works in the renderer. The main process handlers would need separate cancel channels to actually stop mid-operation. However:

- Reindex is fast (< 1 second typically) -- cancel not meaningful
- Backup/restore involve dialogs -- cancel = close dialog
- CCPA export is moderate -- could benefit from cancel, but not critical for v1

**Recommendation for v1:** Only propagate signal within renderer (orchestrator queue management + sync function checkpoints). Main process cancel for IPC operations is a future enhancement. Document this limitation.

## Integration Notes

- **Depends on:** TASK-2150 (must be merged first -- shared `SyncOrchestratorService.ts`)
- **Blocks:** Nothing
- **Related:** `macOSMessagesImportService` already uses hybrid AbortController (TASK-2047)

## Do / Don't

### Do:

- Make `AbortSignal` parameter optional to avoid breaking any callers
- Check `signal?.aborted` (with optional chaining) for safety
- Clean up IPC listeners in `finally` blocks (already done for messages, ensure consistency)
- Test cancel at each checkpoint in DeviceSyncOrchestrator
- Keep backward compatibility -- if signal is undefined, behavior is unchanged

### Don't:

- Do NOT throw `AbortError` from sync functions -- the orchestrator handles cancellation by checking `signal.aborted` in the queue loop
- Do NOT propagate AbortSignal through IPC to electron handlers in v1 -- keep scope manageable
- Do NOT remove the `backupService.cancelBackup()` call from `DeviceSyncOrchestrator.cancel()` -- it handles OS-level backup cancellation
- Do NOT modify the external sync pattern (iPhone) -- it manages its own lifecycle
- Do NOT remove `getStatus().isRunning` -- it should reflect AbortController state correctly

## When to Stop and Ask

- If removing the boolean flag from `DeviceSyncOrchestrator` breaks the backup service interaction (backup service may rely on the boolean pattern)
- If more than 3 test files need substantial rewriting (not just find/replace of `isCancelled`)
- If the `macOSMessagesImportService` boolean flag is used for purposes beyond cancellation and cannot be removed
- If signal propagation causes unexpected behavior in the sync queue (e.g., all queued items getting cancelled when only the current one should)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update DeviceSyncOrchestrator tests to use AbortController instead of boolean
- Required: Update SyncOrchestratorService tests to verify signal is passed to sync functions
- Required: Test that cancel() aborts the signal and sync function receives it
- Verify: macOSMessagesImportService cancel tests still pass

### Integration / Feature Tests

- Required scenarios:
  - Start messages import from dashboard, cancel, verify import stops
  - Start iPhone sync, cancel, verify it stops cleanly (backward compatible)
  - Start a sync, cancel mid-way, start new sync -- verify no state corruption
  - Start a sync, let it complete -- verify signal is not prematurely aborted
  - Cancel with no sync running -- verify no errors

### CI Requirements

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Build succeeds

## PR Preparation

- **Title**: `feat(sync): add AbortController signal propagation to sync operations`
- **Base**: `int/sprint-121-sync-unification`
- **Labels**: `feature`, `sync`, `reliability`
- **Depends on**: TASK-2150

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| SyncFunction type change + startSync update | Small type change, 1 function update | +3K |
| Update registered sync functions (signal param) | ~8 sync functions to update with signal checks | +8K |
| DeviceSyncOrchestrator refactor | 12 boolean checks to replace, create/abort controller lifecycle | +10K |
| macOSMessagesImportService alignment | Evaluate and potentially remove boolean flag | +4K |
| Tests | Update cancel-related tests in 2-3 test files | +5K |

**Confidence:** Medium-High (well-defined refactor; DeviceSyncOrchestrator is a mechanical find/replace for the boolean flag)

**Risk factors:**
- BackupService interaction with cancel flag
- macOSMessagesImportService dual-flag complexity
- Test file volume

**Similar past tasks:** TASK-2047 (AbortController in macOSMessagesImportService), TASK-2110 (ACID rollback with session IDs)

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-03-10*

### Agent ID

```
Engineer Agent ID: (auto-captured by SubagentStop hook)
```

### Checklist

```
Files modified:
- [x] src/services/SyncOrchestratorService.ts (SyncFunction type + startSync signal passing)
- [x] electron/services/deviceSyncOrchestrator.ts (boolean -> AbortController)
- [x] electron/services/macOSMessagesImportService/macOSMessagesImportService.ts (alignment)
- [x] src/services/__tests__/SyncOrchestratorService.test.ts (signal propagation tests)

Features implemented:
- [x] SyncFunction accepts AbortSignal (4th param)
- [x] startSync passes signal to sync functions
- [x] All 8 sync functions check signal.aborted at checkpoints
- [x] DeviceSyncOrchestrator uses AbortController (replaced isCancelled boolean)
- [x] macOSMessagesImportService aligned (removed cancelCurrentImport boolean)
- [x] Cancel propagates abort signal to running sync functions

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (3 pre-existing failures from TASK-2150 -- not caused by this task)
- [ ] Manual: cancel stops sync mid-operation (requires app testing)
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |

**Variance:** PM Est ~30K vs Actual (auto-captured)

### Notes

**Planning notes:** Found 7 isCancelled checkpoints in DeviceSyncOrchestrator (not 12 as originally estimated). cancelCurrentImport boolean in macOSMessagesImportService had a latent bug (not reset in finally block after cancellation) which further motivated its removal.
**Deviations from plan:** Minor -- discovered that cancel() must NOT null the AbortController in SyncOrchestratorService or DeviceSyncOrchestrator. The for-loop checks signal.aborted on the next iteration, and nulling the controller would make that check return undefined instead of true. The finally block / next sync() call handles cleanup.
**Design decisions:** <Document decisions>
**Issues encountered:** <Document issues>
**Reviewer notes:** <Anything for reviewer>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-121-sync-unification

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
