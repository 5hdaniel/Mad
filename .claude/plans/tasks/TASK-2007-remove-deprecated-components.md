# TASK-2007: Remove Deprecated Components from AppRouter

**Backlog ID:** BACKLOG-725
**Sprint:** SPRINT-087
**Phase:** Phase 1 - Code Cleanup
**Branch:** `chore/task-2007-remove-deprecated-components`
**Estimated Tokens:** ~5K

---

## Objective

Remove 6 deprecated legacy components that are still imported in `AppRouter.tsx` and `AppModals.tsx`. These components were replaced by `onboarding/steps/` equivalents but their old files and imports were never cleaned up. Delete the component files, their test files, and all references.

---

## Context

During the onboarding refactor (SPRINT-063/070), new step-based components were created under `src/components/onboarding/steps/`. The old standalone components were marked `@deprecated` but never removed. They are still imported and rendered in `AppRouter.tsx`, creating dead code that signals neglect to a reviewer.

**Deprecated components and their replacements:**

| Deprecated Component | Replacement | File |
|---------------------|-------------|------|
| `AppleDriverSetup` | `onboarding/steps/AppleDriverStep.tsx` | `src/components/AppleDriverSetup.tsx` |
| `KeychainExplanation` | `onboarding/steps/SecureStorageStep.tsx` | `src/components/KeychainExplanation.tsx` |
| `PhoneTypeSelection` | `onboarding/steps/PhoneTypeStep.tsx` | `src/components/PhoneTypeSelection.tsx` |
| `AndroidComingSoon` | `onboarding/steps/AndroidComingSoonStep.tsx` | `src/components/AndroidComingSoon.tsx` |
| `SetupProgressIndicator` | `onboarding/shell/ProgressIndicator.tsx` | `src/components/SetupProgressIndicator.tsx` |
| `WelcomeTerms` | (terms shown in auth flow) | `src/components/WelcomeTerms.tsx` |

**Import locations found:**

| File | Imports |
|------|---------|
| `src/appCore/AppRouter.tsx` | AppleDriverSetup, KeychainExplanation, PhoneTypeSelection, AndroidComingSoon |
| `src/appCore/AppModals.tsx` | WelcomeTerms |
| `src/components/KeychainExplanation.tsx` | SetupProgressIndicator (internal import) |
| `src/components/AppleDriverSetup.tsx` | (standalone) |

**Test files to delete:**
- `src/components/__tests__/AppleDriverSetup.test.tsx`
- `src/components/__tests__/PhoneTypeSelection.test.tsx`
- `src/components/__tests__/KeychainExplanation.test.tsx`

---

## Requirements

### Must Do:

1. **Remove imports** from `src/appCore/AppRouter.tsx`:
   - Remove import of `KeychainExplanation`
   - Remove import of `PhoneTypeSelection`
   - Remove import of `AndroidComingSoon`
   - Remove import of `AppleDriverSetup`
   - Remove all JSX usage of these components (the route cases that render them)

2. **Remove imports** from `src/appCore/AppModals.tsx`:
   - Remove import of `WelcomeTerms`
   - Remove all JSX usage of `WelcomeTerms`

3. **Remove any handler props** that were only used by the deprecated components:
   - `handleAppleDriverSetupComplete`, `handleAppleDriverSetupSkip`
   - `handleKeychainExplanationContinue`
   - `skipKeychainExplanation`
   - Trace these to their source -- if they are defined in hooks/state and ONLY used by deprecated components, remove them. If used elsewhere, leave them.

4. **Delete deprecated component files:**
   - `src/components/AppleDriverSetup.tsx`
   - `src/components/KeychainExplanation.tsx`
   - `src/components/PhoneTypeSelection.tsx`
   - `src/components/AndroidComingSoon.tsx`
   - `src/components/SetupProgressIndicator.tsx`
   - `src/components/WelcomeTerms.tsx`

5. **Delete associated test files:**
   - `src/components/__tests__/AppleDriverSetup.test.tsx`
   - `src/components/__tests__/PhoneTypeSelection.test.tsx`
   - `src/components/__tests__/KeychainExplanation.test.tsx`

6. **Verify no other imports remain** after deletion:
   ```bash
   grep -r "AppleDriverSetup\|KeychainExplanation\|PhoneTypeSelection\|AndroidComingSoon\|SetupProgressIndicator\|WelcomeTerms" --include="*.ts" --include="*.tsx" src/
   ```
   This should return zero results (excluding any comments in this task file).

### Must NOT Do:
- Do NOT modify or delete the onboarding/steps/ replacement components
- Do NOT change the onboarding flow logic or state machine
- Do NOT remove handler functions that are used by non-deprecated components
- Do NOT touch Dashboard.tsx if WelcomeTerms is referenced there (check first -- it may just be a type reference)
- Do NOT add any new functionality

---

## Acceptance Criteria

- [ ] All 6 deprecated component files deleted
- [ ] All 3 associated test files deleted
- [ ] No imports of deprecated components remain in any .ts/.tsx file
- [ ] `npm run type-check` passes (no missing import errors)
- [ ] `npm run lint` passes
- [ ] `npm test` passes with no failures
- [ ] Onboarding flow replacement components are untouched

---

## Files to Modify

- `src/appCore/AppRouter.tsx` - Remove 4 deprecated imports and their JSX usage
- `src/appCore/AppModals.tsx` - Remove WelcomeTerms import and usage

## Files to Delete

- `src/components/AppleDriverSetup.tsx`
- `src/components/KeychainExplanation.tsx`
- `src/components/PhoneTypeSelection.tsx`
- `src/components/AndroidComingSoon.tsx`
- `src/components/SetupProgressIndicator.tsx`
- `src/components/WelcomeTerms.tsx`
- `src/components/__tests__/AppleDriverSetup.test.tsx`
- `src/components/__tests__/PhoneTypeSelection.test.tsx`
- `src/components/__tests__/KeychainExplanation.test.tsx`

## Files to Read (for context)

- `src/appCore/AppRouter.tsx` - Understand current import/usage pattern
- `src/appCore/AppModals.tsx` - Understand WelcomeTerms usage
- `src/components/onboarding/steps/` - Verify replacements exist
- `src/appCore/state/flows/useAuthFlow.ts` - Check WelcomeTerms reference

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests
- **New tests to write:** None
- **Existing tests to update:** None (deprecated test files are deleted, not updated)
- **Existing tests to verify:** Run `npm test` to confirm no other tests imported the deprecated components

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `chore: remove 6 deprecated components still imported in AppRouter`
- **Branch:** `chore/task-2007-remove-deprecated-components`
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

Implementation:
- [ ] All deprecated imports removed from AppRouter.tsx
- [ ] WelcomeTerms removed from AppModals.tsx
- [ ] All 6 component files deleted
- [ ] All 3 test files deleted
- [ ] Grep confirms zero remaining references
- [ ] Handler props traced and cleaned if orphaned
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Tests pass (npm test)

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
- **Actual Tokens**: ~XK (Est: ~5K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- A deprecated component is NOT actually deprecated (no `@deprecated` tag)
- Removing a handler prop causes type errors in non-deprecated code
- You find the deprecated components are still rendered in a code path that is NOT covered by the onboarding/steps/ replacements
- WelcomeTerms is used in Dashboard.tsx for something other than a dead import
- More than 9 files need deletion (scope may be bigger than expected)
