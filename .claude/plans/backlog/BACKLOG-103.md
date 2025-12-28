# BACKLOG-103: Fix Flaky Performance Benchmark Test

## Priority: Low

## Category: test

## Summary

The `performance-benchmark.test.ts` scalability test is flaky, failing intermittently due to variable test environment performance. Either make the test informational (not a CI blocker) or adjust thresholds.

## Origin

SPRINT-009 Retrospective - Identified during sprint execution.

## Current State

The scalability test in `performance-benchmark.test.ts` has strict timing thresholds that can fail on slower CI runners or when running alongside other tests. This creates false negatives that block legitimate PRs.

## Problem

1. **Variable CI Performance**: CI runners have inconsistent performance
2. **Strict Thresholds**: Current thresholds don't account for environment variability
3. **False Negatives**: Legitimate code changes blocked by timing failures

## Proposed Solutions

### Option A: Make Informational (Recommended)

Convert the test to skip in CI but run locally:
```typescript
describe.skipIf(process.env.CI)('Scalability benchmarks (informational)', () => {
  // Keep tests but don't block CI
});
```

### Option B: Adjust Thresholds

Increase thresholds by 50-100% to account for CI variability:
```typescript
// Current: expect(time).toBeLessThan(1000);
// Updated: expect(time).toBeLessThan(2000);
```

### Option C: Statistical Approach

Run benchmark multiple times and use median/p95 instead of single run.

## Acceptance Criteria

- [ ] Performance benchmark test no longer causes CI flakiness
- [ ] Test still provides value for detecting performance regressions (locally or with adjusted thresholds)
- [ ] `npm test` passes reliably (10 consecutive runs without failure)
- [ ] Decision documented in code comments

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Turns | 2-3 | Simple test modification |
| Tokens | ~10K | |
| Time | ~20 min | |

## Dependencies

None

## Files to Modify

- `src/__tests__/performance-benchmark.test.ts` or similar location

## Notes

SPRINT-009 showed 0 CI failures, but this issue was flagged during review. Proactive fix to prevent future flakiness.
