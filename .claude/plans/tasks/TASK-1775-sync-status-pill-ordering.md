# TASK-1775: Fix Sync Status Pill Color Ordering

**Backlog ID:** N/A (New bug fix)
**Sprint:** TBD
**Phase:** TBD
**Branch:** `fix/task-1775-sync-pill-ordering`
**Estimated Turns:** 3-5
**Estimated Tokens:** 8K-15K

---

## Objective

Fix the sync status pill color ordering issue where pills are not displaying the correct sequential color states during auto-refresh sync operations on the Dashboard.

---

## Context

### Problem Description
The sync status pills on the Dashboard are not showing colors in the correct order during sequential sync operations.

**Expected behavior:**
- Contacts (blue), Emails (gray), Messages (gray) - when contacts syncing
- Contacts (green), Emails (blue), Messages (gray) - when emails syncing
- Contacts (green), Emails (green), Messages (blue) - when messages syncing
- All green when complete

**Actual behavior:**
Pills may show incorrect colors due to IPC event cross-contamination between `useMacOSMessagesImport` (onboarding) and `useAutoRefresh` (dashboard auto-sync).

### Root Cause Analysis (from SR Engineer)
This is a **shared IPC channel race condition**:
1. Both `useMacOSMessagesImport` and `useAutoRefresh` subscribe to `window.api.messages.onImportProgress()`
2. When onboarding import runs, it fires IPC events
3. These events are received by BOTH hooks
4. `useAutoRefresh` incorrectly processes onboarding's events, corrupting its sync state

### Previous Fix Attempt
A fix was implemented using `isOnboardingImportActive()` to track when onboarding import is running and filter IPC events in `useAutoRefresh`. This filtering logic exists at line 174 in `useAutoRefresh.ts`:

```typescript
if (!autoRefreshInitiatedMessages || isOnboardingImportActive()) return;
```

This needs to be verified end-to-end.

---

## Requirements

### Must Do:
1. **Verify existing fix** - Test the `isOnboardingImportActive()` filtering mechanism end-to-end
2. **Identify any gaps** - Determine if the current fix is complete or needs additional work
3. **Fix if needed** - Implement any missing logic to ensure proper IPC event isolation
4. **Test sequential sync display** - Verify pills show correct colors in sequence during auto-refresh
5. **Test onboarding scenario** - Verify onboarding import does not affect dashboard sync state

### Must NOT Do:
- Do NOT modify `SyncStatusIndicator.tsx` - UI component is already correct
- Do NOT change the sync order (contacts -> emails -> messages is intentional)
- Do NOT add new IPC channels without PM approval

---

## Acceptance Criteria

- [ ] During contacts sync: Contacts pill is blue, Emails and Messages are gray
- [ ] During emails sync: Contacts pill is green, Emails is blue, Messages is gray
- [ ] During messages sync: Contacts and Emails pills are green, Messages is blue
- [ ] After sync complete: All pills are green (briefly before completion state)
- [ ] Onboarding import does NOT affect auto-refresh pill states
- [ ] Auto-refresh does NOT affect onboarding import states
- [ ] No console errors during sync operations

---

## Files to Modify

- `src/hooks/useAutoRefresh.ts` - Verify/fix IPC event filtering logic
- `src/hooks/useMacOSMessagesImport.ts` - Verify/fix `isOnboardingImportRunning` flag management

## Files to Read (for context)

- `src/components/dashboard/SyncStatusIndicator.tsx` - Understand UI state requirements
- `src/components/dashboard/Dashboard.tsx` - Understand where hooks are consumed

---

## Testing Expectations

### Manual Testing (Primary)
This is a visual/behavioral issue requiring manual verification:

1. **Fresh start scenario:**
   - Clear app data (logout/delete db)
   - Go through onboarding with messages import
   - Verify onboarding import shows progress correctly
   - Navigate to dashboard
   - Verify auto-refresh shows pills in correct sequence

2. **Returning user scenario:**
   - Login as existing user
   - Navigate to dashboard
   - Verify auto-refresh shows pills in correct sequence
   - Contacts (blue) -> Emails (blue) -> Messages (blue) in order

3. **Race condition scenario:**
   - If possible, trigger both onboarding import and auto-refresh
   - Verify no cross-contamination of states

### Unit Tests
- **Required:** No (behavioral issue, difficult to unit test IPC events)
- **Existing tests to verify:** Ensure no test regressions in `useAutoRefresh.test.ts` if it exists

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Technical Notes

### Key Code Locations

**IPC Event Filtering (useAutoRefresh.ts:170-174):**
```typescript
useEffect(() => {
  const cleanup = window.api.messages.onImportProgress((progress) => {
    // Ignore IPC events if we didn't initiate the messages sync
    // Also ignore if onboarding import is actively running
    if (!autoRefreshInitiatedMessages || isOnboardingImportActive()) return;
    // ... rest of handler
  });
});
```

**Onboarding Active Flag (useMacOSMessagesImport.ts:28, 51-52):**
```typescript
let isOnboardingImportRunning = false;

export function isOnboardingImportActive(): boolean {
  return isOnboardingImportRunning;
}
```

**Flag Management (useMacOSMessagesImport.ts:101-102, 120-121):**
```typescript
// Set when starting import
isOnboardingImportRunning = true;

// Clear when import completes
isOnboardingImportRunning = false;
```

### Potential Issues to Check
1. Is `isOnboardingImportRunning` being set BEFORE the first IPC event fires?
2. Is `isOnboardingImportRunning` being cleared AFTER all IPC events complete?
3. Are there edge cases where both flags could be true simultaneously?
4. Is `autoRefreshInitiatedMessages` being set correctly before messages sync starts?

---

## PR Preparation

- **Title:** `fix(sync): ensure correct pill color ordering during sequential sync`
- **Branch:** `fix/task-1775-sync-pill-ordering`
- **Target:** `develop`

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

Investigation:
- [ ] Tested fresh start scenario
- [ ] Tested returning user scenario
- [ ] Identified any gaps in current implementation

Implementation:
- [ ] Code complete (if changes needed)
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

- **Before**: [state before - describe observed behavior]
- **After**: [state after - describe fixed behavior]
- **Actual Turns**: X (Est: 3-5)
- **Actual Tokens**: ~XK (Est: 8K-15K)
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
- The IPC channel architecture needs to change (new channels, different event structure)
- The fix requires changes to main process code (preload/main)
- Testing reveals the root cause is different than documented
- You encounter blockers not covered in the task file
