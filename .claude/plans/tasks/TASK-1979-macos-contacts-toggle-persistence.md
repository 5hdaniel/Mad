# TASK-1979: macOS iPhone contacts toggle persistence during sync

**Backlog ID:** BACKLOG-687
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1979-macos-contacts-toggle`
**Estimated Tokens:** ~20K (service x 0.5 + ipc x 1.5 blended)

---

## Objective

Ensure the macOS import source toggle (macOS native vs iPhone sync) is respected during sync operations. When a user selects "macOS Messages + Contacts" only, a sync should only import macOS contacts/messages -- not iPhone data. The toggle persists in user preferences but the sync operation may not be reading it.

---

## Context

- `src/components/settings/ImportSourceSettings.tsx` saves the import source preference (`macos-native` or `iphone-sync`) via `window.api.preferences.update()` to `messages.source`
- `src/services/settingsService.ts` defines the `ImportSource` type and `UserPreferences` interface
- The `SyncOrchestratorService` coordinates sync operations but may not be checking the `messages.source` preference before deciding which contacts/messages to import
- `src/components/settings/MacOSContactsImportSettings.tsx` handles contacts sync via orchestrator

The bug: even after selecting "macOS Messages + Contacts" (i.e., `macos-native`), clicking sync still imports iPhone contacts. The preference is saved but not consumed by the sync path.

---

## Requirements

### Must Do:
1. Trace the sync flow from orchestrator to the actual import handlers (main process)
2. Find where the import source preference should be checked but is not
3. Ensure the sync orchestrator (or the underlying handlers) reads `messages.source` from user preferences before deciding which import path to execute
4. When source is `macos-native`: only sync macOS Messages DB + macOS Contacts app
5. When source is `iphone-sync`: only sync iPhone backup data
6. Verify the preference persists across app restarts (already saved to DB, just verify read-back)

### Must NOT Do:
- Change the ImportSourceSettings UI component
- Modify the preference save/load mechanism (already working)
- Add new IPC channels unless absolutely necessary
- Change sync behavior on Windows (not affected)

---

## Acceptance Criteria

- [ ] Setting import source to `macos-native` and running sync only imports macOS data (no iPhone)
- [ ] Setting import source to `iphone-sync` and running sync only imports iPhone data (no macOS native)
- [ ] Preference persists across app restart
- [ ] Preference value is read from DB at sync time (not cached stale)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- Likely in `electron/` sync handlers or `src/services/SyncOrchestratorService.ts` - add preference check
- Possibly `electron/services/` import handlers - gate on source preference

## Files to Read (for context)

- `src/components/settings/ImportSourceSettings.tsx` - Understand how preference is saved
- `src/services/settingsService.ts` - `ImportSource` type definition
- `src/services/SyncOrchestratorService.ts` - Sync orchestration logic
- `src/components/settings/MacOSContactsImportSettings.tsx` - Contacts sync trigger
- `electron/services/` - Main process handlers for contacts/messages import

---

## Testing Expectations

### Unit Tests
- **Required:** If modifying SyncOrchestratorService, update relevant tests
- **Existing tests to update:** Check `src/components/settings/__tests__/ImportSourceSettings.test.tsx`

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(sync): respect macOS import source toggle during sync operations`
- **Branch:** `fix/task-1979-macos-contacts-toggle`
- **Branch From:** `sprint/082-ui-stabilization`
- **Target:** `sprint/082-ui-stabilization`

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

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 20K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## SR Engineer Review Notes

**Review Date:** 2026-02-13 | **Status:** APPROVED

### Branch Information (PM Updated for Sprint Branch)
- **Branch From:** `sprint/082-ui-stabilization`
- **Branch Into:** `sprint/082-ui-stabilization`
- **Branch Name:** `fix/task-1979-macos-contacts-toggle`

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `SyncOrchestratorService.ts`, `electron/services/*` (exact files TBD during investigation)
- Conflicts with: None -- sync layer is exclusive to this task
- Note: Reads `settingsService.ts` for preference type but does NOT modify it

### Technical Considerations
- Investigation-first approach is correct; exact files unknown until engineer traces sync flow
- Engineer should check whether the sync orchestrator runs in renderer or main process -- affects where the preference check goes
- If the fix requires reading preferences from the main process, may need to use existing IPC channels
- macOS-only behavior -- no Windows impact

---

## Guardrails

**STOP and ask PM if:**
- The sync orchestrator does not have access to user preferences at all (may need IPC changes)
- Multiple sync code paths exist and it is unclear which one to modify
- The iPhone import is triggered by a completely separate mechanism outside the orchestrator
- You encounter blockers not covered in the task file
