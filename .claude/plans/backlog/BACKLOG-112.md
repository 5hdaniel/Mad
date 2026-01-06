# BACKLOG-112: Boost Test Coverage for src/hooks/

## Priority: Medium

## Category: test

## Summary

Increase test coverage for `src/hooks/` from 13.83% to target of 80%.

## Problem

The hooks directory has critically low test coverage at 13.83%. Hooks contain critical business logic and state management that need comprehensive testing to prevent regressions.

**Current State:**
- Coverage: 13.83%
- Target: 80%
- Gap: 66.17 percentage points

## Solution

Systematically add tests for all hooks in `src/hooks/`.

### Priority Order

1. **High-Impact Hooks** (used by many components)
   - `useAppStateMachine.ts` - Core app state (tests added in TASK-614, verify coverage)
   - `useAuth.ts` - Authentication state
   - `useDatabase.ts` - Database operations

2. **Business Logic Hooks**
   - Any hooks with complex logic or calculations
   - Hooks with side effects

3. **UI State Hooks**
   - Form state hooks
   - Modal state hooks
   - Filter/sort hooks

### Testing Patterns

```typescript
import { renderHook, act } from '@testing-library/react';
import { useExample } from './useExample';

describe('useExample', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useExample());
    expect(result.current.value).toBe(defaultValue);
  });

  it('should update state on action', () => {
    const { result } = renderHook(() => useExample());
    act(() => {
      result.current.updateValue('new value');
    });
    expect(result.current.value).toBe('new value');
  });
});
```

## Implementation Steps

1. List all hooks in `src/hooks/`
2. Check existing coverage for each
3. Create test files for untested hooks
4. Add tests systematically
5. Track coverage improvement

## Acceptance Criteria

- [ ] `src/hooks/` coverage >= 80%
- [ ] All exported hook functions have at least one test
- [ ] Edge cases tested for complex hooks
- [ ] Mock external dependencies appropriately
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 40-60 | Many hooks to test |
| Tokens | ~150K | |
| Time | 1-2 days | |

## Dependencies

- BACKLOG-107 (useAppStateMachine split) may affect this work
- Consider doing after BACKLOG-107 to avoid testing code that will be refactored

## Risks

| Risk | Mitigation |
|------|------------|
| Hooks have complex dependencies | Use proper mocking |
| BACKLOG-107 changes hook structure | Sequence appropriately |

## Notes

**This item is SR Engineer sourced from coverage audit.**

Consider combining this with BACKLOG-107 (useAppStateMachine split) - test coverage can be added as part of the extraction process.

**Files to test:**
- `src/hooks/*.ts`
- `src/hooks/**/*.ts` (if nested structure)
