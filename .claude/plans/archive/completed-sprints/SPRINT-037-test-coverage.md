# SPRINT-037: Test Coverage Improvement

**Created:** 2026-01-15
**Status:** PLANNING
**Branch:** `feature/test-coverage-improvements` (from `develop`)

---

## Sprint Goal

Fix all failing tests and increase test coverage from 25% statements / 15% branches to 40% statements / 30% branches. This sprint addresses critical technical debt identified in the SR Engineer health report, ensuring the test suite is reliable and coverage gates prevent regression.

## Problem Statement

### Current State

| Metric | Current | Target |
|--------|---------|--------|
| Statement Coverage | 25% | 40% |
| Branch Coverage | 15% | 30% |
| Failing Tests | 75 (databaseService.test.ts) | 0 |
| Test Files | 171 | 171+ |

**Root Causes:**
1. `databaseService.test.ts` has 75 failing tests due to native module (sqlite3) mocking issues
2. Critical paths lack test coverage (auth flows, database operations, sync orchestration)
3. No CI coverage gates to prevent regression

### Target State

- All tests passing (0 failures)
- Statement coverage >= 40%
- Branch coverage >= 30%
- CI coverage thresholds enforced
- Critical paths have comprehensive tests

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm rebuild better-sqlite3-multiple-ciphers`
- [ ] `npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Run tests and observe current state: `npm test -- --coverage`

**Note**: Native module rebuilds are required after `npm install` or Node.js updates.

---

## Scope

### In-Scope

1. **TASK-1053**: Fix `databaseService.test.ts` native module mocking issue (75 failing tests)
2. **TASK-1054**: Add test coverage for critical paths:
   - Auth service flows (Google/Microsoft OAuth)
   - Database service operations (CRUD, transactions)
   - Sync orchestration service
3. **TASK-1055**: Add coverage thresholds to CI configuration

### Out-of-Scope / Deferred

- **Performance optimization of test suite** - Focus on correctness first
- **Integration test expansion** - Already excluded from CI; separate sprint
- **E2E test setup** - Future sprint after unit coverage meets target
- **Test refactoring for code style** - Only fix what's broken

---

## Reprioritized Backlog

| ID | Title | Priority | Rationale | Dependencies | Conflicts |
|----|-------|----------|-----------|--------------|-----------|
| TASK-1053 | Fix databaseService test failures | 1 | Blocks all test runs; 75 failures | None | None |
| TASK-1054 | Add critical path test coverage | 2 | Core coverage improvement | TASK-1053 | None |
| TASK-1055 | CI coverage thresholds | 3 | Prevent regression | TASK-1054 | None |

---

## Phase Plan

### Phase 1: Fix Failing Tests (Sequential)

**Goal:** Achieve 0 failing tests by fixing the native module mocking issue.

| Task | Description | Est. Tokens | Depends On |
|------|-------------|-------------|------------|
| TASK-1053 | Fix databaseService.test.ts native module mocking | ~25K | - |

**Rationale for Phase 1 First:** Cannot accurately measure coverage or add tests while 75 tests are failing.

**Integration checkpoint:** All tests pass (`npm test` returns 0 failures). CI must pass.

### Phase 2: Coverage Improvement (Parallelizable)

**Goal:** Increase coverage from 25% to 40% statements by adding tests for critical paths.

| Task | Description | Est. Tokens | Depends On |
|------|-------------|-------------|------------|
| TASK-1054 | Add critical path test coverage | ~40K | TASK-1053 |

**Focus Areas:**
1. Auth flows (Google/Microsoft OAuth lifecycle)
2. Database operations (CRUD, transactions, edge cases)
3. Sync orchestration (state transitions, error handling)

**Integration checkpoint:** Coverage report shows >= 40% statements. CI must pass.

### Phase 3: CI Gates (Sequential)

**Goal:** Add coverage thresholds to CI to prevent regression.

| Task | Description | Est. Tokens | Depends On |
|------|-------------|-------------|------------|
| TASK-1055 | Configure Jest coverage thresholds and CI enforcement | ~15K | TASK-1054 |

**Integration checkpoint:** CI fails if coverage drops below thresholds.

---

## Dependency Graph

```
TASK-1053 (Fix Failing Tests)
    |
    v
TASK-1054 (Add Critical Path Coverage)
    |
    v
TASK-1055 (CI Coverage Thresholds)
```

**Execution Order:**
1. TASK-1053 (must complete first - blocking)
2. TASK-1054 (after tests pass)
3. TASK-1055 (after coverage targets met)

---

## Merge Plan

- **Main branch**: `develop`
- **Feature branch format**: `fix/task-XXX-description` or `feature/task-XXX-description`
- **Merge order** (explicit):
  1. TASK-1053 -> develop
  2. TASK-1054 -> develop
  3. TASK-1055 -> develop

**Note:** No integration branch needed - tasks are sequential and low-risk.

---

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: TASK-1053
      type: task
      phase: 1
      title: Fix databaseService test failures
    - id: TASK-1054
      type: task
      phase: 2
      title: Add critical path test coverage
    - id: TASK-1055
      type: task
      phase: 3
      title: CI coverage thresholds
  edges:
    - from: TASK-1053
      to: TASK-1054
      type: depends_on
    - from: TASK-1054
      to: TASK-1055
      type: depends_on
