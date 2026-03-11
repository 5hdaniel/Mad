# Task TASK-2150: Route Bypass Operations Through SyncOrchestrator

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
**Phase:** A (Orchestrator Unification)
**Backlog:** BACKLOG-801

## Branch Information

**Branch From:** `int/sprint-121-sync-unification`
**Branch Into:** `int/sprint-121-sync-unification`
**Branch Name:** `feature/task-2150-sync-orchestrator-unification`

## Goal

Route all sync/import operations that currently bypass the SyncOrchestrator through it, so that every long-running operation is visible in the dashboard sync indicator with unified progress tracking.

## Non-Goals

- Do NOT route transaction submission sync (`useSubmissionSync`) through the orchestrator -- it is per-transaction, not global
- Do NOT route transaction scan from transaction view (`useTransactionScan`) -- same reason
- Do NOT implement cancel/abort support for new operation types (that is TASK-2151)
- Do NOT build a notification preferences UI
- Do NOT change the iPhone sync flow (already uses external sync registration)
- Do NOT implement key contacts sync composition (deferred)
- Do NOT add offline gating (separate concern, BACKLOG-799)
- Do NOT modify any electron/ files -- the orchestrator is a renderer-side concern

## Current State

The SyncOrchestratorService (`src/services/SyncOrchestratorService.ts`, 671 lines) already handles:
- contacts sync (macOS + Outlook) via `registerSyncFunction('contacts', ...)`
- emails sync (transaction scan) via `registerSyncFunction('emails', ...)`
- messages sync (macOS iMessage) via `registerSyncFunction('messages', ...)`
- iPhone sync (external tracking only) via `registerExternalSync('iphone')`

These operations **bypass** the orchestrator (no dashboard indicator):

| # | Operation | Current Call Site | IPC Channel |
|---|-----------|------------------|-------------|
| 1 | Settings Messages Import | `MacOSMessagesImportSettings.tsx:231` | `window.api.messages.importMacOSMessages()` |
| 2 | Force Re-import Contacts | `MacOSContactsImportSettings.tsx:248` | `window.api.contacts.forceReimport()` |
| 3 | Database Reindex | `Settings.tsx:833` | `window.api.system.reindexDatabase()` |
| 4 | Database Backup | `Settings.tsx:861` | `window.api.databaseBackup.backup()` |
| 5 | Database Restore | `Settings.tsx:899` | `window.api.databaseBackup.restore()` |
| 6 | CCPA Data Export | `Settings.tsx:789` | `window.api.privacy.exportData()` |

## Deliverables

### Files to modify (owned by this task):

| File | Change |
|------|--------|
| `src/services/SyncOrchestratorService.ts` | Extend `SyncType` union; add `options` to `SyncRequest`; register new sync functions for maintenance operations |
| `src/components/settings/MacOSMessagesImportSettings.tsx` | Route import through orchestrator instead of direct IPC |
| `src/components/settings/MacOSContactsImportSettings.tsx` | Route force re-import through orchestrator instead of direct IPC |
| `src/components/Settings.tsx` | Route reindex, backup, restore, CCPA export through orchestrator |

### Files this task must NOT modify:

- `electron/` -- No changes to electron handlers or services
- `electron/handlers/diagnosticHandlers.ts` -- IPC handlers stay as-is
- `electron/handlers/backupRestoreHandlers.ts` -- IPC handlers stay as-is
- `electron/handlers/ccpaHandlers.ts` -- IPC handlers stay as-is
- `electron/services/deviceSyncOrchestrator.ts` -- iPhone sync stays as-is (TASK-2151)

## Acceptance Criteria

- [ ] `SyncType` is extended to: `'contacts' | 'emails' | 'messages' | 'iphone' | 'reindex' | 'backup' | 'restore' | 'ccpa-export'`
- [ ] `SyncRequest` interface includes optional `options` field for passing `forceReimport`, `overrideCap`, etc.
- [ ] Settings Messages Import button triggers through `syncOrchestrator.requestSync()` or `forceSync()` instead of direct IPC
- [ ] Settings Force Re-import contacts triggers through orchestrator instead of direct IPC
- [ ] Database reindex, backup, restore, and CCPA export are registered as orchestrator operations (either internal sync functions or external sync tracking)
- [ ] All operations show in the dashboard sync indicator while running (queue item visible with status)
- [ ] Existing sync flow (contacts, emails, messages from dashboard) continues to work unchanged
- [ ] iPhone external sync registration continues to work unchanged
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (existing tests + any new/updated tests)
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### Architecture: Two Routing Patterns

The orchestrator supports two patterns. Choose the appropriate one per operation:

**Pattern 1: Internal sync function** -- for operations that are simple async calls

Register via `registerSyncFunction(type, fn)`, called via `requestSync()`. The orchestrator handles queue management, status tracking, and sequential execution. Best for: messages import, contacts force-reimport, reindex.

**Pattern 2: External sync tracking** -- for operations with complex UI interaction (dialogs)

Register via `registerExternalSync(type)`, update with `updateExternalSync()`, complete with `completeExternalSync()`. The operation is managed externally; the orchestrator just tracks it for unified display. Best for: backup (save dialog), restore (open dialog + confirm dialog), CCPA export (save dialog).

