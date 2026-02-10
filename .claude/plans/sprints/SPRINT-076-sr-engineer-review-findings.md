# Sprint Plan: SPRINT-076 - SR Engineer Review Findings

**Status:** Completed
**Completed:** 2026-02-10
**Created:** 2026-02-10
**Branch Strategy:** Individual task branches from `develop`, parallel worktrees
**Target Branch:** `develop`

## Sprint Goal

Address critical findings from SR Engineer code review: fix render-time side effects, improve type safety, extract oversized components, and add test coverage for core app infrastructure.

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install`
- [ ] `npm run type-check` passes
- [ ] Verify SPRINT-075 merged (PR #780, commit 5e42a5fb)

## In Scope

| Task | Title | Category | Priority | Est. Tokens |
|------|-------|----------|----------|-------------|
| TASK-1938 | Fix AppleDriverSetup render-time callback | bug | P0 Critical | ~15K |
| TASK-1939 | Quick wins (useMemo, dup notification, DOM, OAuth logs) | cleanup | P1 High | ~30K |
| TASK-1940 | Extract AppModals.tsx below 150-line trigger | refactor | P1 High | ~20K |
| TASK-1942 | Remove `any` types from transactionService.ts | type-safety | P1 High | ~25K |
| TASK-1943 | Add tests for AppRouter.tsx and AppModals.tsx | test | P2 Medium | ~35K |

**Total Estimated Tokens:** ~125K

## Out of Scope / Deferred

| Finding | Reason |
|---------|--------|
| TASK-1941: Decompose transaction-handlers.ts (3,302 lines) | Too risky for overnight — defer to supervised session |
| Enable `noUnusedLocals`/`noUnusedParameters` | Touches dozens of files — dedicated cleanup sprint |
| 59 components bypass service layer | Too large for one sprint |
| 235 console.* calls | Cleanup sprint later |
| Settings.tsx TODO stubs | Feature work |

## Phase Plan

### Phase 1: Critical Fix + Quick Wins (Parallel, 3 worktrees)

- TASK-1938: Fix AppleDriverSetup render-time callback
- TASK-1939: Quick wins bundle
- TASK-1940: Extract AppModals.tsx below 150-line trigger

**Integration checkpoint**: All 3 PRs merged to develop before Phase 2 begins.

### Phase 2: Type Safety + Tests (Parallel, 2 worktrees)

- TASK-1942: Remove `any` types from transactionService.ts
- TASK-1943: Add tests for AppRouter.tsx and AppModals.tsx

**Integration checkpoint**: All 2 PRs merged to develop.

**CI gate**: `npm run type-check`, `npm test`, `npm run lint` must all pass per PR.

## Dependency Graph

```
Phase 1 (parallel):   TASK-1938 ──┐
                      TASK-1939 ──┼──► merge all ──► Phase 2 (parallel): TASK-1942 ──► DONE
                      TASK-1940 ──┘                                      TASK-1943 ──► DONE
```

Phase 2 depends on Phase 1 merges (clean develop base). Within each phase, tasks run in parallel via git worktrees.

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: TASK-1938
      type: task
      phase: 1
      parallel: true
    - id: TASK-1939
      type: task
      phase: 1
      parallel: true
    - id: TASK-1940
      type: task
      phase: 1
      parallel: true
    - id: TASK-1942
      type: task
      phase: 2
      parallel: true
      depends_on: [TASK-1938, TASK-1939, TASK-1940]
    - id: TASK-1943
      type: task
      phase: 2
      parallel: true
      depends_on: [TASK-1938, TASK-1939, TASK-1940]
  edges:
    - from: TASK-1938
      to: TASK-1942
    - from: TASK-1938
      to: TASK-1943
    - from: TASK-1939
      to: TASK-1942
    - from: TASK-1939
      to: TASK-1943
    - from: TASK-1940
      to: TASK-1942
    - from: TASK-1940
      to: TASK-1943
```

## Merge Plan

- **Target branch**: `develop`
- **Merge strategy**: Individual PRs per task, traditional merge (not squash)
- **Merge order**:
  1. Phase 1: TASK-1938, TASK-1939, TASK-1940 PRs (can merge in any order)
  2. Phase 2: TASK-1942, TASK-1943 PRs (after Phase 1 complete)

