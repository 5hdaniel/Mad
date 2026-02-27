# Task TASK-2081: Pause Sync Auto-Dismiss During Joyride Tour

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Prevent the SyncStatusIndicator from auto-dismissing its completion message while the joyride onboarding tour is active. Currently, sync completes fast and the indicator auto-dismisses after 3 seconds, which removes the `[data-tour="sync-status"]` anchor element's visible content mid-tour-step. When `isTourActive` is true, suppress the auto-dismiss timer so the sync status stays visible until the tour moves past the sync-status step.

## Non-Goals

- Do NOT extend the tour to new screens (that is TASK-2082)
- Do NOT change the sync orchestrator behavior
- Do NOT modify the auto-dismiss timeout duration (keep 3 seconds for normal operation)
- Do NOT change the joyride library or its configuration
- Do NOT remove the manual dismiss button (keep it functional even during tour)

## Deliverables

1. Update: `src/components/dashboard/SyncStatusIndicator.tsx` -- Accept `isTourActive` prop, suppress auto-dismiss timer when true
2. Update: `src/components/Dashboard.tsx` -- Pass `isTourActive` (derived from `runTour` state) to SyncStatusIndicator
3. Update: `src/components/dashboard/__tests__/SyncStatusIndicator.test.tsx` -- Add tests for tour-aware auto-dismiss behavior

## Acceptance Criteria

- [ ] When tour is active and sync completes, completion message stays visible (no auto-dismiss)
- [ ] When tour ends/is skipped, normal auto-dismiss behavior resumes (3 second timer starts)
- [ ] When tour is NOT active, auto-dismiss works exactly as before (3 second timer)
- [ ] Manual dismiss button still works during tour (user can dismiss if they want)
- [ ] The `[data-tour="sync-status"]` wrapper div always renders (it already does -- verify no regression)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### SyncStatusIndicator Changes

Add an `isTourActive` prop:

```typescript
interface SyncStatusIndicatorProps {
  pendingCount?: number;
  onViewPending?: () => void;
  onOpenSettings?: () => void;
  isTourActive?: boolean;  // NEW: suppress auto-dismiss during tour
}
```

In the `useEffect` that handles the syncing-to-not-syncing transition (around line 93), gate the auto-dismiss timer:

```typescript
useEffect(() => {
  if (isAnySyncing) {
    wasSyncingRef.current = true;
    setDismissed(false);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setShowCompletion(false);
  } else if (wasSyncingRef.current && !isAnySyncing) {
    setShowCompletion(true);
    wasSyncingRef.current = false;

    // Only auto-dismiss if tour is NOT active
    if (!isTourActive) {
      autoDismissTimerRef.current = setTimeout(() => {
        setShowCompletion(false);
        setDismissed(true);
        autoDismissTimerRef.current = null;
      }, 3000);
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }
}, [isAnySyncing, isTourActive]);  // Add isTourActive to deps
```

Also add an effect to start the auto-dismiss timer when tour ends while completion is showing:

```typescript
// When tour ends while completion is showing, start the auto-dismiss timer
useEffect(() => {
  if (!isTourActive && showCompletion && !dismissed && !isAnySyncing) {
    autoDismissTimerRef.current = setTimeout(() => {
      setShowCompletion(false);
      setDismissed(true);
      autoDismissTimerRef.current = null;
    }, 3000);

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }
}, [isTourActive, showCompletion, dismissed, isAnySyncing]);
```

### Dashboard Changes

The Dashboard already has `runTour` state from `useTour`. Pass it to SyncStatusIndicator:

```typescript
<SyncStatusIndicator
  pendingCount={pendingCount}
  onViewPending={handleViewPending}
  onOpenSettings={onOpenSettings}
  isTourActive={runTour}  // NEW
/>
```

## Integration Notes

- TASK-2082 (extend tour) depends on this task -- must merge first
- No other tasks modify `SyncStatusIndicator.tsx` or `Dashboard.tsx` in this sprint

## Do / Don't

### Do:
- Keep the existing 3-second auto-dismiss for normal (non-tour) operation
- Test the edge case where tour is closed/skipped mid-completion
- Ensure the `[data-tour="sync-status"]` wrapper always renders regardless of indicator visibility

### Don't:
- Do NOT change the auto-dismiss duration
- Do NOT make the indicator permanently visible during tour (manual dismiss must still work)
- Do NOT modify the joyride callback or tour step logic

## When to Stop and Ask

- If `isTourActive` state is not easily accessible from Dashboard to SyncStatusIndicator
- If the auto-dismiss effect has complex interaction with other effects in SyncStatusIndicator
- If tests are flaky due to timer interactions

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `SyncStatusIndicator.test.tsx`: Test that auto-dismiss is suppressed when `isTourActive=true`
  - Test that auto-dismiss resumes when `isTourActive` transitions from true to false
  - Test that manual dismiss still works during tour
- Existing tests to update:
  - Existing auto-dismiss tests should still pass (they don't pass `isTourActive`, so default is `false`)

### Coverage

- Coverage impact: Slight increase (new test cases)

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

## PR Preparation

- **Title**: `fix(dashboard): pause sync auto-dismiss during joyride tour`
- **Labels**: `ui`, `onboarding`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K-15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3 files | +5K |
| Code volume | ~30 lines added/changed | +3K |
| Test complexity | Medium (timer-based tests) | +5K |

**Confidence:** High

**Risk factors:**
- Timer interaction testing can be tricky with Jest fake timers

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
- [ ] SyncStatusIndicator.tsx
- [ ] Dashboard.tsx
- [ ] SyncStatusIndicator.test.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*