### Operation-by-Operation Guidance

#### 1. Settings Messages Import

The orchestrator already has a `messages` sync function registered (SyncOrchestratorService.ts line 229). However, Settings import needs `forceReimport` support. Two options:

**Option A (Recommended): Extend SyncRequest with options**

```typescript
export interface SyncRequest {
  types: SyncType[];
  userId: string;
  options?: {
    forceReimport?: boolean;
    overrideCap?: boolean;
  };
}
```

Update the `messages` sync function to read these options:
```typescript
this.registerSyncFunction('messages', async (userId, onProgress, _signal, options) => {
  // ... existing messages sync logic ...
  const result = await window.api.messages.importMacOSMessages(userId, options?.forceReimport);
});
```

Then `MacOSMessagesImportSettings` calls:
```typescript
syncOrchestrator.requestSync({
  types: ['messages'],
  userId,
  options: { forceReimport: true },
});
```

**Option B: Separate SyncType for force-reimport**

Add `'force-reimport-messages'` to SyncType. Simpler but proliferates types.

Choose Option A unless it creates too much complexity.

The component should subscribe to orchestrator state for progress instead of managing its own `isImporting` state, or keep local state alongside for UI fallback.

#### 2. Force Re-import Contacts

Currently `MacOSContactsImportSettings.tsx` line 248:
```typescript
const wipeResult = await window.api.contacts.forceReimport(userId);
// then calls handleImportAll()
```

Use the same SyncRequest options pattern:
```typescript
syncOrchestrator.requestSync({
  types: ['contacts'],
  userId,
  options: { forceReimport: true },
});
```

Update the contacts sync function to handle `forceReimport`: call `window.api.contacts.forceReimport(userId)` first, then proceed with normal sync.

#### 3. Database Reindex

Register as internal sync function:
```typescript
this.registerSyncFunction('reindex', async (_userId, onProgress) => {
  onProgress(0, 'reindexing');
  const result = await window.api.system.reindexDatabase();
  if (!result.success) {
    throw new Error(result.error || 'Database reindex failed');
  }
  onProgress(100);
});
```

`Settings.tsx` calls:
```typescript
syncOrchestrator.requestSync({ types: ['reindex'], userId });
```

Note: reindex does not take a userId. The sync function receives one but can ignore it. Alternatively, pass an empty string. Keep it pragmatic.

#### 4. Database Backup / 5. Database Restore

These use Electron dialog boxes (main process save/open dialogs). The dialog interaction is blocking from the renderer's perspective -- the `await` resolves after the dialog + operation complete. Two approaches:

**Approach A (Simpler): Internal sync function wrapping the await**

```typescript
this.registerSyncFunction('backup', async (_userId, onProgress) => {
  onProgress(0, 'backing up');
  const result = await window.api.databaseBackup.backup();
  if (!result.success && !result.cancelled) {
    throw new Error(result.error || 'Backup failed');
  }
  if (result.cancelled) {
    // User cancelled the dialog -- not an error
    return;
  }
  onProgress(100);
});
```

**Approach B (If dialog blocks state updates): External sync pattern**

```typescript
// In Settings component:
syncOrchestrator.registerExternalSync('backup');
try {
  const result = await window.api.databaseBackup.backup();
  syncOrchestrator.completeExternalSync('backup', {
    status: result.success ? 'complete' : 'error',
    error: result.error,
  });
} catch (err) {
  syncOrchestrator.completeExternalSync('backup', { status: 'error', error: String(err) });
}
```

Try Approach A first. If dialog blocking causes UX issues (sync indicator frozen), switch to Approach B.

#### 6. CCPA Data Export

The CCPA handler sends progress via `event.sender.send('privacy:export-progress', ...)`. This uses a save dialog (same as backup). If the progress IPC listener exists in `window.d.ts`, wire it to the orchestrator. If not, just show 0% -> 100%.

Use the same approach as backup: internal sync function or external sync pattern depending on dialog behavior.

### Extending SyncType

```typescript
// Before:
export type SyncType = 'contacts' | 'emails' | 'messages' | 'iphone';

// After:
export type SyncType = 'contacts' | 'emails' | 'messages' | 'iphone'
  | 'reindex' | 'backup' | 'restore' | 'ccpa-export';
```

**Important:** Search for exhaustive switch/if-else on SyncType and add cases for new types:
```bash
grep -rn "SyncType\|case 'contacts'\|=== 'contacts'" --include="*.ts" --include="*.tsx" src/
```

### Key Constraint: requestSync Queuing

`requestSync()` blocks if an internal sync is already running (returns `needsConfirmation: true`). This means if a dashboard sync is running and the user clicks "Reindex" in Settings, it will queue.

**Handling options:**
- For maintenance operations, use `forceSync()` which cancels current sync -- but that would cancel a data sync, which is worse
- Better: let it queue. The Settings UI should show "Waiting for sync to complete..." or similar
- Or: maintenance operations (reindex/backup/restore) could bypass the queue check since they don't conflict with data syncs. If implementing this, add a `bypassQueue` flag to SyncRequest

