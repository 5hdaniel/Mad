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

## Current State

```
src/hooks/: 26.3% statements
Key gaps:
- useIPhoneSync.ts (593 lines) - Complex sync logic
- useExportWizard.ts - Export workflow
- useTransactionValidation.ts - Validation rules
```

## Deliverables

1. **Analyze coverage** - Run coverage report, identify lowest-covered hooks
2. **Prioritize** - Focus on hooks with complex logic and low coverage
3. **Write tests** - Add tests for top 5 hooks
4. **Verify** - Achieve 50%+ coverage for src/hooks/

## Target Hooks (Priority Order)

1. `useIPhoneSync.ts` - Most complex, most lines
2. `useExportWizard.ts` - User-facing workflow
3. `useTransactionValidation.ts` - Business logic
4. Other hooks with <30% coverage

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

- [ ] src/hooks/ coverage ≥50%
- [ ] Tests for top 5 hooks added
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
