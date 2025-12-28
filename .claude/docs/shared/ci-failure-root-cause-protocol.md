# CI Failure Root Cause Analysis Protocol

This protocol ensures that CI failures are properly investigated rather than masked by tolerance adjustments or skipped tests.

---

## Core Principle

**Never adjust test tolerances, skip tests, or increase timeouts without first investigating and documenting the root cause.**

When a test fails, there are only two valid outcomes:
1. **Fix the code** - The test caught a real issue
2. **Fix the test** - The test has a genuine flaw (not "it's flaky")

Adjusting tolerances or adding `CI_TOLERANCE` multipliers is a **code smell** that often masks real issues.

---

## When CI Fails: Required Steps

### Step 1: Classify the Failure Type

| Type | Description | Example |
|------|-------------|---------|
| **Performance** | Test timing/ratio assertions fail | `ratio < 15` fails with 18x |
| **Flaky** | Test passes sometimes, fails others | Race conditions, timeouts |
| **Environment** | Only fails on specific CI runner | Windows-only, macOS-only |
| **Regression** | Previously passing test now fails | New code broke something |
| **Infrastructure** | CI system issues | Network, disk, memory |

### Step 2: Investigate Root Cause

**For Performance Failures:**

```bash
# 1. Run the test locally with profiling
npm test -- --testNamePattern="scalability" --verbose

# 2. If ratio-based test fails, calculate actual complexity
# Example: If 800 emails takes 18x longer than 100 emails (not 8x), this suggests O(n^2)

# 3. Profile the specific function
# Add console.time/timeEnd around suspect functions
```

**Questions to answer:**
- What is the actual time complexity? (O(n), O(n log n), O(n²))
- Did recent changes introduce inefficiency?
- Is the baseline measurement reliable?
- Are we comparing apples to apples (same machine state)?

**For Flaky Tests:**

```bash
# Run the test multiple times to confirm flakiness
for i in {1..10}; do npm test -- --testNamePattern="your-test"; done
```

**Questions to answer:**
- Is there a race condition?
- Is there shared state between tests?
- Is there a timing assumption that doesn't hold?

### Step 3: Document Findings

Before making ANY changes to tolerances or test assertions, document:

```markdown
## CI Failure Analysis

**Test:** [test file:line]
**Failure Type:** [Performance/Flaky/Environment/Regression/Infrastructure]
**Observed Behavior:** [What actually happened]
**Expected Behavior:** [What the test expected]

### Root Cause Investigation

**Hypothesis 1:** [Description]
- Evidence for: [data points]
- Evidence against: [data points]
- Conclusion: [Confirmed/Rejected/Needs more data]

**Hypothesis 2:** [Description]
...

### Recommended Action

[ ] Fix the code - [describe what needs to change]
[ ] Fix the test - [describe why test is genuinely flawed]
[ ] Create backlog item - [for larger fixes]
[ ] Infrastructure issue - [escalate appropriately]

### If Tolerance Adjustment is Proposed

**Why tolerance adjustment is the RIGHT solution (all must be true):**
- [ ] Root cause is genuinely environmental (not algorithmic)
- [ ] The tolerance matches observed variance (not arbitrary)
- [ ] No performance regression is being masked
- [ ] The test still provides value at the new tolerance

**Data supporting tolerance value:**
- Local run times: [list]
- CI run times: [list]
- Variance: [calculated]
- Proposed tolerance: [value] (based on: [justification])
```

---

## Performance Test Guidelines

### Ratio Tests (Scalability)

When a test checks scaling ratio (e.g., "800 emails shouldn't take more than Xx longer than 100 emails"):

| Observed Ratio | Likely Cause | Action |
|----------------|--------------|--------|
| ~8x (for 8x more data) | O(n) - Linear | Test is correct |
| ~16x-24x | O(n log n) | May be acceptable, document |
| ~64x | O(n²) - Quadratic | **Investigate algorithm** |
| Variable (10x-50x) | Cold start / GC / CI variance | Add warm-up, stabilize test |