Keep it simple for v1: let maintenance operations queue. Document any UX friction for follow-up.

## Integration Notes

- **Depends on:** Nothing (first task in SPRINT-121)
- **Blocks:** TASK-2151 (AbortController support) -- must merge before TASK-2151 starts
- **Shared file with TASK-2151:** `src/services/SyncOrchestratorService.ts` -- TASK-2151 will modify `SyncFunction` signature and `cancel()`

## Do / Don't

### Do:

- Register new sync types using the existing `registerSyncFunction()` API
- Keep the orchestrator as the single source of truth for sync state
- Use the existing observer pattern (`subscribe()`) for UI updates
- Keep IPC handlers in electron unchanged -- the orchestrator wraps them from the renderer side
- Add proper error handling (throw on failure so orchestrator marks status as 'error')
- Handle dialog-cancelled results gracefully (not an error, just a no-op)
- Be pragmatic about Settings component state -- keep local state as needed for the UI

### Don't:

- Do NOT create new IPC channels -- reuse existing ones
- Do NOT modify electron handlers -- the orchestrator is a renderer-side concern
- Do NOT add cancel/abort support for new operations (TASK-2151 scope)
- Do NOT break the existing contacts/emails/messages sync flow
- Do NOT over-engineer the SyncRequest options -- keep it simple
- Do NOT try to unify progress for operations that don't report progress (reindex returns only after completion)

## When to Stop and Ask

- If `requestSync()` queueing behavior creates a bad UX for Settings operations (e.g., user cannot reindex while sync is running)
- If extending SyncType causes widespread exhaustiveness errors (>5 files need switch updates)
- If the CCPA export progress IPC bridge does not exist in `window.d.ts` and would require new electron handler changes
- If backup/restore dialog interaction blocks the renderer and prevents orchestrator state updates
- If existing tests fail due to SyncType changes and the fix is non-trivial (>30 min)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing SyncOrchestratorService tests to cover new SyncType values
- Verify `registerSyncFunction` works for new types
- Verify new sync functions throw on failure (orchestrator marks as error)
- Verify SyncRequest options pass through to sync functions

### Integration / Feature Tests

- Required scenarios:
  - Trigger messages import from Settings, verify orchestrator queue shows `messages` with running status
  - Trigger force re-import contacts, verify orchestrator queue shows `contacts`
  - Trigger reindex from Settings, verify orchestrator queue shows `reindex`
  - Trigger backup from Settings, verify orchestrator tracks the operation
  - Trigger CCPA export, verify orchestrator tracks the operation
  - Run normal dashboard sync, verify it still works unchanged
  - Run iPhone sync, verify external registration still works

### CI Requirements

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Build succeeds

## PR Preparation

- **Title**: `refactor(sync): route bypass operations through SyncOrchestrator`
- **Base**: `int/sprint-121-sync-unification`
- **Labels**: `refactor`, `sync`
- **Depends on**: Nothing

---

## Implementation Plan

*Created: 2026-03-10 | Phase B (Planning)*

### 1. Exploration Summary

**Files explored:**

| File | Lines | Key Observations |
|------|-------|------------------|
| `src/services/SyncOrchestratorService.ts` | 671 | Core orchestrator. SyncType union at line 22. SyncRequest at line 47. SyncFunction type at line 53 (no `options` parameter yet). Two patterns: internal (`registerSyncFunction`) and external (`registerExternalSync`). Auto-initializes on import (line 666). |
| `src/components/settings/MacOSMessagesImportSettings.tsx` | 561 | Direct `window.api.messages.importMacOSMessages()` at line 231. Manages own `isImporting` state. Has complex cap/force-reimport UX with confirmation prompts. Subscribes to `onImportProgress` at line 189 (separate from orchestrator). |
| `src/components/settings/MacOSContactsImportSettings.tsx` | 654 | Named `ContactsImportSettings` internally. Already uses `useSyncOrchestrator` for normal contacts sync (line 59). Force re-import at line 248 calls `window.api.contacts.forceReimport(userId)` directly, then `handleImportAll()`. |
| `src/components/Settings.tsx` | ~1825 | Reindex (line 821-853), Backup (line 857-891), Restore (line 895-937), CCPA export (line 774-818). All manage their own local state. CCPA has `onExportProgress` IPC listener (line 781). Backup/Restore handle `result.cancelled` for dialog cancellation. |
| `src/components/dashboard/SyncStatusIndicator.tsx` | 489 | `getLabelForType()` switch at lines 48-61 maps SyncType to display labels. Has `default: return type` fallback (line 59) -- new types will render as raw string unless added to switch. |
| `src/hooks/useSyncOrchestrator.ts` | 98 | Thin React hook over singleton. `requestSync` wraps `{ types, userId }` (no options yet). |
| `src/hooks/useAutoRefresh.ts` | 357 | Builds `SyncStatus` mapping at lines 344-347 using `queue.find(q => q.type === ...)` for emails/messages/contacts only. New types won't affect this (it only maps known types). |
| `src/services/__tests__/SyncOrchestratorService.test.ts` | 613 | Tests isRunning transitions, queuing, external sync API, contact source preferences. No exhaustive SyncType assertions. |
| `src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx` | 847 | Tests pill rendering, completion, tour, iPhone queue items. `createSyncItem` helper uses `SyncType`. |

