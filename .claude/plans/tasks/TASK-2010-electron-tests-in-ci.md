# TASK-2010: Add Electron Backend Tests to CI Pipeline

**Backlog ID:** BACKLOG-729
**Sprint:** SPRINT-087
**Phase:** Phase 2 - CI Hardening
**Branch:** `ci/task-2010-electron-tests-in-ci`
**Estimated Tokens:** ~8K

---

## Objective

Include the 116 Electron backend test files in CI test runs. Currently CI only runs `src/**` tests. The Electron tests (90 service + 15 util + 11 handler) are excluded by the `testMatch` configuration for CI. This means backend code has zero test enforcement in CI.

---

## Context

In `jest.config.js`, the CI test match pattern is:

```javascript
testMatch: process.env.CI ? [
  '**/src/**/*.(test|spec).{js,jsx,ts,tsx}',
] : [
  '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
  '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
  '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
],
```

The CI pattern only matches `src/**` -- meaning all 116 test files under `electron/` are silently skipped in CI. Locally they run fine because the non-CI pattern matches everything.

The reason they were excluded was likely reliability -- Electron tests may depend on native modules or file system state that varies between CI environments. This task needs to carefully include them and fix any CI-specific failures.

---

## Requirements

### Must Do:

1. **Update `jest.config.js`** to include electron tests in CI:
   ```javascript
   testMatch: process.env.CI ? [
     '**/src/**/*.(test|spec).{js,jsx,ts,tsx}',
     '**/electron/**/*.(test|spec).{js,jsx,ts,tsx}',
   ] : [
     '**/__tests__/**/*.(test|spec).{js,jsx,ts,tsx}',
     '**/tests/**/*.(test|spec).{js,jsx,ts,tsx}',
     '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
   ],
   ```

2. **Run electron tests locally in CI-like mode** to identify failures:
   ```bash
   CI=true npm test -- --testPathPattern='electron/' --verbose 2>&1 | tail -50
   ```

3. **Fix failing tests** where the fix is straightforward (missing mocks, path issues, environment checks). For each fix:
   - Document what failed and why
   - Keep fixes minimal (mock missing resources, skip environment-specific assertions)

4. **Exclude genuinely CI-incompatible tests** if they require native modules that cannot be mocked:
   - Add them to `testPathIgnorePatterns` for CI with a comment explaining why
   - Document excluded tests in the PR description
   - Example: `electron/services/__tests__/nativeModules.test.ts` may require actual sqlite3 binary

5. **Update coverage collection** to include electron files for CI if not already:
   - Check `collectCoverageFrom` in jest.config.js
   - Electron files should be included in coverage reports

6. **Verify CI passes** with the expanded test suite.

### Must NOT Do:
- Do NOT rewrite existing test logic -- only fix environment issues
- Do NOT delete test files that fail -- either fix them or add to CI ignore list
- Do NOT modify the local (non-CI) test configuration
- Do NOT change test assertions to make them pass (fix the environment, not the expectation)
- Do NOT add new tests (that is TASK-2011 territory)

---

## Acceptance Criteria

- [ ] `jest.config.js` testMatch for CI includes `electron/**` pattern
- [ ] `CI=true npm test` passes with electron tests included
- [ ] Any excluded tests have clear comments explaining why
- [ ] Excluded tests documented in PR description
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] CI pipeline passes on the PR
- [ ] Coverage report now includes electron/ files

---

## Files to Modify

- `jest.config.js` - Add electron test patterns to CI testMatch, update testPathIgnorePatterns if needed

## Files to Read (for context)

- `jest.config.js` - Full test configuration
- `electron/services/__tests__/` - Sample electron service tests
- `electron/utils/__tests__/` - Sample electron util tests
- `electron/__tests__/` - Sample electron handler tests

---

## Scope Scan

**Test file distribution (116 total):**

| Directory | Count | Type |
|-----------|-------|------|
| `electron/services/__tests__/` | ~90 | Service tests |
| `electron/utils/__tests__/` | ~15 | Utility tests |
| `electron/__tests__/` | ~11 | Handler tests |

**Likely CI failure categories:**
- Native module imports (better-sqlite3, electron APIs)
- File system path assumptions
- Missing environment variables
- Timing-sensitive tests

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests
- **New tests to write:** None
- **Existing tests to update:** Fix CI-incompatible tests or exclude with documentation

### CI Requirements
- [ ] `npm test` passes with electron tests included
- [ ] No flaky tests introduced (run 3x locally)
- [ ] Coverage report includes electron code
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `ci: add 116 Electron backend tests to CI pipeline`
- **Branch:** `ci/task-2010-electron-tests-in-ci`
- **Target:** `develop`

---

## PM Status Updates

PM updates ALL three locations at each transition (engineer does NOT update status):

| When | Status | Where |
|------|--------|-------|
| Engineer assigned | → `In Progress` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR created + CI passes | → `Testing` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR merged | → `Completed` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |

**Backlog IDs to update:** BACKLOG-729

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

Implementation:
- [ ] jest.config.js updated for CI electron test inclusion
- [ ] CI=true npm test run locally with electron tests
- [ ] Failing tests identified and fixed or excluded
- [ ] Excluded tests documented with reasons
- [ ] Coverage includes electron/ files
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Tests pass 3x (npm test)

PR Submission:
- [ ] This summary section completed
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
- **Actual Tokens**: ~XK (Est: ~8K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- More than 20 electron tests fail in CI mode (scope may be too large)
- Tests require actual Electron runtime (not just Node.js) to pass
- Native module tests cannot be mocked and need the sqlite3 binary
- Test fixes require changing production code logic
- Coverage drops significantly when electron tests are included (they may test code not in coverage collection)
- Token cap 4x (~32K) is approaching
