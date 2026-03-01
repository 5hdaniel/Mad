# TASK-2092: Fix Contacts Sync to Call syncExternal Instead of getAll

**Backlog ID:** BACKLOG-823
**Sprint:** SPRINT-105
**Phase:** Phase 1 (only phase)
**Branch:** `fix/task-2092-sync-contacts-import`
**Estimated Turns:** 2-4
**Estimated Tokens:** ~10K

---

## Objective

Fix the SyncOrchestratorService contacts sync (Phase 1) to actually import macOS Contacts from Contacts.app by calling `syncExternal` instead of `getAll`. Currently the sync only reads already-imported contacts from the local DB, which means new contacts added in macOS Contacts.app are never picked up during periodic sync.

---

## Context

The SyncOrchestratorService has a contacts sync function registered at line ~115 of `src/services/SyncOrchestratorService.ts`. Phase 1 of this function is supposed to sync macOS Contacts, but it calls `window.api.contacts.getAll(userId)` which maps to the `contacts:get-all` IPC handler -- a read-only DB query.

The correct API to call is `window.api.contacts.syncExternal(userId)` which:
1. Reads contacts from macOS Contacts.app via the native bridge
2. Populates/updates the `external_contacts` shadow table in SQLite
3. Returns `{ success, inserted, deleted, total, error }`

This API is already exposed in:
- Preload bridge: `electron/preload/contactBridge.ts:136`
- Type definition: `src/window.d.ts:1061`
- Already used by: `src/components/settings/MacOSContactsImportSettings.tsx:237`

The `onImportProgress` listener set up before the `getAll` call can be removed because `syncExternal` does not emit progress events.

---

## Requirements

### Must Do:
1. In `src/services/SyncOrchestratorService.ts`, replace the Phase 1 contacts sync code:
   - Remove the `onImportProgress` listener setup (lines ~127-132)
   - Change `window.api.contacts.getAll(userId)` to `window.api.contacts.syncExternal(userId)` (line ~135)
   - Update the error message from `'Contacts sync failed'` to `'macOS Contacts sync failed'`
   - Remove the `cleanup()` call in the `finally` block (no longer needed)
   - Keep the `try/catch` structure -- just simplify it

2. In `src/services/__tests__/SyncOrchestratorService.test.ts`, update the mock:
   - Change `contacts: { getAll: jest.fn(), syncOutlookContacts: jest.fn() }` to `contacts: { syncExternal: jest.fn(), syncOutlookContacts: jest.fn() }` (line ~45)
   - Update any test assertions that reference `getAll` to reference `syncExternal`

### Must NOT Do:
- Do not modify any other sync phases (Outlook contacts Phase 2 is correct as-is)
- Do not add progress reporting to `syncExternal` -- that is a separate backlog item if needed
- Do not modify the preload bridge or IPC handlers -- they are correct
- Do not modify any electron/ files -- this is a renderer-side fix only
- Do not change the overall sync flow or add new sync phases

---

## Acceptance Criteria

- [ ] `SyncOrchestratorService.ts` Phase 1 calls `window.api.contacts.syncExternal(userId)` instead of `window.api.contacts.getAll(userId)`
- [ ] The `onImportProgress` listener setup and `cleanup()` call are removed from Phase 1
- [ ] The error message reads `'macOS Contacts sync failed'`
- [ ] Test file mock uses `syncExternal` instead of `getAll`
- [ ] `npm test` passes (all existing tests green)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Files to Modify

- `src/services/SyncOrchestratorService.ts` -- Change Phase 1 to call `syncExternal` instead of `getAll`, remove `onImportProgress` listener
- `src/services/__tests__/SyncOrchestratorService.test.ts` -- Update mock from `getAll` to `syncExternal`

## Files to Read (for context)

- `electron/preload/contactBridge.ts` -- Confirms `syncExternal` signature (line 136)
- `src/window.d.ts` -- Confirms `syncExternal` type definition (line 1061)
- `src/components/settings/MacOSContactsImportSettings.tsx` -- Example of existing `syncExternal` usage (line 237)

---

## Specific Code Changes

### File 1: `src/services/SyncOrchestratorService.ts`

**Current code (lines ~124-142):**
```typescript
      if (macOS && importSource !== 'iphone-sync') {
        // IPC listener OWNED here - not in consumers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contactsApi = window.api.contacts as any;
        const cleanup = contactsApi?.onImportProgress
          ? contactsApi.onImportProgress((data: { percent: number }) => {
              onProgress(Math.round(data.percent * 0.5)); // 0-50% for macOS contacts
            })
          : () => {};

        try {
          const result = await window.api.contacts.getAll(userId);
          if (!result.success) {
            throw new Error(result.error || 'Contacts sync failed');
          }
          logger.info('[SyncOrchestrator] macOS Contacts sync complete');
        } finally {
          cleanup();
        }
```

**New code:**
```typescript
      if (macOS && importSource !== 'iphone-sync') {
        try {
          const result = await window.api.contacts.syncExternal(userId);
          if (!result.success) {
            throw new Error(result.error || 'macOS Contacts sync failed');
          }
          logger.info('[SyncOrchestrator] macOS Contacts sync complete');
        } catch (err) {
          throw err;
        }
```

Note: The `catch (err) { throw err; }` preserves the existing error propagation pattern. The original code used `finally { cleanup() }` for the progress listener. Since we removed the listener, a plain try/catch suffices. If the engineer prefers, they can simplify to just the try block without the catch rethrow -- either is acceptable as long as the error still propagates.

### File 2: `src/services/__tests__/SyncOrchestratorService.test.ts`

**Current mock (line ~45):**
```typescript
      contacts: { getAll: jest.fn(), syncOutlookContacts: jest.fn() },
```

**New mock:**
```typescript
      contacts: { syncExternal: jest.fn(), syncOutlookContacts: jest.fn() },
```

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests
- **Existing tests to update:** `SyncOrchestratorService.test.ts` mock change only
- **Verification:** Run `npm test -- --testPathPattern=SyncOrchestratorService` to confirm

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(sync): call syncExternal instead of getAll for macOS Contacts import`
- **Branch:** `fix/task-2092-sync-contacts-import`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-27*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test) - 9/9 passed
- [x] Type check passes (npm run type-check) - clean
- [x] Lint passes (npm run lint) - clean

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

- **Before**: Sync calls `getAll` which only reads DB, never imports from macOS Contacts.app
- **After**: Sync calls `syncExternal` which reads macOS Contacts.app and populates the shadow table
- **Actual Turns**: 2 (Est: 2-4)
- **Actual Tokens**: ~8K (Est: ~10K)
- **Actual Time**: ~3 min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
Per SR Engineer review notes, omitted the `catch (err) { throw err; }` block entirely (task file suggested keeping it). The SR notes correctly identified this as unnecessary since there is no cleanup logic. Errors propagate naturally without the try/catch wrapper.

**Issues/Blockers:** None

---

## Guardrails

**STOP and ask PM if:**
- The `syncExternal` API signature has changed from what is documented here
- Any test beyond `SyncOrchestratorService.test.ts` references `contacts.getAll` in a sync context
- Type checking reveals `syncExternal` is not available on the `contacts` API type
- You encounter blockers not covered in the task file
