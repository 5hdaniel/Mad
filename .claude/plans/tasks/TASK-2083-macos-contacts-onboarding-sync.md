# Task TASK-2083: Ensure macOS Contacts Sync During Onboarding

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Ensure macOS Contacts are always synced during the onboarding flow, even when the Permissions step (Full Disk Access) is skipped because permissions were already granted. Currently, the macOS contacts sync is triggered inside `PermissionsStep.triggerImport()` which calls `requestSync(['contacts', 'messages'])`. But when permissions are already granted, the step's `shouldShow` returns `false` and `triggerImport` never runs. The `useAutoRefresh` hook on the Dashboard is supposed to catch this, but it has a 1.5-second delay and depends on multiple conditions being met simultaneously.

## Non-Goals

- Do NOT modify the SyncOrchestrator service itself
- Do NOT change the PermissionsStep's shouldShow logic
- Do NOT add email fetching to the onboarding sync (that is TASK-2084)
- Do NOT change the sync order (contacts before messages is correct)
- Do NOT touch the Outlook contacts sync (it works correctly via the same contacts sync function)

## Deliverables

1. Update: `src/components/onboarding/OnboardingFlow.tsx` -- Add a sync trigger in `handleComplete` that ensures contacts+messages sync runs if PermissionsStep was skipped
2. Possibly update: `src/hooks/useAutoRefresh.ts` -- Ensure the auto-refresh on dashboard load reliably includes contacts sync for macOS users who just completed onboarding

## Acceptance Criteria

- [ ] When a new macOS user completes onboarding with permissions already granted, macOS Contacts are synced
- [ ] When a new macOS user completes onboarding through the Permissions step, behavior is unchanged (contacts sync already works)
- [ ] Contacts sync is not triggered twice (no duplicate if PermissionsStep already triggered it)
- [ ] Sync happens in background -- does not block the transition to Dashboard
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Root Cause Analysis

The flow for a macOS user with permissions already granted:

```
Onboarding: phone-type -> secure-storage -> account-verification -> email-connect -> data-sync -> [permissions SKIPPED] -> dashboard
```

When PermissionsStep is skipped:
1. `PermissionsStep.triggerImport()` is never called -- no `requestSync(['contacts', 'messages'])`
2. `setMessagesImportTriggered()` is never called -- so useAutoRefresh will try to sync
3. Dashboard loads -> useAutoRefresh triggers after 1.5s delay
4. `useAutoRefresh.runAutoRefresh()` builds sync types:
   - Contacts: requires `(isMacOS && hasPermissions) || emailConnected` -- should be true
   - Messages: requires `isMacOS && hasPermissions` -- should be true

So in theory, `useAutoRefresh` should handle this. The bug may be a timing issue where `hasPermissions` is not yet `true` when the effect fires, or the conditions aren't all met simultaneously.

### Proposed Fix: Explicit Onboarding Sync Trigger

In `OnboardingFlow.handleComplete()`, after dispatching the completion steps, trigger a contacts+messages sync if we're on macOS and the PermissionsStep was skipped:

```typescript
const handleComplete = useCallback(() => {
  if (!machineState || machineState.state.status !== "onboarding") return;
  const { state, dispatch } = machineState;

  // ... existing completion dispatches ...

  // If macOS and permissions step was skipped (not in completedSteps),
  // explicitly trigger contacts+messages sync
  if (state.platform.isMacOS && !state.completedSteps.includes("permissions")) {
    const userId = appState.userId;
    if (userId && appState.hasPermissions === true) {
      // Import the sync orchestrator
      import('../services/SyncOrchestratorService').then(({ syncOrchestrator }) => {
        setMessagesImportTriggered(); // Prevent duplicate from useAutoRefresh
        syncOrchestrator.requestSync({
          types: ['contacts', 'messages'],
          userId,
        });
      });
    }
  }
}, [machineState, appState, app]);
```

Alternatively, the fix may be simpler: ensure the `useAutoRefresh` hook's conditions are reliably met by the time the Dashboard renders after onboarding. The engineer should investigate which approach is most robust.

### Important: Prevent Double Sync

The `setMessagesImportTriggered()` function (from `utils/syncFlags.ts`) sets a module-level flag that `useAutoRefresh` checks before triggering. If we trigger sync in `handleComplete`, we must also call `setMessagesImportTriggered()` so `useAutoRefresh` doesn't trigger a duplicate 1.5 seconds later.

### Investigation Approach

Before implementing, the engineer should:

1. Log the values of `isMacOS`, `hasPermissions`, `hasEmailConnected`, `isDatabaseInitialized` at the moment useAutoRefresh fires
2. Determine if the issue is a timing problem (state not settled) or a logic gap
3. Choose the simplest fix that reliably ensures contacts sync

## Integration Notes

- TASK-2084 (email cache) depends on this task -- it extends the onboarding sync further
- No other tasks in Batch 1 modify OnboardingFlow.tsx or useAutoRefresh.ts
- Uses the existing `syncOrchestrator.requestSync()` API

## Do / Don't

### Do:
- Use `setMessagesImportTriggered()` to prevent duplicate sync
- Verify the fix works for BOTH new users and returning users
- Handle the case where `hasPermissions` is false (FDA not yet granted -- do not sync contacts in that case, as it would fail)

### Don't:
- Do NOT add a new sync type or change SyncOrchestrator
- Do NOT block the Dashboard transition while waiting for sync
- Do NOT modify the PermissionsStep behavior
- Do NOT add emails to the sync request (that is TASK-2084)

## When to Stop and Ask

- If the root cause is something other than the PermissionsStep being skipped
- If fixing this requires changes to the state machine transitions
- If the duplicate sync prevention mechanism is unreliable

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that contacts sync is triggered when onboarding completes with permissions already granted
  - Test that sync is NOT triggered when permissions are not granted
- Existing tests to update:
  - OnboardingFlow tests may need mock for syncOrchestrator

### Coverage

- Coverage impact: Slight increase

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

## PR Preparation

- **Title**: `fix(onboarding): ensure macOS contacts sync when permissions pre-granted`
- **Labels**: `bug`, `onboarding`, `sync`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~10K-15K (apply service multiplier 0.5x -> ~10K)

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 files | +5K |
| Code volume | ~20 lines added | +3K |
| Investigation | Need to confirm root cause | +5K |
| Test complexity | Medium | +5K |

**Confidence:** Medium

**Risk factors:**
- Root cause may differ from analysis -- investigation needed
- Timing-sensitive sync logic is tricky to test

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*