## Testing & Quality Plan

### Unit Testing

- TASK-1943 adds new test files for AppRouter.tsx and AppModals.tsx
- All other tasks: verify existing tests still pass after changes

### Coverage Expectations

- Coverage must not decrease
- TASK-1943 should add meaningful coverage for core routing/modal logic

### CI / CD Quality Gates

The following MUST pass before each merge:
- [ ] `npm run type-check` -- no type errors
- [ ] `npm test` -- all suites pass
- [ ] `npm run lint` -- zero errors

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AppModals extraction breaks modal state | Medium | High | Test all modals manually, ensure props pass through correctly |
| useEffect change in AppleDriverSetup breaks Windows flow | Low | High | Guard with platform check, test on non-Windows (should early-return) |
| transactionService type changes break callers | Medium | Medium | Run type-check, trace all callers |
| Quick wins DOM ref change breaks scroll | Low | Low | Test dashboard scroll behavior |

## Decision Log

### Decision #1: Two-phase execution
- **Date**: 2026-02-10
- **Context**: Phase 2 tests (TASK-1943) should test the extracted AppModals from TASK-1940
- **Decision**: Phase 2 runs after Phase 1 is merged
- **Rationale**: Tests should be written against the final extracted component structure
- **Impact**: Slightly longer execution, but more accurate tests

### Decision #2: Defer transaction-handlers decomposition
- **Date**: 2026-02-10
- **Context**: TASK-1941 would decompose a 3,302-line file
- **Decision**: Defer to supervised session
- **Rationale**: High-risk refactor unsuitable for overnight autonomous execution
- **Impact**: Tech debt remains but is contained

## Unplanned Work Log

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

## Sprint Completion Summary

**All 5 tasks completed. 0 unplanned work items.**

### PRs Merged

| PR | Task | Title | State |
|----|------|-------|-------|
| #784 | TASK-1938 | fix: move AppleDriverSetup onComplete to useEffect | MERGED |
| #785 | TASK-1940 | refactor: extract IPhoneSyncModal and useEmailSettingsCallbacks | MERGED |
| #786 | TASK-1939 | fix: quick wins - useMemo, remove BackgroundServices, useRef, redact tokens | MERGED |
| #787 | TASK-1943 | test(appCore): add unit tests for AppRouter and AppModals | MERGED |
| #788 | TASK-1942 | fix(types): remove all any types from transactionService.ts | MERGED |

### Agent Metrics

| Task | Engineer Agent | Eng Total Tokens | SR Agent | SR Total Tokens | Combined |
|------|---------------|------------------|----------|-----------------|----------|
| TASK-1938 | ad91a5d | 1,743K | a42c76d | 635K | 2,378K |
| TASK-1939 | a6763d8 | 4,563K | ad080f3 | 1,718K | 6,281K |
| TASK-1940 | a9a7b44 | 2,227K | ac7ade0 | 1,144K | 3,371K |
| TASK-1942 | a628a6e | 10,705K | a7fad8c | 2,754K | 13,459K |
| TASK-1943 | a121e0b | 5,001K | a70a0a8 | 2,009K | 7,010K |
| **Total** | | **24,239K** | | **8,260K** | **32,499K** |

**Estimated:** ~125K | **Actual:** ~32.5K (tokens are measured differently — estimated was billable, actual is total including cache)

### Key Outcomes

1. **AppleDriverSetup** - Render-time side effect eliminated (P0 Critical)
2. **contextState** - Properly memoized with useMemo in useAppStateMachine
3. **BackgroundServices** - Deleted (duplicate UpdateNotification removed)
4. **AppRouter** - DOM manipulation replaced with useRef
5. **OAuth tokens** - Redacted from electron/main.ts log messages
6. **AppModals.tsx** - Reduced from 194 to 146 lines (below 150-line trigger)
7. **transactionService.ts** - Zero `any` types remaining (14 replaced)
8. **Test coverage** - 47 new tests for AppRouter and AppModals
