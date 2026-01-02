# SPRINT-016: Component Refactoring + Service Migration

**Status:** PLANNED (Pending SR Engineer Review)
**Created:** 2026-01-02
**Target:** develop

---

## Executive Summary

SPRINT-016 follows the infrastructure stabilization work of SPRINT-015 with a focus on **component refactoring** and **beginning service abstraction migration**. After SPRINT-015 completes the email dedup Phase 2 and process improvements, SPRINT-016 targets the largest remaining architecture debt: oversized UI components and direct `window.api` calls.

### Sprint Context

| Sprint | Status | Focus |
|--------|--------|-------|
| SPRINT-014 | Complete | Feature/Performance (Incremental sync, email dedup Phase 1) |
| SPRINT-015 | In Progress | Infrastructure stabilization (worktree mandate, token cap, window.d.ts, email dedup Phase 2) |
| **SPRINT-016** | **Planned** | **Component refactoring + Service migration (Phase 1)** |

---

## Backlog Items Included

| ID | Title | Priority | Category |
|----|-------|----------|----------|
| **BACKLOG-098** | Split AuditTransactionModal.tsx (1,169 lines) | High | refactor |
| **BACKLOG-099** | Split EmailOnboardingScreen.tsx (1,203 lines) | High | refactor |
| **BACKLOG-111** | Migrate Components to Service Abstractions (Phase 1 only) | High | refactor |

---

## Task Breakdown

### TASK-920: Split AuditTransactionModal - Analysis & Hooks (BACKLOG-098 Phase 1)

**Category:** refactor
**Adjusted Estimate:** 3-4 turns, ~40K tokens (including SR overhead)
**Token Cap:** 160K

**Deliverables:**
- Analyze AuditTransactionModal.tsx structure
- Extract `useAuditForm.ts` hook
- Extract `useAuditValidation.ts` hook
- Update component to use extracted hooks

**Files:**
- `src/components/audit/AuditTransactionModal.tsx` (read/modify)
- `src/components/audit/hooks/useAuditForm.ts` (new)
- `src/components/audit/hooks/useAuditValidation.ts` (new)

---

### TASK-921: Split AuditTransactionModal - Components (BACKLOG-098 Phase 2)

**Category:** refactor
**Adjusted Estimate:** 3-4 turns, ~40K tokens
**Token Cap:** 160K
**Depends On:** TASK-920

**Deliverables:**
- Extract `AuditForm.tsx` component
- Extract `AuditSummary.tsx` component
- Extract `AuditActions.tsx` component
- Main component reduced to <300 lines

**Files:**
- `src/components/audit/AuditTransactionModal.tsx` (modify)
- `src/components/audit/components/AuditForm.tsx` (new)
- `src/components/audit/components/AuditSummary.tsx` (new)
- `src/components/audit/components/AuditActions.tsx` (new)

---

### TASK-922: Split EmailOnboardingScreen - Analysis & Hooks (BACKLOG-099 Phase 1)

**Category:** refactor
**Adjusted Estimate:** 3-4 turns, ~40K tokens
**Token Cap:** 160K

**Deliverables:**
- Analyze EmailOnboardingScreen.tsx structure
- Extract `useOnboardingFlow.ts` hook (flow state machine)
- Extract `useProviderAuth.ts` hook (auth handling)
- Document step boundaries for component extraction

**Files:**
- `src/components/onboarding/EmailOnboardingScreen.tsx` (read/modify)
- `src/components/onboarding/hooks/useOnboardingFlow.ts` (new)
- `src/components/onboarding/hooks/useProviderAuth.ts` (new)

---

### TASK-923: Split EmailOnboardingScreen - Step Components (BACKLOG-099 Phase 2)

**Category:** refactor
**Adjusted Estimate:** 4-5 turns, ~45K tokens
**Token Cap:** 180K
**Depends On:** TASK-922

**Deliverables:**
- Extract `ProviderSelection.tsx`
- Extract `GmailAuthStep.tsx`
- Extract `OutlookAuthStep.tsx`
- Extract `PermissionsStep.tsx`
- Extract `OnboardingProgress.tsx`
- Main component reduced to <300 lines

**Files:**
- `src/components/onboarding/EmailOnboardingScreen.tsx` (modify)
- `src/components/onboarding/components/*.tsx` (5 new files)

---

### TASK-924: Service Migration - Login.tsx (BACKLOG-111 Phase 1a)

**Category:** refactor
**Adjusted Estimate:** 4-5 turns, ~38K tokens
**Token Cap:** 152K
**Depends On:** TASK-923

**Deliverables:**
- Audit 17 `window.api` calls in Login.tsx
- Create missing service methods if needed
- Migrate all calls to service abstractions
- Update tests

**Files:**
- `src/components/Login.tsx` (modify)
- `src/services/*.ts` (potential additions)

---

### TASK-925: Service Migration - Settings.tsx (BACKLOG-111 Phase 1b)

