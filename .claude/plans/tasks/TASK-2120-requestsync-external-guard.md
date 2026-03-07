# TASK-2120: requestSync should not block on external-only running state

**Backlog:** BACKLOG-855
**Sprint:** SPRINT-114
**Status:** QA Passed
**Branch:** `feature/TASK-2119-iphone-orchestrator` (same PR #1063)
**Estimated Tokens:** ~15K (service category x0.5 = ~8K engineer + ~7K SR review)
**Token Cap:** 60K

---

## Goal

Change the `requestSync` guard in `SyncOrchestratorService.ts` so that only **internal** running sync items block new sync requests. External syncs (e.g., iPhone) use completely different resources and should run in parallel with email/contacts/messages syncs.

## Non-Goals

- Do NOT change `forceSync`, `cancel`, `reset`, or any other method
- Do NOT change the `isRunning` state itself (it should still reflect ALL running items for UI purposes)
- Do NOT modify external sync registration/completion logic
- Do NOT refactor the overall queue structure

## Problem

Line 329 of `SyncOrchestratorService.ts`:
```typescript
if (this.state.isRunning) {
```

This checks the global `isRunning` flag, which is `true` when ANY sync (internal or external) is running. When only an iPhone (external) sync is active, requesting an email sync queues it as pending and asks for user confirmation. This is wrong -- iPhone and email use different resources.

## Deliverables

1. **Fix the guard** in `requestSync` (~line 329) to only check for internal running items
2. **Add a unit test** verifying that `requestSync` starts immediately when only external syncs are running
3. **Update the existing test comment** at line 521-523 that documents this as a known limitation

## Implementation Notes

### The Fix (SyncOrchestratorService.ts, requestSync method)

Replace:
```typescript
if (this.state.isRunning) {
```

With:
```typescript
// Only block if an internal sync is running. External syncs (e.g., iPhone)
// use different resources and can run in parallel with internal syncs.
const internalRunning = this.state.queue.some(
  (item) => !item.external && item.status === 'running'
);
if (internalRunning) {
```

Also update the Sentry breadcrumb `alreadyRunning` field to use `internalRunning` instead of `this.state.isRunning` for accurate diagnostics.

### The Test (SyncOrchestratorService.test.ts)

Add a test in the `external sync API (TASK-2119)` describe block:

```typescript
it('should allow requestSync to start when only external syncs are running (BACKLOG-855)', async () => {
  // Register iPhone external sync (sets isRunning = true)
  syncOrchestrator.registerExternalSync('iphone');
  expect(syncOrchestrator.getState().isRunning).toBe(true);

  // Register an internal sync function
  syncOrchestrator.registerSyncFunction('contacts', async (_userId: string, onProgress: (p: number) => void) => {
    onProgress(100);
  });

  // requestSync should start immediately, NOT queue as pending
  const result = syncOrchestrator.requestSync({ types: ['contacts'], userId: 'test-user' });
  expect(result.started).toBe(true);
  expect(result.needsConfirmation).toBe(false);

  await new Promise(resolve => setTimeout(resolve, 0));

  // Both should be in the queue
  const state = syncOrchestrator.getState();
  const iphone = state.queue.find(item => item.type === 'iphone');
  const contacts = state.queue.find(item => item.type === 'contacts');
  expect(iphone).toBeDefined();
  expect(iphone!.status).toBe('running');
  expect(contacts).toBeDefined();
  expect(contacts!.status).toBe('complete');
});
```

### Update existing test comment

The test at ~line 512 ("should keep external sync in queue when internal sync starts") has a comment:
```typescript
// Note: requestSync will see isRunning=true (from iPhone) and queue as pending
// Use forceSync instead to bypass the running check
```

After this fix, update that test to use `requestSync` instead of `forceSync`, since `requestSync` should now work correctly when only external syncs are running. This validates the fix end-to-end.

## Acceptance Criteria

- [ ] `requestSync` starts immediately when only external syncs (iPhone) are running
- [ ] `requestSync` still queues as pending when an internal sync is running
- [ ] New unit test covers the external-only-running scenario
- [ ] Existing test updated to use `requestSync` instead of `forceSync` workaround
- [ ] `npm test -- --testPathPattern=SyncOrchestratorService` passes
- [ ] `npm run type-check` passes

## Do

- Keep the fix minimal and focused
- Update the Sentry breadcrumb to log `internalRunning` for accurate diagnostics
- Match existing test patterns in the file

## Don't

- Change `isRunning` state semantics (it should still be true when external syncs run)
- Add new exports or interfaces
- Touch any other methods

## Stop-and-Ask Triggers

- If `this.state.queue` is empty when `requestSync` is called (shouldn't happen, but check)
- If there are other callers of `isRunning` that would break with this change

## Testing

Run: `npm test -- --testPathPattern=SyncOrchestratorService`
Run: `npm run type-check`

## PR Preparation

This fix goes into the existing PR #1063 on branch `feature/TASK-2119-iphone-orchestrator`.
Use `git -c core.hooksPath=/dev/null commit` (husky broken on Windows).

Commit message format:
```
fix: requestSync should not block on external-only running state

External syncs (iPhone) use different resources than internal syncs
(email/contacts). Only block requestSync when an internal sync is
already running.

Fixes BACKLOG-855
```

---

## Implementation Summary

*Completed: 2026-03-06*

**Commit:** `ca3ccc24` — fix: requestSync should not block on external-only running state

### Changes Made

| File | Change |
|------|--------|
| `src/services/SyncOrchestratorService.ts` | Changed `requestSync` guard from `this.state.isRunning` to `queue.some(!external && running)`; updated Sentry breadcrumb to log `internalRunning` |
| `src/services/__tests__/SyncOrchestratorService.test.ts` | Added dedicated BACKLOG-855 test, regression test confirming internal syncs still block, updated existing tests to use `requestSync` instead of `forceSync` workaround |

### Results

- **Before**: `requestSync` blocked when any sync (including external/iPhone) was running, requiring unnecessary user confirmation
- **After**: `requestSync` only blocks on internal running syncs; external syncs run in parallel
- **Lines changed**: +65 / -6 across 2 files
- **All acceptance criteria met**: requestSync starts immediately with external-only running, still queues with internal running, tests pass

### Issues/Blockers

None