### 2. Exhaustive Switch/Type Analysis

**Files that reference SyncType or have type-specific logic:**

| File | Line(s) | Pattern | Impact |
|------|---------|---------|--------|
| `src/services/SyncOrchestratorService.ts` | 22 | `SyncType` union definition | **MUST** extend |
| `src/services/SyncOrchestratorService.ts` | 53 | `SyncFunction` type signature | **MUST** extend to accept `options` |
| `src/services/SyncOrchestratorService.ts` | 47-50 | `SyncRequest` interface | **MUST** add `options` field |
| `src/components/dashboard/SyncStatusIndicator.tsx` | 48-61 | `getLabelForType()` switch | **MUST** add cases for new types |
| `src/hooks/useSyncOrchestrator.ts` | 60-66 | `requestSync`/`forceSync` wrappers | **MUST** extend to pass options through |
| `src/hooks/useAutoRefresh.ts` | 216, 344-346 | `typesToSync` array, `SyncStatus` mapping | **No change needed** -- only pushes known data types, mapping ignores unknown types |
| `src/components/Dashboard.tsx` | 230 | `type === 'iphone'` check | **No change needed** -- only handles iphone special case |
| `src/services/__tests__/SyncOrchestratorService.test.ts` | 14, 61, 77 | `SyncType` import, state history | **MUST** add tests for new types |
| `src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx` | 18, 34 | `SyncType` import, helper | **No change needed** -- tests use specific types, not exhaustive |
| `src/components/onboarding/types/config.ts` | 130 | Comment only (mentions 'iphone') | **No change needed** |

**Total files needing changes for SyncType extension: 5** (SyncOrchestratorService, SyncStatusIndicator, useSyncOrchestrator, and test file + task file)

### 3. Architecture Decisions

#### 3a. SyncRequest Options

Extend `SyncRequest` with an `options` field (Option A from task file):

```typescript
export interface SyncRequest {
  types: SyncType[];
  userId: string;
  options?: {
    forceReimport?: boolean;
    overrideCap?: boolean;
  };
}
```

The `options` pass through `startSync()` to each `SyncFunction`. Extend `SyncFunction` signature:

```typescript
type SyncFunction = (
  userId: string,
  onProgress: (percent: number, phase?: string) => void,
  signal: AbortSignal,
  options?: SyncRequest['options']
) => Promise<string | void>;
```

**Rationale:** The existing `SyncFunction` has only 2 params (`userId`, `onProgress`). We add `signal` (needed for TASK-2151 but harmless to add now -- pass `abortController.signal`) and `options`. The `signal` parameter prepares for TASK-2151 without breaking anything.

**Actually, wait:** The task says "Do NOT implement cancel/abort support for new operation types (that is TASK-2151)." Adding `signal` to the type now would be a scope creep. Let me keep it simple: add only `options`.

```typescript
type SyncFunction = (
  userId: string,
  onProgress: (percent: number, phase?: string) => void,
  options?: SyncRequest['options']
) => Promise<string | void>;
```

The `startSync()` method already passes `userId` and `onProgress` to each sync function (line 587). We add `request.options` as the third argument.

#### 3b. Routing Decisions Per Operation

| # | Operation | Pattern | Rationale |
|---|-----------|---------|-----------|
| 1 | Messages Import (Settings) | **Internal sync function** (reuse existing 'messages' registration) | Already registered as sync function. Settings calls `requestSync({ types: ['messages'], userId, options: { forceReimport: true } })`. The existing messages sync function needs to be updated to accept and use `options.forceReimport`. |
| 2 | Force Re-import Contacts | **Internal sync function** (reuse existing 'contacts' registration) | Already registered. Settings calls `requestSync({ types: ['contacts'], userId, options: { forceReimport: true } })`. The contacts sync function calls `forceReimport()` first when option is set. |
| 3 | Database Reindex | **Internal sync function** (new 'reindex' type) | Simple async call, no dialog. Register at init time. |
| 4 | Database Backup | **Internal sync function** (new 'backup' type) | The `window.api.databaseBackup.backup()` returns after dialog + operation. While dialog is open, the sync item shows as "running" which is acceptable UX. Register at init time. |
| 5 | Database Restore | **Internal sync function** (new 'restore' type) | Same pattern as backup. Register at init time. |
| 6 | CCPA Data Export | **Internal sync function** (new 'ccpa-export' type) | Has progress via `onExportProgress` IPC. Register at init time. Wire IPC progress to orchestrator's `onProgress`. |

**Key insight for Messages Import (Settings):** The existing `messages` sync function (line 229) already handles `forceReimport` detection via the IPC progress listener (line 247 -- detects 'deleting' phase). The IPC call `importMacOSMessages(userId)` at line 266 does NOT currently pass `forceReimport`. The Settings component bypasses the orchestrator and calls `importMacOSMessages(userId, forceReimport)` directly (line 231 in MacOSMessagesImportSettings).

