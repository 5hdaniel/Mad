# TASK-2007: Remove Deprecated Components from AppRouter

**Backlog ID:** BACKLOG-725
**Sprint:** SPRINT-087
**Phase:** Phase 1 - Code Cleanup
**Branch:** `chore/task-2007-remove-deprecated-components`
**Estimated Tokens:** ~5K

---

## Objective

Remove 5 deprecated legacy components that are still imported in `AppRouter.tsx`. These components were replaced by `onboarding/steps/` equivalents but their old files and imports were never cleaned up. Delete the component files, their test files, and all references.

**CRITICAL: Do NOT touch WelcomeTerms.** It is NOT deprecated — only its `onDecline` prop is. WelcomeTerms is actively used in `AppModals.tsx` for terms acceptance by new users and is wired through 6 layers of the app (DB, cloud, auth handlers, auth context, state machine, UI). Deleting it would break the entire new-user and terms re-acceptance flow.

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

**Import locations found:**

| File | Imports |
|------|---------|
| `src/appCore/AppRouter.tsx` | AppleDriverSetup, KeychainExplanation, PhoneTypeSelection, AndroidComingSoon |
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

2. **Delete deprecated component files:**
   - `src/components/AppleDriverSetup.tsx`
   - `src/components/KeychainExplanation.tsx`
   - `src/components/PhoneTypeSelection.tsx`
   - `src/components/AndroidComingSoon.tsx`
   - `src/components/SetupProgressIndicator.tsx`

3. **Delete associated test files:**
   - `src/components/__tests__/AppleDriverSetup.test.tsx`
   - `src/components/__tests__/PhoneTypeSelection.test.tsx`
   - `src/components/__tests__/KeychainExplanation.test.tsx`

4. **Verify no other imports remain** after deletion:
   ```bash
   grep -r "AppleDriverSetup\|KeychainExplanation\|PhoneTypeSelection\|AndroidComingSoon\|SetupProgressIndicator" --include="*.ts" --include="*.tsx" src/
   ```
   This should return zero results (excluding any comments in this task file).

**OUT OF SCOPE:** Handler cleanup in flow hooks (`usePhoneHandlers.ts`, `useSecureStorage.ts`, etc.) that contain `if (!USE_NEW_ONBOARDING)` guards. These are legacy code paths but removing them requires tracing through 14+ files — too risky for a cleanup sprint. Create a follow-up backlog item for removing `USE_NEW_ONBOARDING` legacy code paths.

### Must NOT Do:
- Do NOT touch `WelcomeTerms.tsx` or `AppModals.tsx` — WelcomeTerms is NOT deprecated and is actively used
- Do NOT modify or delete the onboarding/steps/ replacement components
- Do NOT change the onboarding flow logic or state machine
- Do NOT remove handler functions from flow hooks (usePhoneHandlers, useSecureStorage, etc.) — defer to follow-up
- Do NOT add any new functionality

---

## Acceptance Criteria

- [ ] All 5 deprecated component files deleted
- [ ] All 3 associated test files deleted
- [ ] WelcomeTerms.tsx and AppModals.tsx are UNTOUCHED
- [ ] No imports of deprecated components remain in any .ts/.tsx file
- [ ] `npm run type-check` passes (no missing import errors)
- [ ] `npm run lint` passes
- [ ] `npm test` passes with no failures
- [ ] Onboarding flow replacement components are untouched

---

## Files to Modify

- `src/appCore/AppRouter.tsx` - Remove 4 deprecated imports and their JSX usage

## Files to Delete

- `src/components/AppleDriverSetup.tsx`
- `src/components/KeychainExplanation.tsx`
- `src/components/PhoneTypeSelection.tsx`
- `src/components/AndroidComingSoon.tsx`
- `src/components/SetupProgressIndicator.tsx`
- `src/components/__tests__/AppleDriverSetup.test.tsx`
- `src/components/__tests__/PhoneTypeSelection.test.tsx`
- `src/components/__tests__/KeychainExplanation.test.tsx`

## Files NOT to Touch

- `src/components/WelcomeTerms.tsx` — NOT deprecated, actively used for terms acceptance
- `src/appCore/AppModals.tsx` — renders WelcomeTerms, must remain unchanged

## Files to Read (for context)

- `src/appCore/AppRouter.tsx` - Understand current import/usage pattern
- `src/components/onboarding/steps/` - Verify replacements exist

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

- **Title:** `chore: remove 5 deprecated components still imported in AppRouter`
- **Branch:** `chore/task-2007-remove-deprecated-components`
- **Target:** `develop`

---

## PM Status Updates

PM updates ALL three locations at each transition (engineer does NOT update status):

| When | Status | Where |
|------|--------|-------|
| Engineer assigned | → `In Progress` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR created + CI passes | → `Testing` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR merged | → `Completed` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |

**Backlog IDs to update:** BACKLOG-725

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-19*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] All 4 deprecated imports removed from AppRouter.tsx
- [ ] WelcomeTerms and AppModals.tsx confirmed UNTOUCHED
- [ ] All 5 component files deleted
- [ ] All 3 test files deleted
- [ ] Grep confirms zero remaining references (excluding WelcomeTerms)
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
- **PR**: https://github.com/5hdaniel/Mad/pull/883

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- A deprecated component is NOT actually deprecated (no `@deprecated` tag)
- Removing imports from AppRouter causes type errors in non-deprecated code
- You find the deprecated components are still rendered in a code path that is NOT covered by the onboarding/steps/ replacements
- More than 8 files need deletion (scope may be bigger than expected)
- You feel tempted to touch WelcomeTerms, AppModals.tsx, or any flow hooks — these are OUT OF SCOPE
