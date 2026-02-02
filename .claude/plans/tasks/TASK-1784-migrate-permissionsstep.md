# TASK-1784: Migrate PermissionsStep to SyncOrchestrator

**Backlog ID:** N/A (Sprint scope)
**Sprint:** SPRINT-068
**Phase:** 2b - Consumer Migration
**Branch:** `feature/dynamic-import-batch-size` (direct commit)
**Estimated Turns:** 2-3
**Estimated Tokens:** 10K-15K
**Dependencies:** TASK-1782, TASK-1783
**Execution:** SEQUENTIAL (NOT parallel with TASK-1783 - SR recommendation)

---

## Objective

Migrate PermissionsStep to use SyncOrchestratorService for initiating syncs during onboarding. This removes the inline sync logic and coordinates with the orchestrator.

---

## Context

Currently PermissionsStep:
- Has inline import logic for messages and contacts
- Tracks import progress locally
- Coordinates with SyncQueueService
- Sets `hasMessagesImportTriggered()` to prevent duplicate imports

After migration:
- PermissionsStep calls `syncOrchestrator.requestSync()`
- Progress is tracked by orchestrator
- Simpler component (~200 line reduction expected)

---

## Requirements

### Must Do:
1. Replace inline message/contact import with `syncOrchestrator.requestSync()` call
2. Remove local progress state tracking (orchestrator handles it)
3. Keep the "Setting up" loading state while import runs
4. Keep the `setMessagesImportTriggered()` coordination
5. Transition to next step after triggering sync (don't wait for completion)

### Must NOT Do:
- Do NOT change the permission grant flow (steps 1-5)
- Do NOT change when the component transitions to next step
- Do NOT remove useMacOSMessagesImport integration yet (TASK-1786)

---

## Acceptance Criteria

- [x] PermissionsStep uses `syncOrchestrator.requestSync()` for imports
- [x] Local progress state removed (messagesProgress, contactsProgress)
- [x] Permission grant flow unchanged (5 steps)
- [x] Component transitions to next step after triggering sync
- [x] `setMessagesImportTriggered()` still called to prevent duplicates
- [x] Type-check passes: `npm run type-check`
- [x] Tests pass: `npm test` (onboarding tests pass, pre-existing failures in unrelated suites)
- [ ] Manual test: Onboarding with FDA grant triggers syncs correctly

---

## Files to Modify

- `src/components/onboarding/steps/PermissionsStep.tsx` - Replace inline imports with orchestrator

## Files to Read (for context)

- `src/services/SyncOrchestratorService.ts` - Orchestrator API
- `src/hooks/useSyncOrchestrator.ts` - Hook for state (from TASK-1782)

---

## Implementation Notes

### Before (current)

```typescript
// Inside triggerImport
syncQueue.reset();
syncQueue.queue('contacts');
syncQueue.queue('messages');

// Start imports manually
setIsImportingMessages(true);
setIsImportingContacts(true);

syncQueue.start('messages');
const messagesPromise = window.api.messages.importMacOSMessages(userId)...

syncQueue.start('contacts');
const contactsPromise = (async () => { ... })();
```

### After (with orchestrator)

```typescript
// Inside triggerImport
setMessagesImportTriggered(); // Keep coordination flag

syncOrchestrator.requestSync({
  types: ['contacts', 'messages'],
  userId,
});

// Brief delay then transition (don't wait for completion)
setTimeout(() => {
  onAction({ type: "PERMISSION_GRANTED" });
}, 500);
```

### State Simplification

Remove:
- `isImportingMessages`, `isImportingContacts`
- `messagesProgress`, `contactsProgress`
- `messagesResult`, `contactsResult`

Keep:
- Permission flow state (`currentInstructionStep`, `completedSteps`)
- `waitingForDb` state
- `hasStartedImportRef`

---

## Testing Expectations

### Unit Tests
- **Required:** No (existing tests should pass)
- **New tests to write:** None
- **Existing tests to update:** None expected (component behavior unchanged)

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `refactor(onboarding): migrate PermissionsStep to SyncOrchestrator`
- **Branch:** `feature/dynamic-import-batch-size` (direct commit)
- **Target:** N/A (working on feature branch)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-02*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop (using existing feature branch)
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test) - onboarding tests pass, pre-existing failures in unrelated suites
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint) - pre-existing error in NotificationContext.tsx, not related to changes

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template) - N/A, direct commit to feature branch
- [ ] CI passes (gh pr checks --watch) - N/A, direct commit
- [x] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: PermissionsStep ~735 lines with inline import logic
- **After**: PermissionsStep ~629 lines using orchestrator (~106 lines removed)
- **Actual Turns**: 1
- **Actual Tokens**: ~8K (Est: 10K-15K)
- **Actual Time**: ~10 min
- **Commit**: 4b383a50 refactor(onboarding): migrate PermissionsStep to SyncOrchestrator

### Notes

**Deviations from plan:**
- Line reduction was ~106 instead of estimated ~200. The difference is because the orchestrator migration removes sync logic but keeps the same UI flow. The bulk of the component is UI for the 5-step permission flow which was unchanged.

**Issues encountered:**
- None. The migration followed the same pattern established in TASK-1783 (useAutoRefresh migration).

---

## Guardrails

**STOP and ask PM if:**
- The sync order matters (contacts before messages?)
- The component should wait for sync completion before transitioning
- waitingForDb logic needs to coordinate with orchestrator
