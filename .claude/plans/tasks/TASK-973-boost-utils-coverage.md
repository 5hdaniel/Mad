# TASK-973: Boost src/utils/ Test Coverage

**Sprint:** SPRINT-024
**Backlog:** BACKLOG-113
**Status:** Ready
**Estimate:** ~50K tokens
**Token Cap:** 150K
**Can Parallelize With:** TASK-972

---

## Context

`src/utils/` has 50% statement coverage (target: 80%). Utility functions should have high coverage as they're used throughout the codebase.

## Current State

```
src/utils/: 50% statements
Target: 80%
Gap: 30 percentage points
```

## Deliverables

1. **Analyze coverage** - Run coverage report for src/utils/
2. **Identify gaps** - Find utility functions with low/no coverage
3. **Write tests** - Add comprehensive tests
4. **Verify** - Achieve 75%+ coverage

## Testing Approach

```typescript
import { formatDate, parseAddress, validateEmail } from '../utils';

describe('formatDate', () => {
  it('formats ISO date correctly', () => {
    expect(formatDate('2026-01-04T12:00:00Z')).toBe('Jan 4, 2026');
  });

  it('handles null gracefully', () => {
    expect(formatDate(null)).toBe('');
  });

  it('handles invalid date', () => {
    expect(formatDate('invalid')).toBe('Invalid Date');
  });
});
```

## Branch

```bash
git checkout -b test/TASK-973-utils-coverage develop
```

## Worktree (If Parallel)

```bash
git worktree add ../Mad-task-973 -b test/TASK-973-utils-coverage develop
cd ../Mad-task-973
```

## Verification

```bash
npm test -- --coverage --collectCoverageFrom="src/utils/**/*.ts"
```

## Acceptance Criteria

- [ ] src/utils/ coverage ≥75%
- [ ] Edge cases covered (null, undefined, invalid input)
- [ ] All tests pass
- [ ] No duplicate test logic

## Engineer Metrics

**Agent ID:** _[Record immediately when Task tool returns]_

| Metric | Value |
|--------|-------|
| Total Tokens | _[From SubagentStop]_ |
| Duration | _[From SubagentStop]_ |
| API Calls | _[From SubagentStop]_ |

**Variance:** _[(Actual - 50K) / 50K × 100]_%
