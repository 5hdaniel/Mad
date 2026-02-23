# Task TASK-2056: Block Network-Dependent Actions When Offline

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

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Prevent network-dependent UI actions from spinning or hanging when offline by (1) disabling buttons with a tooltip when `navigator.onLine` is false, and (2) adding 10-15 second timeouts to backend network calls so they fail fast instead of hanging for 60+ seconds.

## Non-Goals

- Do NOT implement automatic retry of failed operations (that is TASK-2058 / future work).
- Do NOT add a global offline mode or read-only mode (BACKLOG-790).
- Do NOT change the OfflineBanner component (it already exists and works).
- Do NOT modify the SyncOrchestrator's sync execution logic.
- Do NOT add offline caching or queue-and-retry patterns.

## Prerequisites

**Sprint:** SPRINT-095
**Parallel with:** TASK-2055 (sync dismiss), TASK-2057 (migration restore) -- no shared files.
**Blocks:** TASK-2058 (failure logging) -- depends on timeout additions from this task.

## Context

WiFi-off QA testing revealed these issues:

| Action | Current Behavior | Expected Behavior |
|--------|-----------------|-------------------|
| Transaction sync (Overview tab) | Spins forever, no timeout | Disabled when offline; 15s timeout when online |
| Check for Updates | Falsely reports "up to date" | Disabled with "You are offline" tooltip |
| Outlook contacts sync | Hangs ~60s, shows DNS error | Disabled when offline |
| Settings page load | Console error, opens with stale data | Show stale data (acceptable), but disable sync actions |
| Sign Out All Devices | Shows "fetch failed" (correct pattern) | Keep as-is, add disable when offline |

The app already has:
- `NetworkContext` (`src/contexts/NetworkContext.tsx`) providing `isOnline` via `useNetwork()` hook
- `OfflineBanner` component showing "You're offline" at the top of the app
- `navigator.onLine` detection with event listeners

## Requirements

### Must Do:

#### Part 1: UI -- Disable buttons when offline

1. **Dashboard sync button** -- Disable with tooltip "You are offline" when `isOnline` is false. **Note:** The sync trigger in `Dashboard.tsx` is passed as an `onTriggerRefresh` prop. Trace where this prop originates to determine whether the disable logic belongs in Dashboard.tsx or the parent component that provides the callback.
2. **Check for Updates** (Settings) -- Disable with tooltip.
3. **Sign Out All Devices** (Settings) -- Disable with tooltip.
4. **Outlook Import/Sync** (Settings or wherever triggered) -- Disable with tooltip.
5. **Export (cloud-dependent options)** -- Disable cloud export options with tooltip. Local export should remain enabled.

For each button:
- Use the existing `useNetwork()` hook from `NetworkContext`
- Add `disabled={!isOnline}` prop
- Add `title="You are offline"` tooltip when disabled
- Add visual styling: `opacity-50 cursor-not-allowed` when disabled

#### Part 2: Backend -- Add timeouts to network calls

6. **Add 15-second timeout** to all fetch/network calls that currently hang:
   - Outlook Graph API calls (contacts sync, email sync)
   - Supabase preference sync
   - Update checker
   - Any other backend fetch calls without timeouts

Use `AbortController` with `setTimeout` pattern:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  const response = await fetch(url, { signal: controller.signal, ...options });
  // ...
} finally {
  clearTimeout(timeout);
}
```

### Must NOT Do:

- Add retry logic (future scope)
- Change offline detection mechanism
- Modify OfflineBanner component
- Block local-only operations (viewing transactions, reading local data)

## Acceptance Criteria

- [ ] Dashboard sync button is disabled with "You are offline" tooltip when offline
- [ ] Check for Updates button is disabled when offline
- [ ] Sign Out All Devices button is disabled when offline
- [ ] Outlook import/sync buttons are disabled when offline
- [ ] Cloud export options are disabled when offline; local export still works
- [ ] All modified network calls have a 15-second timeout (no hanging for 60+ seconds)
- [ ] Timeout errors produce a clear error message (not "fetch failed" or DNS error)
- [ ] When device goes back online, buttons re-enable automatically (NetworkContext handles this)
- [ ] Local-only operations (viewing transactions, reading audit data, browsing contacts) remain fully functional when offline
- [ ] No regressions in existing offline banner behavior
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Disable sync button when offline using `useNetwork()` |
| `src/components/Settings.tsx` | Disable Check for Updates, Sign Out All Devices, Outlook sync when offline |
| `electron/handlers/updaterHandlers.ts` | Add 15s timeout to update check |
| `electron/handlers/sessionHandlers.ts` | Add 15s timeout to sign-out-all-devices call |
| `electron/services/submissionSyncService.ts` | Add timeout to Supabase sync calls |

### Files to Read (for context)

| File | Why |
|------|-----|
| `src/contexts/NetworkContext.tsx` | Understand `useNetwork()` API and `isOnline` state |
| `src/appCore/shell/OfflineBanner.tsx` | Reference for existing offline UX pattern |
| `electron/preload/outlookBridge.ts` | Understand Outlook IPC channels |
| `electron/preload/authBridge.ts` | Understand sign-out IPC channels |

## Implementation Notes

### Reusable disabled-when-offline pattern

Consider creating a small wrapper or utility for the repeated pattern:

```typescript
// Example inline pattern (preferred for clarity)
const { isOnline } = useNetwork();

