# Task TASK-1808: Resume Onboarding from Saved Step

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

---

## Goal

Modify `handleGetCurrentUser` and `LoadingOrchestrator` to use the saved `current_onboarding_step` from Supabase instead of deriving it from completion flags. Also handle FDA quit/reopen flow with localStorage flag.

## Non-Goals

- Do NOT change how steps are completed (that's TASK-1807)
- Do NOT add new onboarding steps
- Do NOT modify the step UI components
- Do NOT change the Supabase schema (that's TASK-1806)

## Deliverables

1. Update `sessionHandlers.ts` - `handleGetCurrentUser` returns saved step
2. Update `LoadingOrchestrator.tsx` or `reducer.ts` - Use saved step instead of deriving
3. Add localStorage flag for FDA flow (`fda_flow_in_progress`)
4. Handle edge cases (step no longer valid, user on different device)

## Acceptance Criteria

- [ ] User on phone-type step, quits, reopens -> resumes at phone-type
- [ ] User on secure-storage step, quits, reopens -> resumes at secure-storage
- [ ] User on email-connect step, quits, reopens -> resumes at email-connect
- [ ] User on permissions step (FDA), clicks "Quit & Reopen" -> resumes at permissions OR dashboard if FDA granted
- [ ] User with `onboarding_completed_at` set -> goes directly to dashboard
- [ ] User on new device with cloud data -> correctly derives step from cloud state
- [ ] All CI checks pass
- [ ] TypeScript strict mode compliant

## Implementation Notes

### Session Handler Update

```typescript
// electron/handlers/sessionHandlers.ts - in handleGetCurrentUser

// Fetch user from Supabase including new fields
const cloudUser = await supabaseService.getUserById(session.user.id);

// Return saved onboarding step if exists
return {
  ...userData,
  currentOnboardingStep: cloudUser?.current_onboarding_step ?? null,
  onboardingCompletedAt: cloudUser?.onboarding_completed_at ?? null,
};
```

### Reducer/Orchestrator Update

When determining onboarding state after `AUTH_LOADED` or `USER_DATA_LOADED`:

```typescript
// If onboarding completed, go to ready
if (userData.onboardingCompletedAt) {
  return { status: 'loading', phase: 'loading-user-data' }; // Will transition to ready
}

// If saved step exists, resume there
if (userData.currentOnboardingStep) {
  return {
    status: 'onboarding',
    step: userData.currentOnboardingStep as OnboardingStep,
    // ... other state
  };
}

// Otherwise derive from completion flags (fallback for legacy users)
// ... existing derivation logic
```

### FDA Flow Handling

The FDA flow has a special case: user clicks "Quit & Reopen" during permission grant.

```typescript
// PermissionsStep.tsx - before showing FDA dialog
localStorage.setItem('fda_flow_in_progress', 'true');

// LoadingOrchestrator or reducer - on app restart
const fdaInProgress = localStorage.getItem('fda_flow_in_progress');
if (fdaInProgress) {
  // Check if FDA was actually granted
  const hasPermissions = await checkPermissions();
  if (hasPermissions) {
    localStorage.removeItem('fda_flow_in_progress');
    // Proceed to ready
  } else {
    // Resume at permissions step
    localStorage.removeItem('fda_flow_in_progress');
  }
}
```

### Key Files to Read First

1. `electron/handlers/sessionHandlers.ts` - `handleGetCurrentUser` function
2. `src/appCore/state/machine/reducer.ts` - `AUTH_LOADED`, `USER_DATA_LOADED` actions
3. `src/appCore/state/machine/LoadingOrchestrator.tsx` - Phase 3/4 logic
4. `src/components/onboarding/steps/PermissionsStep.tsx` - FDA flow

### Edge Cases to Handle

1. **Saved step no longer valid**: User has `current_onboarding_step = 'secure-storage'` but DB is already initialized
   - Derive next step from current state instead

2. **New device with cloud data**: User has terms accepted, phone type saved, but no local DB
   - Use cloud `current_onboarding_step` if available
   - Fall back to derivation from cloud completion flags

3. **Onboarding completed but step still set**: `onboarding_completed_at` is set but `current_onboarding_step` not null
   - Trust `onboarding_completed_at` - go to ready

## Integration Notes

- Imports from: `supabaseService.ts` (for user data)
- Used by: State machine, LoadingOrchestrator
- Depends on: TASK-1807 (step must be persisted for resume to work)

## Do / Don't

### Do:
- Keep derivation logic as fallback for users without saved step
- Handle FDA flow edge case with localStorage
- Clear localStorage flag after use
- Trust `onboarding_completed_at` over `current_onboarding_step`

### Don't:
- Remove existing derivation logic (needed for legacy users)
- Add new Supabase columns (that's TASK-1806)
- Modify how steps are saved (that's TASK-1807)
- Block on localStorage operations

## When to Stop and Ask

- If the reducer structure makes saved step integration complex
- If edge cases not covered in this spec arise
- If FDA flow handling conflicts with existing patterns
- If you need to modify more than 5 files

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test resume from each saved step
  - Test `onboardingCompletedAt` goes to ready
  - Test FDA localStorage flag handling
  - Test fallback to derivation when no saved step
- Existing tests to update:
  - May need to mock `currentOnboardingStep` in user data

### Coverage

- Coverage impact: Must not decrease
- Resume logic should have >80% coverage

### Manual Testing

1. Start onboarding, complete phone-type, quit app
2. Reopen app -> should be on secure-storage (not phone-type again)
3. Complete to permissions step on macOS
4. Click "Grant Permission", add app to FDA, click "Quit & Reopen"
5. App restarts -> should go to dashboard (FDA granted) or permissions (not granted)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(onboarding): resume from saved step on app restart`
- **Labels**: `critical`, `feature`, `onboarding`
- **Base Branch**: `main`
- **Depends on**: TASK-1807

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 4-5 (handlers, reducer, orchestrator, permissions step) | +8K |
| Code volume | ~150 lines | +4K |
| Test complexity | High (multiple edge cases) | +5K |

**Confidence:** Medium - depends on reducer complexity

**Risk factors:**
- Reducer structure may be complex
- Edge cases in FDA flow
- State machine interactions

**Similar past tasks:** Complex state tasks typically come in at 1x estimate

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
- [ ] electron/handlers/sessionHandlers.ts
- [ ] src/appCore/state/machine/reducer.ts OR LoadingOrchestrator.tsx
- [ ] src/components/onboarding/steps/PermissionsStep.tsx
- [ ] Types if needed

Features implemented:
- [ ] Return saved step from handleGetCurrentUser
- [ ] Use saved step in state machine
- [ ] FDA localStorage flag
- [ ] Edge case handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test: quit and resume from each step
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | <from metrics file> |
| Duration | <from hook data> |
| API Calls | N/A |

**Variance:** PM Est ~15K vs Actual <VALUE>

### Notes

**Planning notes:**
<Any discoveries during planning>

**Deviations from plan:**
<None or description>

**Issues encountered:**
<None or description>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**State Machine Safety:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** main
