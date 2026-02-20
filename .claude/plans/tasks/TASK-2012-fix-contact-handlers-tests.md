# TASK-2012: Fix Pre-Existing Contact Handler & App Test Failures

**Backlog ID:** BACKLOG-741
**Sprint:** SPRINT-087
**Phase:** Phase 1.5 - Test Baseline Fix
**Branch:** `fix/task-2012-contact-handlers-tests`
**Estimated Tokens:** ~8K

---

## Objective

Fix 18 failing tests in `electron/__tests__/contact-handlers.test.ts` by updating test mocks to match the contactDbService API changes made during SPRINT-085 (TASK-2003), and fix 1 failing test in `src/components/__tests__/App.test.tsx` caused by PR #883 removing deprecated component routes from AppRouter. These are pre-existing failures on the develop baseline -- they were not introduced by SPRINT-087 Phase 1.5 scope.

---

## Context

During SPRINT-085, the contactDbService was extracted and refactored (BACKLOG-719 / TASK-2003). The method `getImportedContactsByUserIdAsync` was renamed or moved as part of that refactoring, but the test mocks in `contact-handlers.test.ts` were not updated to match the new API surface. This causes 18 of 52 tests in the file to fail.

The contact-handlers failures were discovered during SPRINT-087 Phase 1 SR review when all 3 PRs (#882, #883, #884) inherited the same 18 test failures from develop. The App.test.tsx failure was introduced by PR #883 (TASK-2007, remove deprecated components), which removed the `PhoneTypeStep` route from AppRouter. The "Email Onboarding Flow > should show email onboarding when user has no email connected" test still expects the `PhoneTypeStep` heading "What phone do you use?" in the rendered output.

**Why Phase 1.5:** Phase 2 (CI Hardening) will make tests blocking and add electron tests to CI. If these 18 failures are not fixed first, TASK-2010 (add electron tests to CI) will immediately fail. Fixing them now establishes a clean baseline for Phase 2.

---

## Root Cause

The test file mocks `getImportedContactsByUserIdAsync` on the contactDbService, but SPRINT-085 renamed or restructured this method during the contactDbService extraction. The mock setup no longer matches the actual service interface, causing 18 tests that depend on this mock to fail.

---

## Requirements

### Must Do:

1. **Read `electron/services/contactDbService.ts`** to identify the current method names and signatures that replaced `getImportedContactsByUserIdAsync`.

2. **Update test mocks** in `electron/__tests__/contact-handlers.test.ts` to use the correct current method names. This likely involves:
   - Updating `jest.mock()` or `jest.spyOn()` calls to use the current method name
   - Updating any mock return value setup to match the current method signature
   - Updating any `expect().toHaveBeenCalledWith()` assertions if parameter shapes changed

3. **Fix App.test.tsx** (`src/components/__tests__/App.test.tsx`):
   - Locate the test: "Email Onboarding Flow > should show email onboarding when user has no email connected"
   - This test expects to find the `PhoneTypeStep` heading "What phone do you use?" but PR #883 removed that route from AppRouter
   - Update the test mock/assertion to work with the current AppRouter routing (the phone type step route was removed, so the test needs to assert against a step that still exists in the current flow)
   - Read `src/components/AppRouter.tsx` to understand the current onboarding route structure

4. **Run both test files** to verify fixes:
   ```bash
   npx jest electron/__tests__/contact-handlers.test.ts src/components/__tests__/App.test.tsx --no-coverage
   ```

5. **Run the full test suite** to verify no regressions:
   ```bash
   npm test
   ```

### Must NOT Do:
- Do NOT modify the contactDbService implementation -- only update the tests
- Do NOT change test logic or assertions beyond what is needed to match the new API
- Do NOT delete or skip failing tests
- Do NOT add new tests (scope is strictly fixing existing ones)
- Do NOT modify any files outside `electron/__tests__/contact-handlers.test.ts` and `src/components/__tests__/App.test.tsx`
- Do NOT modify AppRouter.tsx or any production code -- only update test files

---

## Acceptance Criteria

- [ ] All 52 tests in `electron/__tests__/contact-handlers.test.ts` pass
- [ ] The "Email Onboarding Flow" test in `src/components/__tests__/App.test.tsx` passes
- [ ] No new test failures introduced in any other test files
- [ ] `npm test` passes (full suite)
- [ ] `npm run type-check` passes
- [ ] Only `electron/__tests__/contact-handlers.test.ts` and `src/components/__tests__/App.test.tsx` were modified

---

## Files to Modify

- `electron/__tests__/contact-handlers.test.ts` - Update test mocks to match current contactDbService API
- `src/components/__tests__/App.test.tsx` - Update "Email Onboarding Flow" test to match current AppRouter routing

## Files to Read (for context)

- `electron/services/contactDbService.ts` - Current method names and signatures (source of truth)
- `electron/handlers/contactHandlers.ts` - The handlers being tested (to understand how they call contactDbService)
- `src/components/AppRouter.tsx` - Current onboarding route structure (to understand what replaced PhoneTypeStep route)

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests -- this task fixes existing tests
- **New tests to write:** None
- **Existing tests to update:** 18 failing tests (mock updates only)

### CI Requirements
- [ ] All 52 contact-handlers tests pass
- [ ] Full test suite passes (`npm test`)
- [ ] Type check passes (`npm run type-check`)

---

## PR Preparation

- **Title:** `fix: update contact-handlers test mocks and App.test.tsx onboarding assertion`
- **Branch:** `fix/task-2012-contact-handlers-tests`
- **Target:** `develop`

---

## PM Status Updates

PM updates ALL three locations at each transition (engineer does NOT update status):

| When | Status | Where |
|------|--------|-------|
| Engineer assigned | -> `In Progress` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR created + CI passes | -> `Testing` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR merged | -> `Completed` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |

**Backlog IDs to update:** BACKLOG-741

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
- [ ] Read contactDbService.ts to identify current method names
- [ ] Identified renamed/moved methods that tests reference
- [ ] Updated mock setup in contact-handlers.test.ts
- [ ] Updated mock assertions if parameter shapes changed
- [ ] All 52 tests in contact-handlers.test.ts pass
- [ ] Read AppRouter.tsx to understand current onboarding routing
- [ ] Updated App.test.tsx "Email Onboarding Flow" test assertion
- [ ] App.test.tsx Email Onboarding Flow test passes
- [ ] Full test suite passes (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Only contact-handlers.test.ts and App.test.tsx were modified

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

- **Before**: 18 of 52 tests failing in contact-handlers.test.ts + 1 failing in App.test.tsx
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~8K)
- **PR**: https://github.com/5hdaniel/Mad/pull/885

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The method rename is more complex than a simple name change (e.g., method was split into multiple methods, parameters restructured significantly)
- More than `contact-handlers.test.ts` and `App.test.tsx` need to be modified to fix the failures
- You discover additional pre-existing test failures in other test files
- The contactDbService API has changed in ways that require test logic changes (not just mock name updates)
- Fixing the 18 failures causes other tests in the same file to break
- You need to modify the contactDbService implementation to make tests pass