To unify: Update the registered messages sync function to accept `options` and pass `options?.forceReimport` to the IPC call.

**Key insight for Contacts Force Re-import:** The `ContactsImportSettings` component already uses `useSyncOrchestrator` for normal sync (line 59, 145). The force re-import path (line 248) calls `forceReimport()` directly, then `handleImportAll()` which triggers `requestSync(['contacts'], userId)`. To unify: the contacts sync function should check `options?.forceReimport` and call `window.api.contacts.forceReimport(userId)` before proceeding with normal sync.

#### 3c. SyncStatusIndicator Label Mapping

Add human-readable labels for new types in `getLabelForType()`:

```typescript
case 'reindex':
  return 'Reindex';
case 'backup':
  return 'Backup';
case 'restore':
  return 'Restore';
case 'ccpa-export':
  return 'Data Export';
```

#### 3d. Queuing Behavior

Per task guidance: "Keep it simple for v1: let maintenance operations queue."

When a dashboard sync is running and user clicks Reindex in Settings, the `requestSync()` call returns `{ started: false, needsConfirmation: true }`. The Settings UI should detect this and show an appropriate message. However, this is an existing UX pattern -- the orchestrator already handles it. The Settings handlers should check the return value and handle gracefully.

Alternative: Use `forceSync()` for maintenance operations. But this would cancel data syncs, which is worse. Stick with queue approach.

### 4. Implementation Steps (Ordered)

#### Step 1: Extend SyncType, SyncRequest, and SyncFunction (SyncOrchestratorService.ts)

**File:** `src/services/SyncOrchestratorService.ts`

1. Line 22: Extend `SyncType` union:
   ```typescript
   export type SyncType = 'contacts' | 'emails' | 'messages' | 'iphone'
     | 'reindex' | 'backup' | 'restore' | 'ccpa-export';
   ```

2. Lines 47-50: Add `options` to `SyncRequest`:
   ```typescript
   export interface SyncRequest {
     types: SyncType[];
     userId: string;
     options?: {
       forceReimport?: boolean;
       overrideCap?: boolean;
     };
   }
   ```

3. Line 53: Extend `SyncFunction` type to accept options:
   ```typescript
   type SyncFunction = (
     userId: string,
     onProgress: (percent: number, phase?: string) => void,
     options?: SyncRequest['options']
   ) => Promise<string | void>;
   ```

4. Line 587 in `startSync()`: Pass options to sync function:
   ```typescript
   const warning = await syncFn(userId, (percent, phase) => {
     this.updateQueueItem(type, { progress: percent, phase });
     this.updateOverallProgress();
   }, request.options);
   ```
   **Note:** This requires `startSync` to have access to the full `request` object, which it already does (line 526-527).

#### Step 2: Update existing messages sync function to accept options

**File:** `src/services/SyncOrchestratorService.ts`, lines 229-281

Update the registered messages sync function to accept and use `options`:
- Change function signature to include `options` parameter
- Pass `options?.forceReimport` to `importMacOSMessages(userId, options?.forceReimport)`

#### Step 3: Update existing contacts sync function to handle forceReimport option

**File:** `src/services/SyncOrchestratorService.ts`, lines 154-213

Before the existing sync logic (Phase 1: macOS Contacts), add:
```typescript
if (options?.forceReimport) {
  const wipeResult = await window.api.contacts.forceReimport(userId);
  if (!wipeResult.success) {
    throw new Error(wipeResult.error || 'Failed to clear contacts for re-import');
  }
  logger.info('[SyncOrchestrator] Contacts wiped for force re-import');
}
```

#### Step 4: Register new sync functions (reindex, backup, restore, ccpa-export)

**File:** `src/services/SyncOrchestratorService.ts`, inside `initializeSyncFunctions()` (after existing registrations, before `this.initialized = true` at line 284)

Register 4 new sync functions:

```typescript
// Register reindex (all platforms)
this.registerSyncFunction('reindex', async (_userId, onProgress) => {
  onProgress(0, 'optimizing');
  const result = await window.api.system.reindexDatabase();
  if (!result.success) {
    throw new Error(result.error || 'Database reindex failed');
  }
  onProgress(100);
});

// Register backup (all platforms)
this.registerSyncFunction('backup', async (_userId, onProgress) => {
  onProgress(0, 'backing up');
  const result = await window.api.databaseBackup.backup();
  if (result.cancelled) return; // User cancelled dialog -- not an error
  if (!result.success) {
    throw new Error(result.error || 'Backup failed');
  }
  onProgress(100);
});

// Register restore (all platforms)
this.registerSyncFunction('restore', async (_userId, onProgress) => {
  onProgress(0, 'restoring');
  const result = await window.api.databaseBackup.restore();
  if (result.cancelled) return; // User cancelled dialog -- not an error
  if (!result.success) {
    throw new Error(result.error || 'Restore failed');
  }
  onProgress(100);
});

// Register CCPA export (all platforms)
this.registerSyncFunction('ccpa-export', async (_userId, onProgress) => {
  onProgress(0, 'exporting');
  const cleanup = window.api.privacy?.onExportProgress?.(
    (progress: { category: string; progress: number }) => {
      onProgress(progress.progress, progress.category);
    }
  );
  try {
    const result = await window.api.privacy.exportData(_userId);
    if (result.error === 'Export cancelled by user') return;
    if (!result.success) {
      throw new Error(result.error || 'CCPA export failed');
    }
    onProgress(100);
  } finally {
    if (cleanup) cleanup();
  }
});
```