**Category:** refactor
**Adjusted Estimate:** 3-4 turns, ~35K tokens
**Token Cap:** 140K
**Depends On:** None (parallel with TASK-924)

**Deliverables:**
- Audit 10 `window.api` calls in Settings.tsx
- Migrate all calls to service abstractions
- Update tests

**Files:**
- `src/components/Settings.tsx` (modify)
- `src/services/*.ts` (potential additions)

---

### TASK-926: ESLint Rule for window.api Prevention (BACKLOG-111 Phase 1c)

**Category:** config
**Adjusted Estimate:** 2-3 turns, ~25K tokens
**Token Cap:** 100K
**Depends On:** TASK-924, TASK-925

**Deliverables:**
- Add ESLint rule to warn/error on direct `window.api` calls in components
- Allow exceptions for service files
- Document rule in codebase standards

**Files:**
- `.eslintrc.js` or `eslint.config.js` (modify)
- Update documentation

---

## Phase Structure

### Phase 1: Component Splits - Hooks (Parallel)

| Task | Files | Parallel Safe |
|------|-------|---------------|
| TASK-920 | `audit/AuditTransactionModal.tsx`, `audit/hooks/*` | Yes |
| TASK-922 | `onboarding/EmailOnboardingScreen.tsx`, `onboarding/hooks/*` | Yes |

**Worktree Required:** Yes (different directory trees)

---

### Phase 2: Component Splits - UI Extraction (Parallel)

| Task | Depends On | Parallel Safe |
|------|------------|---------------|
| TASK-921 | TASK-920 | Yes (with TASK-923) |
| TASK-923 | TASK-922 | Yes (with TASK-921) |

---

### Phase 3: Service Migration (Mixed)

| Task | Depends On | Execution |
|------|------------|-----------|
| TASK-924 | TASK-923 | Sequential (after Phase 2) |
| TASK-925 | None | Parallel with TASK-924 |
| TASK-926 | TASK-924, 925 | Sequential (last) |

---

## Dependency Graph

```
Phase 1 (Parallel)        Phase 2 (Parallel)         Phase 3 (Mixed)
      |                        |                          |
  T920 ──────────────────> T921 ─────────────────────────────────┐
  (Audit hooks)            (Audit components)                     |
      |                        |                                  v
  T922 ──────────────────> T923 ──────────────────────────────> T924 ────> T926
  (Onboarding hooks)       (Onboarding components)              (Login)    (ESLint)
                                                                   |          ^
                                                                   |          |
                                                               T925 ─────────┘
                                                              (Settings)
```

**Critical Path:** T922 -> T923 -> T924 -> T926

---

## Estimated Effort Summary

| Task | Category | Est. Turns | Est. Tokens | Token Cap |
|------|----------|------------|-------------|-----------|
| TASK-920 | refactor | 3-4 | ~40K | 160K |
| TASK-921 | refactor | 3-4 | ~40K | 160K |
| TASK-922 | refactor | 3-4 | ~40K | 160K |
| TASK-923 | refactor | 4-5 | ~45K | 180K |
| TASK-924 | refactor | 4-5 | ~38K | 152K |
| TASK-925 | refactor | 3-4 | ~35K | 140K |
| TASK-926 | config | 2-3 | ~25K | 100K |
| **Total** | - | **22-29** | **~263K** | **~1052K** |

**Notes:**
- All estimates include SR Review Overhead
- Token caps set at 4x upper estimate per BACKLOG-133
- Refactor tasks use 0.5x adjustment factor

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Component extraction breaks functionality | Medium | High | Keep all tests passing |
| Service methods missing for Login migration | Low | Medium | Create missing methods |
| Tight coupling in AuditTransactionModal | Medium | Medium | Careful analysis first |
| Token cap exceeded | Medium | Low | Monitor at 2x, report at 4x |

---

## Quality Gates

### Per-Task Gates
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Token usage < 4x estimate (cap)
- [ ] Worktree used for parallel tasks

### Sprint-Level Gates
- [ ] All 7 tasks merged to develop
- [ ] AuditTransactionModal.tsx < 300 lines
- [ ] EmailOnboardingScreen.tsx < 300 lines
- [ ] Login.tsx: 0 direct `window.api` calls
- [ ] Settings.tsx: 0 direct `window.api` calls
- [ ] ESLint rule catches new `window.api` calls

---

## Out of Scope (Deferred)

- **BACKLOG-111 Phases 2-5**: Remaining 40 component files
- **BACKLOG-112, 113, 114**: Test coverage (lower priority)
- **EmailOnboarding service migration**: Future sprint

---

## Success Criteria

- [ ] Two largest components split to <300 lines each
- [ ] 3 high-traffic components migrated to service abstractions
- [ ] ESLint rule prevents regression
- [ ] No functional regressions

---

## SR Engineer Review Required

- [ ] Verify parallel safety for Phase 1 and 2
- [ ] Confirm TASK-924 depends on TASK-923
- [ ] Review file touch points for conflicts
- [ ] Validate component split boundaries
- [ ] Add branch info to task files
