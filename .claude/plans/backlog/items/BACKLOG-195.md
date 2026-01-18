# BACKLOG-195: Add Test Coverage for Large Hooks

## Summary

Add test coverage for the two largest hooks: `useAuditTransaction.ts` (499 lines) and `useAutoRefresh.ts` (562 lines).

## Problem

These hooks contain substantial business logic with no dedicated tests:
- `src/hooks/useAuditTransaction.ts` (499 lines) - Transaction auditing workflow
- `src/hooks/useAutoRefresh.ts` (562 lines) - Auto-refresh scheduling and execution

Both hooks are critical to core functionality and their size indicates complex logic that needs coverage.

## Current State

| File | Lines | Coverage | Complexity |
|------|-------|----------|------------|
| `useAuditTransaction.ts` | 499 | ~0% | High - audit workflow |
| `useAutoRefresh.ts` | 562 | ~0% | High - scheduling logic |

## Proposed Solution

### useAuditTransaction Tests

Test the audit workflow:
- Initial state
- Step transitions (start -> verify -> assign -> complete)
- Validation at each step
- Error handling
- Data persistence

### useAutoRefresh Tests

Test the refresh mechanism:
- Refresh scheduling
- Refresh execution
- Error recovery
- Interval management
- Component lifecycle (mount/unmount)

### Testing Approach

```typescript
// Example: Testing useAuditTransaction
import { renderHook, act } from '@testing-library/react';
import { useAuditTransaction } from './useAuditTransaction';

describe('useAuditTransaction', () => {
  it('should start in initial step', () => {
    const { result } = renderHook(() => useAuditTransaction());
    expect(result.current.currentStep).toBe('initial');
  });

  it('should validate before step transition', async () => {
    const { result } = renderHook(() => useAuditTransaction());

    // Attempt to advance without required data
    await act(async () => {
      await result.current.nextStep();
    });

    expect(result.current.errors).toContain('Address required');
  });
});
```

## Acceptance Criteria

- [ ] useAuditTransaction has >60% test coverage
- [ ] useAutoRefresh has >60% test coverage
- [ ] Tests cover main workflows
- [ ] Tests cover error cases
- [ ] All existing tests pass

## Priority

**MEDIUM** - Critical path coverage

## Estimate

~50K tokens

## Category

test

## Impact

- Safer hook modifications
- Documents expected workflow behavior
- Prevents regression in critical paths

## Dependencies

None

## Related Items

- BACKLOG-112: Boost Test Coverage for src/hooks/
- BACKLOG-191: Add Test Coverage for Core Service Layer
- BACKLOG-194: Add Test Coverage for Contexts
