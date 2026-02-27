# Task TASK-2080: Remove Unnecessary Checkbox from Secure Storage Setup

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

Remove the "Don't show this explanation again" checkbox from the Secure Storage Setup onboarding step, along with all associated plumbing (`dontShowAgain` prop, `skipKeychainExplanation` localStorage read/write, related type definitions, and tests). The checkbox state is saved to localStorage but never consumed to skip the step -- the step's `shouldShow()` only checks `isDatabaseInitialized`. Users never see this screen again after initial setup.

## Non-Goals

- Do NOT change the Secure Storage step's core functionality (DB initialization, keychain prompting)
- Do NOT remove the SecureStorageStep itself
- Do NOT modify the `shouldShow` logic (it is already correct)
- Do NOT change the onboarding flow order or step registration
- Do NOT touch `MoveAppPrompt.tsx` which has its own independent `dontShowAgain` checkbox

## Deliverables

1. Update: `src/components/onboarding/steps/SecureStorageStep.tsx` -- Remove checkbox UI and `dontShowAgain` state
2. Update: `src/components/onboarding/types/actions.ts` -- Remove `dontShowAgain` from `SecureStorageSetupAction`
3. Update: `src/components/onboarding/OnboardingFlow.tsx` -- Remove `action.dontShowAgain` from SECURE_STORAGE_SETUP handler
4. Update: `src/appCore/state/flows/useSecureStorage.ts` -- Remove `skipKeychainExplanation` return value, remove localStorage read/write for `skipKeychainExplanation`, simplify `initializeSecureStorage` to not accept `dontShowAgain` param
5. Update: `src/appCore/state/flows/useKeychainHandlers.ts` -- Update `handleKeychainExplanationContinue` to not pass `dontShowAgain`
6. Update: `src/appCore/state/types.ts` -- Remove `skipKeychainExplanation` from types, update `handleKeychainExplanationContinue` signature
7. Update: `src/appCore/state/returnHelpers.ts` -- Remove `skipKeychainExplanation` from return helpers
8. Update: `src/appCore/state/machine/types.ts` -- Remove `dontShowAgain` from machine action types if present
9. Update: `src/appCore/state/flows/__tests__/useSecureStorage.machine.test.tsx` -- Remove `skipKeychainExplanation` describe block and `dontShowAgain` tests
10. Update: Test files referencing `skipKeychainExplanation: false` (AppRouter.test.tsx, AppModals.test.tsx, App.test.tsx)

## Acceptance Criteria

- [ ] Checkbox is removed from SecureStorageStep UI
- [ ] `dontShowAgain` parameter is removed from `initializeSecureStorage` function signature
- [ ] `skipKeychainExplanation` is no longer read from or written to localStorage
- [ ] `skipKeychainExplanation` property removed from all TypeScript interfaces/types
- [ ] `handleKeychainExplanationContinue` takes no parameters
- [ ] All related tests updated (not just deleted -- verify remaining test coverage is adequate)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Onboarding flow still works: phone selection -> secure storage -> keychain prompt -> continue

## Implementation Notes

### Key Pattern: Trace the `dontShowAgain` Chain

The `dontShowAgain` value flows through this chain:

```
SecureStorageStep (UI checkbox state)
  -> SecureStorageSetupAction.dontShowAgain (action type)
    -> OnboardingFlow.handleAction (dispatches to app handler)
      -> app.handleKeychainExplanationContinue(dontShowAgain)
        -> useKeychainHandlers.handleKeychainExplanationContinue(dontShowAgain)
          -> useSecureStorage.initializeSecureStorage(dontShowAgain)
            -> localStorage.setItem("skipKeychainExplanation", "true")
```

The reverse read path:
```
useSecureStorage.skipKeychainExplanation
  <- localStorage.getItem("skipKeychainExplanation")
  -> returned in hook result
    -> returnHelpers.ts maps to app state
      -> NEVER consumed by any component or step logic
```

Remove the entire chain. The `initializeSecureStorage` function should become `initializeSecureStorage(): Promise<boolean>` with no parameters.

### SecureStorageStep Changes

Remove lines 150 (dontShowAgain state), 155 (dontShowAgain in action), and lines 217-228 (checkbox UI). The handleContinue function simplifies to:

```typescript
const handleContinue = () => {
  const action: SecureStorageSetupAction = {
    type: "SECURE_STORAGE_SETUP",
  };
  onAction(action);
};
```

### useSecureStorage Changes

Remove:
- `skipKeychainExplanation` from the return type interface
- localStorage read of `skipKeychainExplanation` (lines 86-88)
- `dontShowAgain` parameter from `initializeSecureStorage` (line 117)
- localStorage write (line 119)
- `skipKeychainExplanation` from return value (line 175)

## Integration Notes

- No other tasks depend on this change
- No other tasks in SPRINT-102 modify these files
- `MoveAppPrompt.tsx` has its own independent `dontShowAgain` checkbox -- do NOT touch it

## Do / Don't

### Do:
- Trace all references to `skipKeychainExplanation` and `dontShowAgain` in the secure storage chain
- Run `npm run type-check` after each file change to catch missed references
- Update test expectations to match new signatures

### Don't:
- Do NOT remove `MoveAppPrompt.tsx`'s `dontShowAgain` checkbox
- Do NOT change the `shouldShow` logic on SecureStorageStep
- Do NOT modify the DB initialization flow

## When to Stop and Ask

- If `skipKeychainExplanation` is consumed anywhere not found in this analysis
- If removing `dontShowAgain` from the type causes cascading type errors beyond the listed files
- If any test failure is not directly related to the removed checkbox

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- Tests to update:
  - `useSecureStorage.machine.test.tsx`: Remove the entire `skipKeychainExplanation` describe block (3 tests). Remove the `dontShowAgain` parameter from `initializeSecureStorage` test calls. Keep remaining tests for DB init behavior.
  - `AppRouter.test.tsx`, `AppModals.test.tsx`, `App.test.tsx`: Remove `skipKeychainExplanation: false` from mock objects
- Tests to verify still pass:
  - All remaining SecureStorageStep tests
  - OnboardingFlow tests

### Coverage

- Coverage impact: Slight decrease (removing 3 dedicated tests), but no new untested paths

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(onboarding): remove unused checkbox from Secure Storage screen`
- **Labels**: `ui`, `cleanup`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | ~10 files | +8K |
| Code volume | ~50 lines removed, ~20 lines changed | +3K |
| Test complexity | Low (mostly removals) | +2K |

**Confidence:** High

**Risk factors:**
- Minimal -- well-scoped removal with clear trace chain

**Similar past tasks:** Cleanup tasks historically come in at 0.5x estimate

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] SecureStorageStep.tsx
- [ ] actions.ts
- [ ] OnboardingFlow.tsx
- [ ] useSecureStorage.ts
- [ ] useKeychainHandlers.ts
- [ ] types.ts (appCore/state)
- [ ] returnHelpers.ts
- [ ] machine/types.ts
- [ ] Tests updated

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Issues encountered:**
<To be filled by engineer>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
