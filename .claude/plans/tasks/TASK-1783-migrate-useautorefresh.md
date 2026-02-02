# TASK-1783: Migrate useAutoRefresh to SyncOrchestrator

**Backlog ID:** N/A (Sprint scope)
**Sprint:** SPRINT-068
**Phase:** 2b - Consumer Migration
**Branch:** `feature/dynamic-import-batch-size` (direct commit)
**Estimated Turns:** 2-3
**Estimated Tokens:** 12K-18K
**Dependencies:** TASK-1782
**Blocks:** TASK-1784 (must complete before TASK-1784 can start - SR recommendation)

---

## Objective

Migrate useAutoRefresh to use SyncOrchestratorService instead of manually managing sync state and calling sync functions directly. This simplifies the hook to just trigger orchestrator requests.

---

## Context

Currently useAutoRefresh:
- Has inline sync functions (syncEmails, syncMessages, syncContacts)
- Manages local sync state (`localSyncState`)
- Manages progress state from IPC listeners
- Coordinates with SyncQueueService
- Handles the "has triggered" flag to prevent duplicate syncs

After migration:
- useAutoRefresh calls `syncOrchestrator.requestSync()`
- Uses `useSyncOrchestrator()` hook for state
- Orchestrator handles sequencing and state management
- Much simpler hook (~50% code reduction expected)

---

## Requirements

### Must Do:
1. Replace inline sync functions with `syncOrchestrator.requestSync()` call
2. Replace localSyncState with `useSyncOrchestrator()` hook
3. Remove IPC progress listeners (orchestrator handles these now)
4. Keep the module-level `hasTriggeredAutoRefresh` flag for duplicate prevention
5. Keep OS notification logic (fires when all syncs complete)
6. Keep auto-sync preference loading from preferences API

### Must NOT Do:
- Do NOT remove useMacOSMessagesImport yet (that's TASK-1786)
- Do NOT change the public API of useAutoRefresh (triggerRefresh, syncStatus, isAnySyncing)
- Do NOT change when auto-refresh triggers (dashboard entry, preference enabled, etc.)

---

## Acceptance Criteria

- [ ] useAutoRefresh uses `syncOrchestrator.requestSync()` instead of inline sync functions
- [ ] useAutoRefresh uses `useSyncOrchestrator()` for state instead of local state
- [ ] IPC progress listeners removed from useAutoRefresh (orchestrator handles them)
- [ ] Public API unchanged: `triggerRefresh`, `syncStatus`, `isAnySyncing`, `currentSyncMessage`
- [ ] OS notification still fires when all syncs complete
- [ ] Auto-sync preference still respected
- [ ] Type-check passes: `npm run type-check`
- [ ] Tests pass: `npm test`
- [ ] Manual test: Dashboard auto-refresh works with pill updates

---

## Files to Modify

- `src/hooks/useAutoRefresh.ts` - Replace sync logic with orchestrator calls

## Files to Read (for context)

- `src/services/SyncOrchestratorService.ts` - Orchestrator API
- `src/hooks/useSyncOrchestrator.ts` - Hook for state (from TASK-1782)

---

## Implementation Notes

### Before (current)

```typescript
const syncEmails = useCallback(async (uid: string): Promise<void> => {
  syncQueue.start('emails');
  setLocalSyncState((prev) => ({ ... }));
  try {
    const result = await window.api.transactions.scan(uid);
    // ... handle result
  } catch { ... }
}, []);
```

### After (with orchestrator)

```typescript
const triggerRefresh = useCallback(async () => {
  if (!userId) return;

  const typesToSync: SyncType[] = [];
  if (isMacOS && hasPermissions) typesToSync.push('contacts');
  if (hasAIAddon && hasEmailConnected) typesToSync.push('emails');
  if (isMacOS && hasPermissions) typesToSync.push('messages');

  syncOrchestrator.requestSync({ types: typesToSync, userId });
}, [userId, isMacOS, hasPermissions, hasAIAddon, hasEmailConnected]);
```

### State Mapping

The `syncStatus` return value should be derived from orchestrator state:

```typescript
const orchestratorState = useSyncOrchestrator();

const syncStatus: SyncStatus = {
  emails: {
    isSyncing: orchestratorState.queue.find(q => q.type === 'emails')?.status === 'running',
    progress: orchestratorState.queue.find(q => q.type === 'emails')?.progress ?? null,
    // ...
  },
  // ... similar for contacts, messages
};
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** None (existing tests should still pass)
- **Existing tests to update:** `useAutoRefresh.test.ts` - mock orchestrator instead of sync functions

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `refactor(sync): migrate useAutoRefresh to SyncOrchestrator`
- **Branch:** `feature/dynamic-import-batch-size` (direct commit)
- **Target:** N/A (working on feature branch)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: useAutoRefresh has ~460 lines with inline sync functions
- **After**: useAutoRefresh uses orchestrator, expected ~200 lines
- **Actual Turns**: X (Est: 2-3)
- **Actual Tokens**: ~XK (Est: 12K-18K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The orchestrator state shape doesn't match what useAutoRefresh needs
- OS notification logic is more complex than expected to integrate
- hasMessagesImportTriggered() coordination is unclear