```

---

## Testing & Quality Plan (REQUIRED)

### Unit Testing

- **TASK-1053**: Fix existing tests (no new tests)
- **TASK-1054**: New tests required for:
  - `googleAuthService.ts` - OAuth flow, token refresh, error handling
  - `microsoftAuthService.ts` - OAuth flow, token refresh, error handling
  - `databaseService.ts` - Additional CRUD operations, edge cases
  - `syncOrchestrator.ts` - State transitions, error recovery
- **TASK-1055**: No new tests, only configuration

### Coverage Expectations

| Metric | Current | After Phase 1 | After Phase 2 | After Phase 3 |
|--------|---------|---------------|---------------|---------------|
| Statements | 25% | 25%* | >= 40% | >= 40% (enforced) |
| Branches | 15% | 15%* | >= 30% | >= 30% (enforced) |
| Failures | 75 | 0 | 0 | 0 |

*Coverage may fluctuate when failing tests are fixed

### Integration / Feature Testing

- Not in scope for this sprint
- Integration tests remain excluded from CI (`testPathIgnorePatterns`)

### CI / CD Quality Gates

The following MUST pass before merge:
- [x] Unit tests (already required)
- [x] Type checking (already required)
- [x] Linting (already required)
- [x] Build step (already required)
- [ ] **Coverage thresholds** (TASK-1055 adds this)

### Backend Revamp Safeguards

Not applicable - this sprint does not modify production code behavior.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Native module mocking breaks other tests | Low | Medium | Test in isolation first; run full suite after |
| Coverage improvement requires significant refactoring | Medium | Medium | Focus on adding tests, not refactoring code |
| CI coverage thresholds too aggressive | Low | Low | Start conservative (40%); increase incrementally |
| Test suite runtime increases significantly | Medium | Low | Monitor runtime; optimize if >5min |

---

## Decision Log

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Fix failing tests before adding coverage | Can't measure progress with 75 failures | 2026-01-15 |
| 2 | Target 40% statement / 30% branch | Reasonable increment from 25%/15%; achievable in one sprint | 2026-01-15 |
| 3 | Sequential execution | Each task depends on previous; no parallelization benefit | 2026-01-15 |
| 4 | Focus on critical paths | Auth, DB, Sync are highest-risk areas | 2026-01-15 |
| 5 | No code refactoring | Test-only changes reduce risk | 2026-01-15 |

---

## Files Affected

| File | Changes | Task |
|------|---------|------|
| `electron/services/__tests__/databaseService.test.ts` | Fix native module mocking | TASK-1053 |
| `electron/services/databaseService.test.ts` | Consolidate/remove if duplicate | TASK-1053 |
| `tests/__mocks__/better-sqlite3-multiple-ciphers.js` | New or updated mock | TASK-1053 |
| `electron/services/__tests__/googleAuthService.test.ts` | New/expanded tests | TASK-1054 |
| `electron/services/__tests__/microsoftAuthService.test.ts` | New/expanded tests | TASK-1054 |
| `electron/services/__tests__/syncOrchestrator.test.ts` | New/expanded tests | TASK-1054 |
| `jest.config.js` | Coverage threshold configuration | TASK-1055 |
| `.github/workflows/ci.yml` | Coverage enforcement | TASK-1055 |

---

## Metrics Tracking

### Token Estimates by Phase

| Phase | Tasks | Est. Tokens | Category | Multiplier | Adjusted |
|-------|-------|-------------|----------|------------|----------|
| Phase 1 | 1 | ~25K | test | 0.9x | ~22K |
| Phase 2 | 1 | ~40K | test | 0.9x | ~36K |
| Phase 3 | 1 | ~15K | config | 0.5x | ~8K |
| **Total** | **3** | **~80K** | - | - | **~66K** |

**SR Review Overhead:** +15K per task = +45K
**Sprint Total Estimate:** ~111K tokens

---

## Task Files

- `.claude/plans/tasks/TASK-1053-fix-database-service-tests.md`
- `.claude/plans/tasks/TASK-1054-critical-path-coverage.md`
- `.claude/plans/tasks/TASK-1055-ci-coverage-thresholds.md`

---

## Unplanned Work Log

**Instructions:** Update this section AS unplanned work is discovered during the sprint. Do NOT wait until sprint review.

| Task | Source | Root Cause | Added Date | Est. Tokens | Actual Tokens |
|------|--------|------------|------------|-------------|---------------|
| - | - | - | - | - | - |

### Unplanned Work Summary (Updated at Sprint Close)

| Metric | Value |
|--------|-------|
| Unplanned tasks | 0 |
| Unplanned PRs | 0 |
| Unplanned lines changed | +0/-0 |
| Unplanned tokens (est) | 0 |
| Unplanned tokens (actual) | 0 |
| Discovery buffer | 0% |

---

## End-of-Sprint Validation Checklist

- [ ] All 3 tasks merged to develop
- [ ] All tests passing (0 failures)
- [ ] Statement coverage >= 40%
- [ ] Branch coverage >= 30%
- [ ] CI coverage gates active
- [ ] No regressions in existing functionality
- [ ] Phase retro report created

---

## Sprint Review Criteria

### Definition of Done

- [ ] All 3 tasks merged to develop
- [ ] CI green on all PRs
- [ ] Coverage targets met (verified via coverage report)
- [ ] No test regressions introduced
- [ ] Documentation updated (jest.config.js comments)

### Success Metrics

| Metric | Current | Target | Verified |
|--------|---------|--------|----------|
| Failing tests | 75 | 0 | [ ] |
| Statement coverage | 25% | >= 40% | [ ] |
| Branch coverage | 15% | >= 30% | [ ] |
| CI coverage gates | None | Active | [ ] |
