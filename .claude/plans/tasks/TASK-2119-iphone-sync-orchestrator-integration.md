# TASK-2119: Integrate iPhone Sync into SyncOrchestrator

**Backlog:** BACKLOG-853
**Sprint:** SPRINT-114
**Status:** In Progress
**Branch:** `feature/TASK-2119-iphone-orchestrator`
**Priority:** High
**Estimated Complexity:** High

---

## Objective

Register iPhone sync as an external sync type in the SyncOrchestrator so it behaves consistently with email/contacts/messages sync. This eliminates the bolted-on iPhone props, makes `isRunning` include iPhone sync (disabling dashboard buttons), and shows iPhone as a standard pill in SyncStatusIndicator.

## Requirements

1. Add `'iphone'` to `SyncType` in SyncOrchestratorService
2. Add external sync registration API (`registerExternalSync`, `updateExternalSync`, `completeExternalSync`)
3. Bridge `useIPhoneSync` lifecycle events to the orchestrator
4. Remove iPhone-specific props from SyncStatusIndicator — render iPhone from queue
5. Remove SyncStatusBanner (no longer needed — orchestrator handles all sync types)
6. Keep IPhoneSyncContext and IPhoneSyncFlow modal intact (password, passcode, device state, "Details" button)
7. Keep "Details" button to open IPhoneSyncFlow modal for full sync details
8. `isRunning` naturally includes iPhone sync — dashboard buttons disable

## Implementation Plan

### Step 1: Extend SyncOrchestratorService

**File:** `src/services/SyncOrchestratorService.ts`

- Widen `SyncType`: add `'iphone'`
- Add `registerExternalSync(type)` — adds running item to queue
- Add `updateExternalSync(type, updates)` — updates progress/phase
- Add `completeExternalSync(type, result)` — marks complete/error
- Refactor `isRunning` to check `queue.some(item => item.status === 'running')`
- Make `registerExternalSync` idempotent (for hot reload reconnect)
- `cancel()` should NOT cancel external sync items

### Step 2: Bridge useIPhoneSync to orchestrator

**File:** `src/hooks/useIPhoneSync.ts`

- Import `syncOrchestrator` singleton
- `startSync()`: call `registerExternalSync('iphone')` after setting status
- `onProgress` listener: call `updateExternalSync('iphone', { progress, phase })`
- `onStorageComplete` listener: call `completeExternalSync('iphone', { status: 'complete' })`
- `onError` listener: call `completeExternalSync('iphone', { status: 'error', error })`
- `cancelSync()`: call `completeExternalSync('iphone', { status: 'complete' })`
- Reconnect path (checkSyncStatus): call `registerExternalSync('iphone')` when reconnecting

### Step 3: Simplify SyncStatusIndicator

**File:** `src/components/dashboard/SyncStatusIndicator.tsx`

- Remove all iPhone-specific props (`iPhoneSyncStatus`, `iPhoneProgress`, etc.)
- Remove `renderIPhonePill()`, `iPhoneStatusColors`, `getIPhonePhaseLabel`
- Add `'iphone'` to `getLabelForType`: returns `'iPhone'`
- iPhone renders via existing `renderPill()` from the queue
- Keep "Details" support: add optional `onViewSyncDetails?: (type: SyncType) => void` prop
- Render "Details" link for iPhone pill when handler provided

### Step 4: Simplify Dashboard.tsx

**File:** `src/components/Dashboard.tsx`

- Remove `useIPhoneSyncContext()` import and call
- Remove iPhone props from SyncStatusIndicator
- `isAnySyncing` from `useSyncOrchestrator()` now naturally includes iPhone
- Pass `onViewSyncDetails` callback that opens iPhone modal for `'iphone'` type

### Step 5: Clean up AppShell.tsx

**File:** `src/appCore/AppShell.tsx`

- Remove SyncStatusBanner import and rendering block
- Remove `useIPhoneSyncContext()` call
- Remove `isDashboardBare` logic and `modalState` destructuring

### Step 6: Delete SyncStatusBanner

- Delete `src/appCore/shell/SyncStatusBanner.tsx`
- Remove export from `src/appCore/shell/index.ts`

### Step 7: Update tests

- `SyncStatusIndicator.test.tsx`: Remove iPhone prop tests, add queue-based iPhone tests
- `Dashboard.test.tsx`: Remove IPhoneSyncContext mock
- `AppShell.test.tsx`: Remove SyncStatusBanner assertions
- `SyncOrchestratorService.test.ts`: Add external sync API tests

## What Stays Unchanged

- `IPhoneSyncContext.tsx` — still provides full state to IPhoneSyncFlow modal
- `IPhoneSyncFlow.tsx` — password, passcode, cancel, device state, View Details
- `App.tsx` — IPhoneSyncProvider stays (needed for modal)
- `useIPhoneSync.ts` — all IPC listeners, local state, syncStateRef (adds orchestrator calls)

## Acceptance Criteria

- [ ] iPhone sync shows as a pill in SyncStatusIndicator (like contacts/emails)
- [ ] Dashboard buttons disable during iPhone sync
- [ ] "Details" link on iPhone pill opens IPhoneSyncFlow modal
- [ ] Hot reload reconnects iPhone to both context AND orchestrator
- [ ] Cancel iPhone sync does not cancel email/contacts sync (and vice versa)
- [ ] SyncStatusBanner removed (no longer needed)
- [ ] All existing email/contacts/messages sync behavior unchanged
- [ ] Tests pass