**Risk:** The backup/restore sync functions wrap dialog-opening IPC calls. While the dialog is open, the orchestrator has the item as "running" with 0% progress. This is acceptable -- the sync indicator will show "Backup - backing up" which correctly indicates the operation is in progress. If this causes UX concerns (frozen-looking indicator), we can switch to external sync pattern later.

**Risk:** CCPA `exportData` takes `userId` as parameter (line 789 in Settings.tsx: `window.api.privacy.exportData(userId)`). The sync function receives `_userId` which we should pass through: `window.api.privacy.exportData(_userId)`.

#### Step 5: Update useSyncOrchestrator hook to pass options

**File:** `src/hooks/useSyncOrchestrator.ts`

Update `requestSync` and `forceSync` signatures:

```typescript
requestSync: (types: SyncType[], userId: string, options?: SyncRequest['options']) => { ... };
forceSync: (types: SyncType[], userId: string, options?: SyncRequest['options']) => void;
```

Update the callbacks:
```typescript
const requestSync = useCallback((types: SyncType[], userId: string, options?: SyncRequest['options']) => {
  return syncOrchestrator.requestSync({ types, userId, options });
}, []);

const forceSync = useCallback((types: SyncType[], userId: string, options?: SyncRequest['options']) => {
  syncOrchestrator.forceSync({ types, userId, options });
}, []);
```

Also update the `UseSyncOrchestratorReturn` interface to include `SyncRequest` options type in the function signatures.

**Impact:** Existing callers pass only `(types, userId)` -- the optional `options` parameter is backward-compatible.

#### Step 6: Update SyncStatusIndicator label mapping

**File:** `src/components/dashboard/SyncStatusIndicator.tsx`, lines 48-61

Add cases to `getLabelForType()`:
```typescript
case 'reindex':
  return 'Reindex';
case 'backup':
  return 'Backup';
case 'restore':
  return 'Restore';
case 'ccpa-export':
  return 'Data Export';
```

#### Step 7: Update MacOSMessagesImportSettings to route through orchestrator

**File:** `src/components/settings/MacOSMessagesImportSettings.tsx`

This is the most complex component change. The component currently:
1. Manages its own `isImporting` state
2. Subscribes to `onImportProgress` for progress display
3. Handles cap confirmation prompts
4. Calls `importMacOSMessages()` directly

**Approach:** Route through orchestrator for the actual import call, but keep local state for UI (cap prompts, filter changes, result display). The orchestrator subscription provides the "is running" state.