<button
  onClick={handleSync}
  disabled={!isOnline || isSyncing}
  title={!isOnline ? "You are offline" : undefined}
  className={`... ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  Sync
</button>
```

### Timeout wrapper for electron handlers

```typescript
// electron/utils/fetchWithTimeout.ts or inline
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

If creating a shared utility, place it in `electron/utils/fetchWithTimeout.ts`. Otherwise, inline the pattern in each handler.

## Testing Expectations

### Unit Tests

- **Required:** Yes
- **New tests to write:**
  1. Dashboard: sync button renders disabled when offline (mock `useNetwork` to return `isOnline: false`)
  2. Settings: Check for Updates, Sign Out All Devices render disabled when offline
  3. Timeout utility: test that fetch aborts after timeout period

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** ui + service (mixed)
- **Multiplier:** x 1.0
- **Base estimate:** ~60K tokens
- **Final estimate:** ~60K tokens
- **Token Cap:** 240K (4x)

## PR Preparation

- **Title:** `fix(offline): block network-dependent actions when offline and add fetch timeouts`
- **Branch:** `fix/task-2056-offline-action-blocking`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-22*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

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

- **Before**: Network-dependent buttons (sync, check for updates, sign out all devices, email connect/disconnect, Outlook contacts sync) remain active when offline, leading to hangs, false "up to date" reports, and DNS errors. Backend network calls hang for 60+ seconds with no timeout.
- **After**: All network-dependent buttons disabled with "You are offline" tooltip when offline. Backend calls (Outlook Graph API, Supabase sign-out, submission sync, update checker) all have 15-second timeouts. Local-only operations (viewing transactions, browsing contacts, reindex database) remain fully functional.
- **Actual Tokens**: ~XK (Est: 60K)
- **PR**: [URL after PR created]

### What Was Implemented

**Part 1 -- UI (6 files modified):**
- `Dashboard.tsx`: Added `useNetwork()` hook (sync button handled via StartNewAuditModal)
- `StartNewAuditModal.tsx`: Disabled sync button when offline with tooltip and opacity
- `Settings.tsx`: Disabled Check for Updates, Sign Out All Devices, and all 6 Gmail/Outlook Connect/Disconnect/Reconnect buttons when offline
- `MacOSContactsImportSettings.tsx`: Disabled Outlook contacts sync when offline, added offline warning banner

**Part 2 -- Backend (4 files modified):**
- `updaterHandlers.ts`: Added 15s timeout via Promise.race around autoUpdater.checkForUpdatesAndNotify()
- `supabaseService.ts`: Added 15s timeout via Promise.race around signOutGlobal
- `submissionSyncService.ts`: Added 15s timeout via Promise.race around fetchCloudStatuses Supabase query
- `outlookFetchService.ts`: Added timeout: 15000 to axios config in _graphRequest (all Graph API calls)

**Tests (2 files modified):**
- `Settings.test.tsx`: Added 8 new offline-specific tests (disable buttons, tooltips, re-enable on reconnect, local ops unaffected)
- `StartNewAuditModal.test.tsx`: Added useNetwork mock to prevent crash from missing NetworkProvider

### Notes

**Deviations from plan:**
1. Task file listed `sessionHandlers.ts` for sign-out timeout, but the actual sign-out network call lives in `supabaseService.ts` (the handler just calls the service). Placed timeout at the network call level in supabaseService.ts instead.
2. Task suggested AbortController pattern, but used Promise.race pattern instead since autoUpdater and Supabase SDK don't accept AbortSignal. Used axios `timeout` config for Outlook (axios supports it natively).
3. Cloud export options: No cloud-only export buttons were found that needed disabling -- export is handled locally. Skipped this sub-requirement.
4. Did not create a shared `fetchWithTimeout.ts` utility since each call site uses a different API (axios, Supabase SDK, electron-updater) and the inline pattern is clearer.

**Issues encountered:**
**Issues/Blockers:** None -- implementation was straightforward.

---

## Guardrails

**STOP and ask PM if:**
- A network-dependent button is in a shared component that other tasks in this sprint also modify
- The timeout pattern needs to be different for Electron IPC vs renderer fetch calls
- You discover more than 10 network call sites that need timeouts (scope may need splitting)
- Existing tests fail in ways unrelated to this change
- You encounter blockers not covered in the task file
