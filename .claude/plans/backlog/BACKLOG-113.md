# BACKLOG-113: Boost Test Coverage for src/utils/

## Priority: Medium

## Category: test

## Summary

Increase test coverage for `src/utils/` from 46.96% to target of 80%.

## Problem

The utils directory has moderate test coverage at 46.96%. Utility functions are often pure functions that should be easy to test and are frequently reused across the codebase.

**Current State:**
- Coverage: 46.96%
- Target: 80%
- Gap: 33.04 percentage points

## Solution

Add comprehensive tests for all utility functions in `src/utils/`.

### Testing Strategy

1. **Identify uncovered utilities**
   - Run coverage report with `--coverage` flag
   - List all utilities with <80% coverage

2. **Prioritize by usage**
   - Test heavily-used utilities first
   - Focus on utilities with complex logic

3. **Test patterns for utilities**
   - Input/output validation
   - Edge cases (null, undefined, empty)
   - Error conditions
   - Boundary values

### Example Test Pattern

```typescript
import { formatCurrency, parseCurrency } from './currencyUtils';

describe('currencyUtils', () => {
  describe('formatCurrency', () => {
    it('should format positive amounts', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
    });

    it('should handle undefined', () => {
      expect(formatCurrency(undefined)).toBe('$0.00');
    });
  });
});
```

## Implementation Steps

1. Run coverage report: `npm test -- --coverage`
2. Identify utils below 80% coverage
3. Create/update test files
4. Add comprehensive tests
5. Verify coverage improvement

## Acceptance Criteria

- [ ] `src/utils/` coverage >= 80%
- [ ] All exported functions have tests
- [ ] Edge cases covered (null, undefined, empty, boundary)
- [ ] Error handling tested
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 20-30 | Utils are typically easy to test |
| Tokens | ~80K | |
| Time | 1 day | |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Complex utilities with external dependencies | Mock appropriately |
| Time-dependent utilities | Use fake timers |

## Notes

**This item is SR Engineer sourced from coverage audit.**

Utility functions are often pure and straightforward to test. This should be a relatively quick win for coverage improvement.

**Files to test:**
- `src/utils/*.ts`
- `src/utils/**/*.ts` (if nested structure)