Changes:
1. Import `useSyncOrchestrator` and `syncOrchestrator`
2. In `handleImport`, replace direct `importFn(userId, forceReimport)` call with `requestSync(['messages'], userId, { forceReimport, overrideCap })`
3. Keep the local `isImporting` state as a derived value from orchestrator queue (`queue.find(q => q.type === 'messages')?.status === 'running'`)
4. The progress listener at line 189 can stay for component-specific progress display, OR we can derive it from orchestrator state. Since the orchestrator's messages sync function already owns the IPC listener (line 245 in SyncOrchestratorService), the component's duplicate listener (line 189) may conflict. **Decision:** Remove the component's progress listener and derive progress from the orchestrator queue item's `progress` and `phase` fields.
5. Keep cap/filter UI logic as-is (it's component-specific configuration, not sync logic)

**Complication:** The `overrideCap` option temporarily changes the max messages preference before import and restores it after. This logic is currently in the component (lines 203-210, 251-259). This should stay in the component since it's a preference-level concern, not a sync concern. The orchestrator doesn't need to know about caps.

**Revised approach:** Keep `overrideCap` handling in the component. The component:
1. If `overrideCap`: temporarily sets maxMessages preference to null
2. Calls `requestSync(['messages'], userId, { forceReimport })`
3. Subscribes to orchestrator state to detect completion
4. On completion: restores the preference

This means the component needs to watch the orchestrator queue for the messages item completion to know when to restore the preference. Use a `useEffect` that watches the messages queue item status.

#### Step 8: Update MacOSContactsImportSettings (force re-import path)

**File:** `src/components/settings/MacOSContactsImportSettings.tsx`

The normal import path already uses the orchestrator (line 145: `requestSync(['contacts'], userId)`). The force re-import path (lines 244-263) needs to route through orchestrator with options:

Replace `handleForceReimport`:
```typescript
const handleForceReimport = useCallback(async () => {
  if (anySyncing || isOtherSyncRunning || forceReimporting) return;
  setForceReimporting(true);
  setLastResult(null);

  requestSync(['contacts'], userId, { forceReimport: true });
  // Note: forceReimporting local state is now redundant with orchestrator state
  // but keeping it for immediate UI feedback
  setForceReimporting(false);
}, [anySyncing, isOtherSyncRunning, forceReimporting, userId, requestSync]);
```

Wait -- there's a subtlety. The current code calls `forceReimport()` first (wipes contacts), then calls `handleImportAll()` which triggers normal import for both macOS and Outlook. But our plan puts the wipe inside the contacts sync function when `forceReimport` option is set. This means only the contacts sync function's import will run -- Outlook import is handled separately by the contacts sync function's Phase 2.

Looking at the contacts sync function (line 154-213), it already handles both macOS and Outlook sync in sequence. So calling `requestSync(['contacts'], userId, { forceReimport: true })` will:
1. (New) Call `forceReimport()` to wipe contacts
2. (Existing) Phase 1: macOS contacts sync
3. (Existing) Phase 2: Outlook contacts sync

This is correct behavior. The separate `handleOutlookSync` call in `handleImportAll` (line 239) would be redundant since the orchestrator's contacts sync already includes Outlook. But `handleImportAll` also calls `handleSync(false)` AND `handleOutlookSync()` separately. This double-sync is a bug in the existing code (Outlook gets synced twice: once via orchestrator contacts sync, once via direct call). Not our concern for this task though.

**Revised approach for force re-import:** Simply call `requestSync(['contacts'], userId, { forceReimport: true })`. The contacts sync function handles the full flow.

#### Step 9: Update Settings.tsx (reindex, backup, restore, CCPA export)

**File:** `src/components/Settings.tsx`

For each operation, replace the direct IPC call with `requestSync`:

1. Import `useSyncOrchestrator` (or `syncOrchestrator` directly)
2. Update handlers:

**Reindex (line 821-853):**
Keep the `window.confirm()` dialog (UI confirmation). After confirmation, call `requestSync(['reindex'], userId)` instead of direct IPC. Keep local `reindexing` state derived from orchestrator queue or keep as-is for immediate UI feedback. The result handling needs to subscribe to orchestrator state.

**Backup (line 857-891):**
Call `requestSync(['backup'], userId)`. Keep local state for result display.

**Restore (line 895-937):**
Call `requestSync(['restore'], userId)`. Keep local state for result display. Note: restore success triggers `getInfo()` refresh (line 911) -- this post-operation refresh should happen after orchestrator completes.

**CCPA Export (line 774-818):**
Call `requestSync(['ccpa-export'], userId)`. The progress IPC listener is now inside the sync function (Step 4), so remove it from the component. Keep local state for result display.

**Complication:** Settings.tsx currently uses local state (`reindexing`, `backingUp`, `restoring`, `exporting`) for button disable logic and progress display. We need to derive these from orchestrator queue state OR keep them for immediate UI responsiveness.

**Decision:** Import `useSyncOrchestrator` in Settings and derive operation-in-progress state from the queue. Remove local state for `reindexing`, `backingUp`, `restoring`, `exporting` -- derive from `queue.find(q => q.type === 'reindex')?.status === 'running'`, etc.

However, the result display (`reindexResult`, `backupResult`, `exportResult`) should stay as local state because they contain operation-specific details (e.g., `indexesRebuilt`, `durationMs`, `fileSize`) that the orchestrator doesn't track.

**Alternative simpler approach:** Keep local state in Settings.tsx for UI responsiveness. When the button is clicked:
1. Set local state to "running"
2. Call `syncOrchestrator.requestSync({ types: ['reindex'], userId })`
3. Check return value -- if `needsConfirmation`, show message
4. Subscribe to orchestrator for completion (via `useEffect` watching queue)
5. On completion: set local result state from the operation's actual result

Actually, this is getting complex. Let me reconsider.

**Simplest approach:** The sync function registered in the orchestrator wraps the IPC call. The Settings component calls `requestSync`. The orchestrator runs it. The component watches the queue for status changes via `useSyncOrchestrator`. When the queue item completes/errors, the component updates its local result state.

But the component needs the operation result details (e.g., `result.indexesRebuilt`). The orchestrator doesn't capture detailed results -- it only knows success/failure/error-message.

**Final decision:** For reindex/backup/restore/CCPA:
- Register sync functions that wrap the IPC calls (as planned in Step 4)
- Settings component calls `requestSync` instead of direct IPC
- Settings component watches orchestrator queue for progress/completion
- For success details (indexesRebuilt, fileSize, etc.): the sync function can't return these through the orchestrator. Options:
  - a) Accept loss of detailed success messages -- just show "Operation completed"
  - b) Store detailed results in a side channel (module-level variable or state)
  - c) Keep the direct IPC call in the component but ALSO register with orchestrator for tracking

Option (a) is simplest and aligns with the task's goal (visibility in sync indicator). The detailed success messages in Settings are nice-to-have but not critical. The user can see "Reindex - complete" in the sync indicator.

Option (c) would be over-engineering and defeat the purpose.

**Going with Option (a):** Simplify result handling. For errors, the orchestrator captures the error message which is sufficient.

For backup/restore, there's an additional wrinkle: `result.cancelled` means the user cancelled the dialog. The sync function returns early (no error). The orchestrator marks it as complete (progress goes 0 -> done silently). This is fine UX -- the operation didn't fail, it just wasn't performed.

