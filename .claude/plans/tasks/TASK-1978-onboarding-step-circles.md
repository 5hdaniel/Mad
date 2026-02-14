# TASK-1978: Remove numbers from onboarding step trackers

**Backlog ID:** BACKLOG-686
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1978-onboarding-step-circles`
**Estimated Tokens:** ~8K (ui x 1.0)

---

## Objective

Replace numbered step circles in the onboarding progress indicators with plain circles. Completed steps show a checkmark (already implemented); current and pending steps should show an empty circle instead of a number.

---

## Context

There are two step tracker components in the codebase:
1. **`src/components/onboarding/shell/ProgressIndicator.tsx`** - New onboarding flow (used by `OnboardingShell`)
2. **`src/components/SetupProgressIndicator.tsx`** - Legacy (deprecated) but may still render
3. **`src/components/WelcomeTerms.tsx`** - Has a hardcoded step circle with "1" in it

The user reports inconsistency: some steps show numbers, others show checkmarks. The fix is to make ALL non-completed steps show plain circles (no numbers), and completed steps show checkmarks (already working).

---

## Requirements

### Must Do:
1. In `ProgressIndicator.tsx` `StepCircle` component: change the "current" and "pending" states to render an empty circle (no number) instead of `{stepNumber}`
2. In `SetupProgressIndicator.tsx`: change the circle rendering for `step.id === currentStep` and `step.id > currentStep` to render empty circles instead of `{step.id}`
3. In `WelcomeTerms.tsx`: change the hardcoded "1" in the step indicator circle to be empty
4. Keep the checkmark rendering for completed steps as-is (already correct)
5. Keep circle sizing, colors, and ring styles as-is

### Must NOT Do:
- Change the color scheme or sizing of circles
- Modify the connecting lines between steps
- Change the step labels below circles
- Alter the completed state checkmark behavior

---

## Acceptance Criteria

- [ ] `ProgressIndicator.tsx` StepCircle renders empty circle for "current" and "pending" status (no number)
- [ ] `SetupProgressIndicator.tsx` circles render empty for current and future steps
- [ ] `WelcomeTerms.tsx` step indicator shows empty circle (no "1")
- [ ] Completed steps still show green checkmark in all three components
- [ ] Current step still has blue background + ring-4 ring-blue-200 visual distinction
- [ ] Pending steps still have gray background
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Existing onboarding tests pass (`npm test -- --testPathPattern="onboarding"`)

---

## Files to Modify

- `src/components/onboarding/shell/ProgressIndicator.tsx` - Remove `{stepNumber}` from current/pending rendering in `StepCircle`
- `src/components/SetupProgressIndicator.tsx` - Remove `{step.id}` from current/future step rendering
- `src/components/WelcomeTerms.tsx` - Remove "1" from step indicator div

## Files to Read (for context)

- `src/components/onboarding/shell/ProgressIndicator.tsx` - Understand full component structure
- `src/components/SetupProgressIndicator.tsx` - Legacy variant
- `src/components/WelcomeTerms.tsx` - First-time welcome screen step indicator

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests needed
- **Existing tests to update:** Check `src/components/onboarding/__tests__/shell.test.tsx` if any tests assert step numbers in circles

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(ui): remove numbers from onboarding step tracker circles`
- **Branch:** `fix/task-1978-onboarding-step-circles`
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
- **Actual Tokens**: ~XK (Est: 8K)
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
- **Branch Name:** `fix/task-1978-onboarding-step-circles`

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `ProgressIndicator.tsx`, `SetupProgressIndicator.tsx`, `WelcomeTerms.tsx`
- Conflicts with: None -- all 3 files are exclusive to this task

### Technical Considerations
- Very low risk, purely cosmetic changes
- No architecture concerns
- Verify tests do not assert step numbers in rendered output

---

## Guardrails

**STOP and ask PM if:**
- There are additional step tracker components beyond the 3 identified
- Any existing tests explicitly assert step numbers in the UI
- You encounter blockers not covered in the task file
