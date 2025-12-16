# BACKLOG-059: Fix/Enable Skipped Tests (27+ Test Cases)

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BACKLOG-059 |
| **Priority** | Critical |
| **Status** | Pending |
| **Category** | Testing |
| **Sprint** | SPRINT-002 |
| **Date Added** | 2024-12-15 |
| **Date Completed** | - |
| **Branch** | - |
| **Assigned To** | - |
| **Estimated Turns** | 40-60 (split across tasks) |

---

## Description

27+ test cases are currently skipped across 4 critical files. These cover core app functionality including navigation, authentication, onboarding, and sync.

## Skipped Tests Inventory

| File | Skipped | Coverage Gap |
|------|---------|--------------|
| `src/components/__tests__/App.test.tsx` | 13 tests (4 describe blocks) | Core app behavior |
| `electron/services/__tests__/syncOrchestrator.test.ts` | 9+ tests (entire file) | Sync logic |
| `src/components/__tests__/AppleDriverSetup.test.tsx` | 8 tests | Driver setup flow |
| `src/components/__tests__/EmailOnboardingScreen.test.tsx` | 3 tests | Email connection |
| `electron/services/__tests__/deviceDetectionService.test.ts` | 1 test | Device detection |

## Root Causes (from TODO comments)

- Tests need updates for new OnboardingFlow architecture
- Flaky timing issues with fake timers
- Button text/behavior changes not reflected in tests

## Acceptance Criteria

- [ ] All previously skipped tests are running
- [ ] All tests pass (no failures)
- [ ] Tests are not flaky (verified with 3x runs)
- [ ] `npm test` passes with 0 skipped tests in target files
- [ ] No changes to production code

## Sprint Tasks

This backlog item is broken into:
- TASK-201: Fix App.test.tsx (13 tests)
- TASK-202: Fix AppleDriverSetup.test.tsx (8 tests)
- TASK-203: Fix syncOrchestrator.test.ts (9+ tests)
- TASK-204: Fix EmailOnboardingScreen.test.tsx (3 tests)

## Related Items

- SPRINT-001 (Onboarding Refactor) - caused these tests to be skipped