For restore success, there's a post-restore action: refresh db info (line 911). We can handle this by watching the queue: when restore completes successfully, trigger the refresh. Use a `useEffect` that watches the restore queue item.

#### Step 10: Update tests

**File:** `src/services/__tests__/SyncOrchestratorService.test.ts`

Add tests:
1. `requestSync` with options passes options to sync function
2. New sync types (reindex, backup, restore, ccpa-export) can be registered and executed
3. Cancelled dialog operations (backup/restore) don't result in error status
4. CCPA export progress flows through to onProgress
5. Contacts sync with `forceReimport: true` calls `forceReimport()` before normal sync
6. Messages sync with `forceReimport: true` passes it to IPC call

Add window.api mocks for new operations:
```typescript
system: { reindexDatabase: jest.fn() },
databaseBackup: { backup: jest.fn(), restore: jest.fn() },
privacy: { exportData: jest.fn(), onExportProgress: jest.fn() },
```

### 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Messages import duplicate IPC listener (orchestrator + component both listen) | High | Progress reporting breaks | Remove component's `onImportProgress` listener, derive from orchestrator |
| Backup/Restore dialog blocks event loop, freezing sync indicator | Low | Minor UX issue | Acceptable for v1. Document for follow-up if reported. |
| Settings operations queued behind dashboard sync | Medium | User confusion | Settings UI should show "Waiting for sync..." when `needsConfirmation: true` |
| `overrideCap` preference management in Messages import | Medium | Preference not restored if import is cancelled mid-way | Watch orchestrator queue for completion/error in useEffect to restore preference |
| Existing test breakage from SyncFunction signature change | Low | CI failure | SyncFunction is a private type, tests access sync functions directly. Existing tests pass 2 args; new optional 3rd arg is backward-compatible. |

### 6. Questions / Open Items

1. **Messages import `overrideCap` flow:** The cap override temporarily changes user preferences. Should the orchestrator's sync function handle this, or should it remain in the component? **Decision: Keep in component** -- it's a preference concern, not a sync concern.

2. **Restore post-operation:** After successful restore, Settings refreshes db info. This needs to happen after the orchestrator completes the restore. **Solution:** Watch orchestrator queue in a useEffect.

3. **Reindex confirmation dialog:** `handleReindexDatabase` shows a `window.confirm()` before proceeding. This stays in the component -- the orchestrator call only happens after confirmation. The orchestrator doesn't show confirmation dialogs.

### 7. Files Modified (Final List)

| File | Changes |
|------|---------|
| `src/services/SyncOrchestratorService.ts` | Extend SyncType, SyncRequest, SyncFunction; update contacts/messages sync functions for options; register 4 new sync functions; pass options in startSync |
| `src/hooks/useSyncOrchestrator.ts` | Add options parameter to requestSync/forceSync |
| `src/components/dashboard/SyncStatusIndicator.tsx` | Add label cases for new types |
| `src/components/settings/MacOSMessagesImportSettings.tsx` | Route import through orchestrator, remove duplicate IPC listener |
| `src/components/settings/MacOSContactsImportSettings.tsx` | Route force re-import through orchestrator with options |
| `src/components/Settings.tsx` | Route reindex/backup/restore/CCPA through orchestrator |
| `src/services/__tests__/SyncOrchestratorService.test.ts` | Add tests for new types and options |

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| SyncType extension + SyncRequest options | Simple type changes, <5 exhaustive switches to update | +5K |
| Messages import routing (Settings) | Modify sync function to accept options, update component | +8K |
| Contacts force re-import routing (Settings) | Similar pattern to messages | +5K |
| Reindex/backup/restore/CCPA sync registration | 4 new sync functions, simple IPC wrappers | +10K |
| Settings component updates | Route through orchestrator, subscribe to state | +8K |
| Tests | Update existing tests for new types | +4K |

**Confidence:** Medium-High (existing orchestrator architecture is well-defined; work is wiring, not new architecture)

**Risk factors:**
- SyncRequest options design (keep simple)
- Backup/restore dialog interaction pattern
- CCPA progress IPC bridge availability

**Similar past tasks:** TASK-2063 (sync awareness in SPRINT-097), TASK-2119 (external sync registration)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/services/SyncOrchestratorService.ts (SyncType extension + new sync functions)
- [ ] src/components/settings/MacOSMessagesImportSettings.tsx (route through orchestrator)
- [ ] src/components/settings/MacOSContactsImportSettings.tsx (route through orchestrator)
- [ ] src/components/Settings.tsx (route reindex/backup/restore/ccpa through orchestrator)

Features implemented:
- [ ] SyncType extended with new operation types
- [ ] Messages import routed through orchestrator
- [ ] Force re-import contacts routed through orchestrator
- [ ] Reindex registered as sync function
- [ ] Backup registered as sync function (or external tracking)
- [ ] Restore registered as sync function (or external tracking)
- [ ] CCPA export registered as sync function (or external tracking)
- [ ] All operations visible in dashboard sync indicator

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Existing sync flow works
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <If any, explain. If none, "None">
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
