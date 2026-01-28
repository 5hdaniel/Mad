# Task TASK-1055: Add CI Coverage Thresholds

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Configure Jest and CI to enforce coverage thresholds, preventing coverage regression. CI builds should fail if coverage drops below 40% statements / 30% branches.

## Non-Goals

- Do NOT add new tests (TASK-1054 handles that)
- Do NOT modify existing test behavior
- Do NOT add per-file coverage thresholds beyond what exists
- Do NOT change how tests run (only how coverage is reported/enforced)
- Do NOT add external coverage services (Codecov already configured)

## Deliverables

1. Update: `jest.config.js` - Update global coverage thresholds
2. Update: `.github/workflows/ci.yml` - Ensure coverage enforcement
3. Document: Add comments explaining threshold strategy

## Acceptance Criteria

- [ ] Jest config has `coverageThreshold.global` set to >= 40% statements, >= 30% branches
- [ ] `npm test -- --coverage` fails if coverage is below thresholds
- [ ] CI pipeline fails if coverage thresholds not met
- [ ] Coverage report is uploaded to Codecov (existing behavior preserved)
- [ ] All CI checks pass
- [ ] Comments document the threshold strategy

## Implementation Notes

### Current Jest Configuration

The current `jest.config.js` already has coverage thresholds:

```javascript
coverageThreshold: {
  global: {
    branches: 30,
    functions: 40,
    lines: 45,
    statements: 45,
  },
  // Per-path thresholds exist for src/utils, src/hooks, electron/utils
},
```

**Note:** These thresholds are ALREADY higher than our targets (40% statements / 30% branches). The issue is that tests are failing, so coverage isn't being measured correctly.

### Required Changes

1. **Verify thresholds are appropriate:**
   - After TASK-1053 and TASK-1054, coverage should meet these thresholds
   - If not, adjust thresholds to match achieved coverage (minimum 40% statements, 30% branches)

2. **Ensure CI enforces thresholds:**
   - Check that `npm test` in CI runs with coverage
   - Verify test command includes coverage flags

3. **Document threshold strategy:**
   - Add comments explaining why these thresholds were chosen
   - Document path for increasing thresholds over time

### Jest Coverage Configuration

```javascript
// jest.config.js

// Coverage thresholds - CI will fail if coverage drops below these
// Strategy: Conservative global thresholds with stricter per-path rules
// for critical utilities
coverageThreshold: {
  global: {
    // Minimum coverage to prevent regression
    // Target: Increase by 5% per quarter
    statements: 40,  // SPRINT-037 baseline
    branches: 30,    // SPRINT-037 baseline
    functions: 35,   // Derived from statements target
    lines: 40,       // Derived from statements target
  },
  // Higher standards for pure utility code (easier to test)
  './src/utils/': {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  './src/hooks/': {
    branches: 60,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  './electron/utils/': {
    branches: 50,
    functions: 60,
    lines: 55,
    statements: 55,
  },
},
```

### CI Workflow Configuration

Verify `.github/workflows/ci.yml` includes coverage:

```yaml
- name: Run tests
  run: npm test -- --coverage --silent --maxWorkers=2
  # Coverage thresholds in jest.config.js will cause this to fail
  # if coverage drops below configured minimums
```

### Coverage Reporting

Current setup uploads to Codecov on macOS/Node 20:

```yaml
- name: Upload coverage to Codecov
  if: matrix.os == 'macos-latest' && matrix.node-version == '20.x'
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
```

This should continue working - no changes needed.

## Integration Notes

- Imports from: None (configuration only)
- Exports to: CI pipeline
- Used by: All PRs, all branches
- Depends on: TASK-1054 (coverage must meet thresholds first)

## Do / Don't

### Do:

- Verify current thresholds after TASK-1054 completes
- Add clear comments explaining the threshold strategy
- Test locally that thresholds are enforced (`npm test -- --coverage`)
- Keep per-path thresholds for critical utility code

### Don't:

- Don't lower thresholds below 40% statements / 30% branches
- Don't add overly aggressive thresholds that will fail frequently
- Don't remove existing per-path thresholds
- Don't change how Codecov integration works
- Don't modify test execution (only coverage configuration)

## When to Stop and Ask

- If current coverage is below 40% statements after TASK-1054
- If per-path thresholds cause CI failures
- If Codecov integration breaks
- If coverage reporting changes affect other workflows

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (configuration-only task)
- New tests to write: None
- Existing tests to update: None

### Coverage

- Coverage impact: No change (configuration only)
- Enforcement: CI will fail if coverage drops below thresholds

### Integration / Feature Tests

- Not required

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests (with coverage thresholds enforced)
- [x] Type checking
- [x] Lint / format checks
- [x] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `ci(coverage): enforce coverage thresholds in CI pipeline`
- **Labels**: `ci`, `technical-debt`, `coverage`
- **Depends on**: TASK-1054 (coverage targets must be met first)

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~10K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 (jest.config.js, ci.yml) | +5K |
| Configuration changes | Minor adjustments | +3K |
| Documentation | Comments and verification | +5K |
| Testing | Local verification | +2K |

**Confidence:** High

**Risk factors:**
- Minimal risk - configuration only
- May need threshold adjustments based on TASK-1054 results

**Similar past tasks:** Config tasks typically run ~8-12K tokens

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] jest.config.js (thresholds verified/updated)
- [ ] .github/workflows/ci.yml (coverage enforcement verified)

Configuration verification:
- [ ] npm test -- --coverage passes locally
- [ ] Coverage thresholds are documented with comments
- [ ] npm run type-check passes
- [ ] npm run lint passes
```

### Final Coverage Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Statements | X% | SPRINT-037 baseline |
| Branches | X% | SPRINT-037 baseline |
| Functions | X% | Derived from statements |
| Lines | X% | Derived from statements |

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~12K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~12K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A (configuration only)
**Test Coverage:** Thresholds enforced

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