### Timing Tests

For absolute timing tests (e.g., "must complete in <5 seconds"):

1. **Prefer ratio tests over absolute times** - More stable across machines
2. **If absolute times needed**, document the baseline machine specs
3. **CI_TOLERANCE should reflect measured variance**, not arbitrary multiplier

**Bad example:**
```typescript
// CI is slow, so 2x tolerance should work
const CI_TOLERANCE = process.env.CI ? 2.0 : 1.0;
```

**Good example:**
```typescript
// CI variance measured over 50 runs:
// - Local: 120ms ± 15ms
// - CI macOS: 180ms ± 25ms
// - CI Windows: 350ms ± 80ms
// Tolerance = max observed / baseline = 350/120 = 2.9, round to 3.0
const CI_TOLERANCE = process.env.CI ? 3.0 : 1.0;
```

---

## Creating Backlog Items for CI Issues

When investigation reveals a genuine issue that can't be fixed immediately:

### Required Information

1. **Title:** `CI: [Test Name] - [Root Cause Summary]`
2. **Category:** `test` or `infra`
3. **Priority:** Based on impact
   - **Critical**: CI blocks all PRs
   - **High**: CI fails >30% of runs
   - **Medium**: CI fails occasionally, workaround exists
   - **Low**: Minor timing variance

### Backlog Template

```markdown
# BACKLOG-XXX: CI - [Specific Issue]

## Problem Statement

[Test name] fails on CI with [specific symptom].

## Root Cause Analysis

**Investigation conducted:** [date]
**Analysis document:** [link if separate]

**Root cause:** [One sentence summary]

**Evidence:**
- [Data point 1]
- [Data point 2]

## Current Workaround

[If any tolerance was added, explain why it's temporary]

## Proper Fix

**Option A:** [Description, pros, cons]
**Option B:** [Description, pros, cons]

**Recommended:** [Which option and why]

## Acceptance Criteria

- [ ] Test passes without CI_TOLERANCE adjustments
- [ ] Performance meets documented baseline
- [ ] No regression in [related areas]
```

---

## Anti-Patterns to Avoid

### 1. Tolerance Creep
```typescript
// DON'T: Incrementally raise tolerance each time CI fails
const CI_TOLERANCE = 1.5; // v1
const CI_TOLERANCE = 2.0; // v2 - CI still slow
const CI_TOLERANCE = 3.0; // v3 - maybe this works?
```

### 2. Skipping "Flaky" Tests
```typescript
// DON'T: Skip without investigation
it.skip('should scale linearly', () => { ... }); // flaky on CI
```

### 3. Arbitrary Thresholds
```typescript
// DON'T: Pick numbers without data
expect(ratio).toBeLessThan(15); // "15 seems safe"

// DO: Justify the threshold
// Linear scaling = 8x for 8x data
// Allow 50% overhead for GC/caching = 12x
// Add 20% CI variance buffer = 14.4, round to 15x
expect(ratio).toBeLessThan(15);
```

### 4. Blaming CI
```typescript
// DON'T: Assume CI is always the problem
// Windows CI is slow → add tolerance

// DO: Verify the algorithm scales correctly first
```

---

## Escalation Path

1. **First failure**: Engineer investigates using this protocol
2. **Repeated failures**: SR Engineer reviews investigation
3. **Pattern across multiple tests**: Create backlog item, PM prioritizes
4. **Blocking CI**: Hotfix if possible, otherwise temporary skip with backlog item

---

## Integration with PR Review

**SR Engineer MUST verify before approving PRs that modify test tolerances:**

- [ ] Root cause documented
- [ ] Tolerance value justified with data
- [ ] Backlog item created if proper fix needed
- [ ] No performance regression masked

**If tolerance adjustment lacks justification, BLOCK the PR.**
