# TASK-2011: Raise CI Test Coverage Threshold to 40%

**Backlog ID:** BACKLOG-730
**Sprint:** SPRINT-087
**Phase:** Phase 2 - CI Hardening
**Branch:** `ci/task-2011-coverage-threshold-40`
**Estimated Tokens:** ~5K

---

## Objective

Raise the CI test coverage threshold from the current 24% baseline to 40% (or the highest realistic value achievable with the newly-included electron tests from TASK-2010). This is an important signal to a due diligence reviewer that the project actively enforces and improves test coverage.

---

## Context

The coverage thresholds were set in SPRINT-037:

```javascript
// jest.config.js - CI thresholds
coverageThreshold: process.env.CI ? {
  global: {
    branches: 24,
    functions: 24,
    lines: 24,
    statements: 24,
  },
  // Per-path thresholds for utility code
} : { ... }
```

After TASK-2010 adds electron tests to CI, the measured coverage should increase because 116 test files covering backend code will now contribute to the global coverage numbers. The goal is to measure the new baseline and set thresholds at or near 40%.

---

## Requirements

### Must Do:

1. **Measure current CI coverage** with electron tests included (after TASK-2010 is merged):
   ```bash
   CI=true npm test -- --coverage --silent 2>&1 | tail -20
   ```
   Record the actual coverage numbers for branches, functions, lines, statements.

2. **Set global thresholds** based on measured coverage:
   - If coverage >= 42%: Set threshold to 40% (leaves 2% margin for variance)
   - If coverage 35-41%: Set threshold to measured - 2%
   - If coverage < 35%: Set threshold to measured - 2%, document gap to 40% in PR, and identify which areas need tests

3. **Update per-path thresholds** proportionally:
   - `src/hooks/`: If currently at 24%, raise proportionally
   - `src/utils/`: Same approach
   - Add `electron/utils/`: Set threshold based on measured coverage

4. **Add a comment** in jest.config.js documenting the new baseline:
   ```javascript
   // SPRINT-087: Raised from 24% to X% after including electron tests in CI
   // Target: 40% by [next quarter]
   // Path to 40%: [areas needing coverage]
   ```

5. **If coverage is below 40%, identify the gap** and document which modules/files have the lowest coverage to guide future test writing. Add this to the PR description.

### Must NOT Do:
- Do NOT write new tests to fill coverage gaps (that is future work)
- Do NOT lower any existing per-path thresholds
- Do NOT modify test files
- Do NOT change coverage collection patterns (those were set in TASK-2010)
- Do NOT set thresholds higher than measured coverage minus 2% (CI will flake)

---

## Acceptance Criteria

- [ ] Global coverage thresholds raised from 24% to at least 35% (ideally 40%)
- [ ] Per-path thresholds updated proportionally
- [ ] Comment in jest.config.js documents new baseline and SPRINT-087 reference
- [ ] `CI=true npm test -- --coverage` passes with new thresholds
- [ ] If below 40%, PR description documents the gap and which modules need tests
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] CI pipeline passes on the PR

---

## Files to Modify

- `jest.config.js` - Update coverageThreshold values and add baseline comment

## Files to Read (for context)

- `jest.config.js` - Current coverage configuration
- CI output from TASK-2010 PR - Actual coverage numbers with electron tests

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **New tests to write:** None
- **Existing tests to update:** None

### CI Requirements
- [ ] `npm test -- --coverage` passes with new thresholds
- [ ] Coverage report shows all expected paths
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `ci: raise test coverage threshold from 24% to X% (SPRINT-087)`
- **Branch:** `ci/task-2011-coverage-threshold-40`
- **Target:** `develop`

---

## PM Status Updates

PM updates these files at each transition (engineer does NOT update status):

| When | Backlog CSV Status | Sprint Table Status | Files |
|------|-------------------|--------------------|----|
| Engineer assigned | `In Progress` | `In Progress` | backlog.csv + SPRINT-087.md |
| PR created + CI passes | `Testing` | `Testing` | backlog.csv + SPRINT-087.md |
| PR merged | `Completed` | `Completed` | backlog.csv + SPRINT-087.md |

**Backlog IDs to update:** BACKLOG-730

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] TASK-2010 is merged to develop

Implementation:
- [ ] Coverage measured with electron tests included
- [ ] Global thresholds updated
- [ ] Per-path thresholds updated
- [ ] Baseline comment added to jest.config.js
- [ ] CI=true npm test --coverage passes
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] Coverage gap documented in PR if below 40%
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~5K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Coverage with electron tests is still below 30% (something may be wrong with test inclusion)
- Setting thresholds causes CI to fail intermittently (flaky coverage numbers)
- Per-path threshold changes would require lowering any existing threshold
- You need to write new tests to reach 40% (this is out of scope for this task)
