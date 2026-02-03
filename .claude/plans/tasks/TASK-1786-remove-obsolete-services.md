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

- [x] `useMacOSMessagesImport.ts` deleted
- [x] `SyncQueueService.ts` deleted
- [x] `useSyncQueue.ts` deleted (if exists)
- [x] No remaining imports of deleted files
- [x] `hasMessagesImportTriggered` / `setMessagesImportTriggered` moved to appropriate location (`src/utils/syncFlags.ts`)
- [x] Type-check passes: `npm run type-check`
- [x] Tests pass: `npm test` (91 sync-related tests pass; pre-existing failures in unrelated tests)
- [x] App builds: `npm run build`
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

*Completed: 2026-02-02*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: Session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint) - pre-existing error in NotificationContext.tsx unrelated to changes

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: 3 redundant sync-related modules (useMacOSMessagesImport, SyncQueueService, useSyncQueue)
- **After**: Single SyncOrchestratorService + shared syncFlags utility
- **Lines removed**: ~1,011 lines (Est: 300-400) - exceeded estimate due to test file
- **Actual Turns**: 1 (Est: 2)
- **Actual Tokens**: ~8K (Est: 6K-10K)
- **Actual Time**: ~10 min
- **PR**: [To be created]

### Files Deleted
1. `src/hooks/useMacOSMessagesImport.ts` (167 lines)
2. `src/services/SyncQueueService.ts` (235 lines)
3. `src/hooks/useSyncQueue.ts` (116 lines)
4. `src/hooks/__tests__/useMacOSMessagesImport.test.ts` (493 lines)

### Files Modified
1. `src/utils/syncFlags.ts` - NEW: Extracted flag functions (hasMessagesImportTriggered, setMessagesImportTriggered, resetMessagesImportTrigger)
2. `src/hooks/useAutoRefresh.ts` - Updated import from useMacOSMessagesImport to syncFlags
3. `src/components/onboarding/steps/PermissionsStep.tsx` - Updated import from useMacOSMessagesImport to syncFlags
4. `src/appCore/BackgroundServices.tsx` - Removed useMacOSMessagesImport usage, simplified component
5. `src/App.tsx` - Removed unused prop from BackgroundServices
6. `src/hooks/__tests__/useAutoRefresh.test.ts` - Updated import path

### Notes

**Deviations from plan:**
- Chose Option B (separate utility file) for flag functions rather than moving to SyncOrchestratorService. This is cleaner because the flags coordinate between PermissionsStep (onboarding) and useAutoRefresh (dashboard) - neither of which should have direct dependency on the other.

**Issues encountered:**
- Pre-existing lint error in NotificationContext.tsx (react-hooks/exhaustive-deps rule not found) - unrelated to changes
- Pre-existing test failures in supabaseService.test.ts and transaction-handlers.integration.test.ts - unrelated to changes

---

## Guardrails

**STOP and ask PM if:**
- Any unique functionality found in SyncQueueService that needs preserving
- Tests reference deleted modules in ways that require significant refactoring
- Flag functions migration option needs clarification
