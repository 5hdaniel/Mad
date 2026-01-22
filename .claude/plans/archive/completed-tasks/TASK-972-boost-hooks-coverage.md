# TASK-972: Boost src/hooks/ Test Coverage

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-112
**Status:** Complete
**Estimate:** ~80K tokens
**Token Cap:** 200K
**Can Parallelize With:** TASK-973

---

## Context

`src/hooks/` has 26.3% statement coverage (target: 60%+). This is a significant gap that reduces confidence in refactoring.

## Current State (SR Engineer Verified 2026-01-04)

```
src/hooks/: 26.3% statements (7 hooks total, 1173 lines)

Hooks by size (lines):
1. useIPhoneSync.ts          - 593 lines (50.5%) - Has tests, expand coverage
2. useTransactionStatusUpdate.ts - 195 lines (16.6%) - NO TESTS
3. useToast.ts               - 89 lines (7.6%)  - NO TESTS
4. useConversations.ts       - 88 lines (7.5%)  - Has tests, expand
5. usePendingTransactionCount.ts - 77 lines (6.6%) - Has tests, expand
6. useTour.ts                - 68 lines (5.8%)  - Has tests
7. useSelection.ts           - 63 lines (5.4%)  - Has tests
```

**CRITICAL CORRECTION:** Previous task referenced hooks that DO NOT EXIST:
- ~~useExportWizard.ts~~ - NOT FOUND
- ~~useTransactionValidation.ts~~ - NOT FOUND

## Deliverables

1. **Analyze coverage** - Run coverage report, identify lowest-covered hooks
2. **Prioritize** - Focus on hooks WITHOUT tests first, then expand existing
3. **Write tests** - Add tests for hooks without coverage, expand others
4. **Verify** - Achieve 40%+ coverage (stretch: 50%) for src/hooks/

## Target Hooks (Priority Order)

| Priority | Hook | Lines | Has Tests? | Action |
|----------|------|-------|------------|--------|
| 1 | `useIPhoneSync.ts` | 593 | Yes | Expand - most complex hook |
| 2 | `useTransactionStatusUpdate.ts` | 195 | **NO** | Create new test file |
| 3 | `useToast.ts` | 89 | **NO** | Create new test file |
| 4 | `useConversations.ts` | 88 | Yes | Expand existing tests |
| 5 | `usePendingTransactionCount.ts` | 77 | Yes | Expand existing tests |

**Note:** useTour.ts and useSelection.ts have tests and are small - lower priority.

## Testing Approach

```typescript
import { renderHook, act } from '@testing-library/react';
import { useIPhoneSync } from '../useIPhoneSync';

// Mock IPC
jest.mock('../../preload', () => ({
  window: {
    api: {
      device: { /* mocks */ }
    }
  }
}));

describe('useIPhoneSync', () => {
  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useIPhoneSync());
    expect(result.current.status).toBe('idle');
  });

  // Test state transitions, error handling, etc.
});
```

## Branch

```bash
git checkout -b test/TASK-972-hooks-coverage develop
```

## Worktree (If Parallel)

```bash
git worktree add ../Mad-task-972 -b test/TASK-972-hooks-coverage develop
cd ../Mad-task-972
```

## Verification

```bash
npm test -- --coverage --collectCoverageFrom="src/hooks/**/*.ts"
```

## Acceptance Criteria

- [x] src/hooks/ coverage >=40% (stretch: 50%) - **ACHIEVED: 92.97%**
- [x] New test files for useTransactionStatusUpdate.ts and useToast.ts
- [x] Expanded tests for useIPhoneSync.ts (most lines = most impact)
- [x] All tests pass (no flaky tests)
- [x] Tests cover error paths and edge cases

---

## Implementation Summary

**Completed:** 2026-01-04
**PR:** #324

### Coverage Results

| Hook | Before | After |
|------|--------|-------|
| useConversations.ts | ~100% | 100% |
| useIPhoneSync.ts | minimal | 88.58% |
| usePendingTransactionCount.ts | ~93% | 93.54% |
| useSelection.ts | 100% | 100% |
| useToast.ts | 0% | 100% |
| useTour.ts | 100% | 100% |
| useTransactionStatusUpdate.ts | 0% | 100% |
| **Overall src/hooks/** | **26.3%** | **92.97%** |

### New Test Files

1. **useTransactionStatusUpdate.test.ts** (310+ lines)
   - Initialization tests
   - Approve operation (success, failure, no userId, callbacks)
   - Reject operation (with/without reason, callbacks)
   - Restore operation (success, error handling)
   - clearError functionality
   - Concurrent operations
   - userId dependency handling

2. **useToast.test.ts** (290+ lines)
   - Initialization tests
   - showToast with types and auto-dismiss
   - showSuccess, showError, showWarning helpers
   - removeToast functionality
   - clearAll functionality
   - Custom auto-dismiss timeout
   - Edge cases (empty message, long messages, special chars)

### Expanded Tests

3. **useIPhoneSync.test.ts** (expanded from ~130 to 980 lines)
   - Sync API path (vs device API fallback)
   - Device connection/disconnection events
   - Progress handling and phase mapping
   - Password and passcode flows
   - Sync error handling
   - Sync complete and storage complete events
   - startSync with device, blocking, and errors
   - submitPassword flows
   - cancelSync functionality
   - checkSyncStatus polling
   - Device disconnect during sync (safe vs unsafe phases)

### Deviations

None - implemented as specified.

### Issues Encountered

1. **jest-environment-jsdom missing** - Had to install it in the worktree
2. **Infinite timer loop** - Fixed test that used `jest.runAllTimers()` with polling interval

## Engineer Metrics

**Agent ID:** a837038

| Metric | Value |
|--------|-------|
| Total Tokens | (auto-captured) |
| Duration | (auto-captured) |
| API Calls | (auto-captured) |

**Variance:** Pending final capture

---

## SR Engineer Review

**Reviewed:** 2026-01-05
**PR:** #324 (Merged)
**Reviewer Agent ID:** sr-review-972

### Review Checklist

- [x] Engineer Agent ID present: a837038
- [x] Implementation Summary complete
- [x] All acceptance criteria met
- [x] CI passed on all platforms

### CI Results

| Check | Status |
|-------|--------|
| Check Changes | pass |
| Test & Lint (macOS, Node 20) | pass |
| Test & Lint (Windows, Node 20) | pass |
| Security Audit | pass |
| Build Application (macOS) | pass |
| Build Application (Windows) | pass |
| Validate PR Metrics | pass |

### Test Quality Assessment

| Test File | Lines | Quality |
|-----------|-------|---------|
| useTransactionStatusUpdate.test.ts | 648 | Excellent |
| useToast.test.ts | 445 | Excellent |
| useIPhoneSync.test.ts | +847 | Excellent |

**Total additions:** 1,940 lines of test code

### Architecture Impact

None - pure test coverage improvement.

### Summary

Outstanding work. Coverage target was 40%, achieved 93% (233% of target). Tests follow React Testing Library best practices with proper async handling, fake timers, and comprehensive edge case coverage. The useIPhoneSync tests are particularly well-structured given the complexity of that hook (593 lines, 12+ event handlers).

**APPROVED and MERGED** via traditional merge to develop.
