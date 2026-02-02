# TASK-1786: Deprecate/Remove useMacOSMessagesImport and SyncQueueService

**Backlog ID:** N/A (Sprint scope)
**Sprint:** SPRINT-068
**Phase:** 2d - Cleanup
**Branch:** `feature/dynamic-import-batch-size` (direct commit)
**Estimated Turns:** 2
**Estimated Tokens:** 6K-10K
**Dependencies:** TASK-1785

---

## Objective

Remove the now-obsolete useMacOSMessagesImport hook and SyncQueueService, as all sync functionality is now handled by SyncOrchestratorService.

---

## Context

After TASK-1782, TASK-1783, TASK-1784, and TASK-1785:
- SyncOrchestratorService handles all sync orchestration
- useAutoRefresh uses SyncOrchestrator
- PermissionsStep uses SyncOrchestrator
- SyncStatusIndicator uses SyncOrchestrator

No longer needed:
- `useMacOSMessagesImport.ts` - Its functionality is absorbed into SyncOrchestrator
- `SyncQueueService.ts` - Replaced by SyncOrchestrator
- `useSyncQueue.ts` - Hook for SyncQueueService

---

## Requirements

### Must Do:
1. Delete `src/hooks/useMacOSMessagesImport.ts`
2. Delete `src/services/SyncQueueService.ts`
3. Delete `src/hooks/useSyncQueue.ts` (if exists)
4. Remove all imports of deleted files
5. Move the `hasMessagesImportTriggered` / `setMessagesImportTriggered` functions to SyncOrchestratorService or a shared utility
6. Update any remaining references

### Must NOT Do:
- Do NOT delete SyncOrchestratorService
- Do NOT delete useSyncOrchestrator hook

---

## Acceptance Criteria

- [ ] `useMacOSMessagesImport.ts` deleted
- [ ] `SyncQueueService.ts` deleted
- [ ] `useSyncQueue.ts` deleted (if exists)
- [ ] No remaining imports of deleted files
- [ ] `hasMessagesImportTriggered` / `setMessagesImportTriggered` moved to appropriate location
- [ ] Type-check passes: `npm run type-check`
- [ ] Tests pass: `npm test`
- [ ] App builds: `npm run build`
- [ ] Manual verification: App starts and sync works

---

## Files to Delete

- `src/hooks/useMacOSMessagesImport.ts`
- `src/services/SyncQueueService.ts`
- `src/hooks/useSyncQueue.ts` (if exists)
- Related test files (if any)

## Files to Modify

- `src/hooks/useAutoRefresh.ts` - Remove useMacOSMessagesImport import, move flag functions
- `src/components/onboarding/steps/PermissionsStep.tsx` - Remove useMacOSMessagesImport import
- Any other files importing deleted modules

## Files to Read (for context)

- `src/hooks/useMacOSMessagesImport.ts` - Understand what needs to be preserved
- `src/services/SyncQueueService.ts` - Confirm no unique functionality remains

---

## Implementation Notes

### Flag Functions Migration

The `hasMessagesImportTriggered()` and `setMessagesImportTriggered()` functions are used to coordinate between PermissionsStep and useAutoRefresh to prevent duplicate imports.

**Option A:** Move to SyncOrchestratorService
```typescript
// In SyncOrchestratorService
private hasTriggeredImport = false;

hasImportTriggered(): boolean {
  return this.hasTriggeredImport;
}

setImportTriggered(): void {
  this.hasTriggeredImport = true;
}

resetImportTrigger(): void {
  this.hasTriggeredImport = false;
}
```

**Option B:** Keep in a separate utility
```typescript
// src/utils/syncFlags.ts
let hasTriggeredImport = false;
export const hasMessagesImportTriggered = () => hasTriggeredImport;
export const setMessagesImportTriggered = () => { hasTriggeredImport = true; };
export const resetMessagesImportTrigger = () => { hasTriggeredImport = false; };
```

### Finding References

```bash
# Find all imports
grep -r "useMacOSMessagesImport" src/
grep -r "SyncQueueService" src/
grep -r "useSyncQueue" src/
grep -r "syncQueue" src/
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes (delete related tests)
- **New tests to write:** None
- **Existing tests to update:** Remove/update tests for deleted modules

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `refactor(sync): remove obsolete SyncQueueService and useMacOSMessagesImport`
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

- **Before**: 3 redundant sync-related modules
- **After**: Single SyncOrchestratorService
- **Lines removed**: ~X (Est: 300-400)
- **Actual Turns**: X (Est: 2)
- **Actual Tokens**: ~XK (Est: 6K-10K)
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
- Any unique functionality found in SyncQueueService that needs preserving
- Tests reference deleted modules in ways that require significant refactoring
- Flag functions migration option needs clarification
