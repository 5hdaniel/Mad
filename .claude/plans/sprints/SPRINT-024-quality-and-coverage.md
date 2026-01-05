# SPRINT-024: Quality & Coverage

**Status:** PLANNED
**Created:** 2026-01-04
**Target:** develop

---

## Executive Summary

SPRINT-024 addresses quality issues identified in the SR Engineer architectural review (2026-01-04). The codebase health score is 7.5/10, with test coverage being the primary gap (29% vs 45% target).

### Sprint Context

| Sprint | Status | Focus |
|--------|--------|-------|
| SPRINT-022 | Complete | State Coordination Cleanup |
| SPRINT-023 | Complete | Architecture Debt Reduction |
| **SPRINT-024** | **Planned** | **Quality & Coverage** |

---

## SR Engineer Review Findings (2026-01-04)

### Issues by Severity

| Severity | Issue | Backlog |
|----------|-------|---------|
| HIGH | Test coverage 29% vs 45% target | BACKLOG-112, 113, 114 |
| HIGH | 1 failing test (auth-handlers) | NEW: BACKLOG-157 |
| MEDIUM | AuditTransactionModal.tsx (1,187 lines) | NEW: BACKLOG-158 |
| MEDIUM | Deprecated PermissionsScreen.tsx still exists | NEW: BACKLOG-159 |
| MEDIUM | LLMSettings.tsx (820 lines) | Defer to SPRINT-025 |
| LOW | 409 direct window.api calls | BACKLOG-111 (defer) |
| LOW | Dashboard scroll issue | BACKLOG-155 (defer) |

---

## Sprint Scope

### In-Scope (5 Tasks)

| Task | Backlog | Title | Est. Tokens | Priority |
|------|---------|-------|-------------|----------|
| TASK-970 | BACKLOG-157 | Fix Failing Auth Handler Test | ~15K | HIGH |
| TASK-971 | BACKLOG-159 | Delete Deprecated PermissionsScreen | ~10K | MEDIUM |
| TASK-972 | BACKLOG-112 | Boost src/hooks/ Test Coverage | ~80K | HIGH |
| TASK-973 | BACKLOG-113 | Boost src/utils/ Test Coverage | ~50K | MEDIUM |
| TASK-974 | BACKLOG-158 | Decompose AuditTransactionModal | ~60K | MEDIUM |

**Total Sprint Estimate:** ~215K tokens

### Out-of-Scope (Deferred)

| Item | Reason |
|------|--------|
| BACKLOG-114 (electron/utils/ coverage) | Focus on renderer first |
| BACKLOG-111 (window.api abstractions) | Low priority, large scope |
| BACKLOG-155 (dashboard scroll) | Cosmetic, low priority |
| LLMSettings.tsx decomposition | Lower priority than AuditTransactionModal |

---

## Phase Plan

### Phase 1: Quick Wins (Sequential)
**Goal:** Fix broken test and remove deprecated code

```
TASK-970 (Fix auth test) → TASK-971 (Delete PermissionsScreen)
```

- Sequential because both touch auth/session code paths
- Must fix test before adding more tests
- ~25K tokens total

### Phase 2: Coverage Boost (Can Parallelize)
**Goal:** Improve test coverage toward 45% target

```
TASK-972 (hooks coverage) ║ TASK-973 (utils coverage)
```

- Can run in parallel - different directories, no overlap
- Each engineer gets isolated worktree
- ~130K tokens total

### Phase 3: Component Decomposition
**Goal:** Break down largest component

```
TASK-974 (AuditTransactionModal)
```

- Depends on Phase 1/2 completing (tests protect refactoring)
- ~60K tokens

---

## Task Breakdown

### TASK-970: Fix Failing Auth Handler Test (BACKLOG-157)

**Category:** test/fix
**Estimate:** ~15K tokens
**Token Cap:** 60K
**Priority:** HIGH - Blocking CI

**Problem:**
```
electron/__tests__/auth-handlers.integration.test.ts
"should restore session on get-current-user" - FAILING
Expected: true, Received: false
```

**Deliverables:**
- Investigate why session restore returns false
- Fix the test or underlying code
- Ensure all 749 tests pass

**Files:**
- `electron/__tests__/auth-handlers.integration.test.ts`
- `electron/handlers/sessionHandlers.ts` (if code fix needed)

---

### TASK-971: Delete Deprecated PermissionsScreen (BACKLOG-159)

**Category:** refactor/cleanup
**Estimate:** ~10K tokens
**Token Cap:** 40K
**Priority:** MEDIUM

