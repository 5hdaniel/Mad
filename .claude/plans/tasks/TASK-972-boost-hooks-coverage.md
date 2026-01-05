# TASK-972: Boost src/hooks/ Test Coverage

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-112
**Status:** Ready
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

- [ ] src/hooks/ coverage >=40% (stretch: 50%)
- [ ] New test files for useTransactionStatusUpdate.ts and useToast.ts
- [ ] Expanded tests for useIPhoneSync.ts (most lines = most impact)
- [ ] All tests pass (no flaky tests)
- [ ] Tests cover error paths and edge cases

## Engineer Metrics

**Agent ID:** _[Record immediately when Task tool returns]_

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 80K) / 80K × 100]_%