**Problem:**
File has `@deprecated` notice but still exists (873 lines):
```typescript
/**
 * @deprecated Use `onboarding/steps/PermissionsStep.tsx` instead.
 */
```

**Deliverables:**
- Verify PermissionsStep.tsx is fully functional replacement
- Delete `src/components/PermissionsScreen.tsx`
- Remove all imports/references
- Update any route definitions

**Files:**
- `src/components/PermissionsScreen.tsx` (DELETE)
- Any importing files (modify)

---

### TASK-972: Boost src/hooks/ Test Coverage (BACKLOG-112)

**Category:** test
**Estimate:** ~80K tokens
**Token Cap:** 200K
**Priority:** HIGH

**Current State:**
- `src/hooks/`: 26.3% statements (target: 60%+)
- Gap: ~34 percentage points

**Key Hooks to Cover:**
1. `useIPhoneSync.ts` (593 lines) - Complex sync logic
2. `useExportWizard.ts` - Export workflow
3. `useTransactionValidation.ts` - Validation rules
4. Other hooks with <50% coverage

**Deliverables:**
- Add tests for top 5 lowest-coverage hooks
- Achieve 50%+ coverage for src/hooks/
- Tests must be non-flaky

**Testing Approach:**
- Use React Testing Library's renderHook
- Mock IPC calls via jest.mock
- Test state transitions and error handling

---

### TASK-973: Boost src/utils/ Test Coverage (BACKLOG-113)

**Category:** test
**Estimate:** ~50K tokens
**Token Cap:** 150K
**Priority:** MEDIUM

**Current State:**
- `src/utils/`: 50% statements (target: 80%)
- Gap: ~30 percentage points

**Deliverables:**
- Add tests for uncovered utility functions
- Achieve 75%+ coverage for src/utils/
- Focus on edge cases and error paths

---

### TASK-974: Decompose AuditTransactionModal (BACKLOG-158)

**Category:** refactor
**Estimate:** ~60K tokens
**Token Cap:** 150K
**Priority:** MEDIUM
**Depends On:** TASK-970, TASK-972 (tests protect refactoring)

**Problem:**
`AuditTransactionModal.tsx` is 1,187 lines - largest component in codebase.

**Decomposition Plan:**
1. Extract `AuditTransactionForm.tsx` - Form fields and validation
2. Extract `AddressInput.tsx` - Address autocomplete component
3. Extract `ContactAssignment.tsx` - Contact selection UI
4. Extract `useAuditTransaction.ts` - Business logic hook
5. Keep `AuditTransactionModal.tsx` as orchestrator (<300 lines)

**Deliverables:**
- 4-5 extracted files
- Parent component <300 lines
- All existing tests pass
- No functionality changes

---

## Merge Plan

```
develop
  │
  ├── PR: TASK-970 (fix auth test)
  │
  ├── PR: TASK-971 (delete PermissionsScreen)
  │
  ├── PR: TASK-972 (hooks coverage) ─┐
  │                                   ├── Can merge in any order
  ├── PR: TASK-973 (utils coverage) ─┘
  │
  └── PR: TASK-974 (decompose AuditTransactionModal)
```

All PRs target `develop` directly. No integration branch needed.

---

## Testing & Quality Plan

### Coverage Targets

| Directory | Current | Target | Task |
|-----------|---------|--------|------|
| `src/hooks/` | 26% | 50%+ | TASK-972 |
| `src/utils/` | 50% | 75%+ | TASK-973 |
| Global | 29% | 35%+ | Combined |

### Quality Gates

- [ ] All 749 tests pass (fix failing test first)
- [ ] Coverage thresholds met per task
- [ ] No new TypeScript errors
- [ ] PR review by SR Engineer
- [ ] CI passes on all platforms

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Auth test fix reveals deeper issue | Medium | High | Cap at 60K tokens, escalate if complex |
| Coverage tasks take longer than estimated | Medium | Medium | Parallelize to offset |
| AuditTransactionModal has hidden dependencies | Low | Medium | Comprehensive grep before refactor |

---

## Success Criteria

1. **All tests passing** - 749/749 (currently 748/749)
2. **Coverage improved** - Global from 29% toward 35%
3. **Large file reduced** - AuditTransactionModal from 1,187 to <300 lines
4. **Dead code removed** - PermissionsScreen.tsx deleted

---

## Sprint Retrospective Template

To be filled after sprint completion:

### Metrics
- Estimated tokens: ~215K
- Actual tokens: TBD
- Variance: TBD

### What Went Well
- TBD

### What Could Improve
- TBD

### Action Items
- TBD
