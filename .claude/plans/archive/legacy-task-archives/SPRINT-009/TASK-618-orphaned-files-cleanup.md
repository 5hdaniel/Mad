# TASK-618: Orphaned Files Cleanup

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 7 - Cleanup
**Priority:** LOW
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start:** [YYYY-MM-DD HH:MM]
**Task End:** [YYYY-MM-DD HH:MM]
**Wall-Clock Time:** [X min] (actual elapsed)

| Phase | Turns | Tokens (est.) | Active Time |
|-------|-------|---------------|-------------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

**Estimated vs Actual:**
- Est Turns: 1-2 -> Actual: _ (variance: _%)
- Est Wall-Clock: 5-10 min -> Actual: _ min (variance: _%)
```

---

## PM Estimates (Calibrated - SPRINT-009)

| Metric | Original | Calibrated (0.3x refactor) | Wall-Clock (3x) |
|--------|----------|---------------------------|-----------------|
| **Turns** | 3-4 | **1-2** | - |
| **Tokens** | ~15K | ~5K | - |
| **Time** | 20-30m | **5-10 min** | **5-10 min** |

**Category:** cleanup
**Confidence:** High (files already verified as orphaned)

---

## Objective

Delete orphaned/unused files that are leftovers from previous refactoring work. These files have no imports and are not used in production.

**Root Cause:** File Lifecycle Protocol was not enforced during prior refactors. This task also establishes that protocol going forward.

---

## Discovery

Identified via codebase audit on 2025-12-25. Each file verified with grep to confirm zero production imports.

---

## Findings Table

### Orphaned Components

| # | File | Created | Origin | Status | Replaced By | Notes |
|---|------|---------|--------|--------|-------------|-------|
| 1 | `src/components/ContactDetails.tsx` | 2025-11-19 | TypeScript migration (Batch 1) | **ORPHANED** | `contact/ContactDetailsModal.tsx` | Should have been deleted in TASK-606 (Contacts refactor, 2025-12-25) |
| 2 | `src/components/ContactList.tsx` | 2025-11-19 | TypeScript migration (Batch 1) | **ORPHANED** | `contact/components/*` | Should have been deleted in TASK-606 (Contacts refactor, 2025-12-25) |
| 3 | `src/components/OnboardingWizard.tsx` | 2025-11-20 | JSX to TSX migration | **ORPHANED** | `onboarding/OnboardingFlow.tsx` | Should have been deleted in TASK-114 (Onboarding refactor, 2025-12-13) |
| 4 | `src/components/FieldWithFeedback.tsx` | 2025-11-20 | JSX to TSX migration | **ORPHANED** | N/A | Created during TS migration, never wired into any component |
| 5 | `src/components/ManualTransactionModal.tsx` | 2025-11-20 | JSX to TSX migration | **ORPHANED** | N/A | Created during TS migration, never wired into any component |
| 6 | `src/components/LLMLoadingStates.tsx` | 2025-12-18 | TASK-405 (SPRINT-004) | **ORPHANED** | N/A | Created for AI MVP but never integrated into UI. Has test file but no production usage |

### Orphaned Services

| # | File | Created | Origin | Status | Notes |
|---|------|---------|--------|--------|-------|
| 7 | `electron/services/messagesService.ts` | 2025-11-19 | TS migration (Batch C3) | **ORPHANED** | Only referenced in test file and old TASK-004.md |
| 8 | `electron/services/validationService.ts` | 2025-11-18 | Initial commit with tests | **ORPHANED** | Created with tests but never integrated into production |

### Associated Test Files (Delete with Parent)

| # | Test File | Parent |
|---|-----------|--------|
| 9 | `electron/services/__tests__/messagesService.test.ts` | #7 |
| 10 | `electron/services/tests/validationService.test.ts` | #8 |
| 11 | `src/components/__tests__/LLMLoadingStates.test.tsx` | #6 |

---

## Visual Summary

```
src/components/
|
+-- contact/                      [OK] ACTIVE (replacement)
|   +-- ContactDetailsModal.tsx
|   +-- components/
|
+-- onboarding/                   [OK] ACTIVE (replacement)
|   +-- OnboardingFlow.tsx
|
+-- ContactDetails.tsx            [X] ORPHANED --> replaced by contact/ (TASK-606)
+-- ContactList.tsx               [X] ORPHANED --> replaced by contact/ (TASK-606)
+-- OnboardingWizard.tsx          [X] ORPHANED --> replaced by onboarding/ (TASK-114)
+-- FieldWithFeedback.tsx         [X] ORPHANED --> never integrated
+-- ManualTransactionModal.tsx    [X] ORPHANED --> never integrated
+-- LLMLoadingStates.tsx          [X] ORPHANED --> TASK-405, never wired

electron/services/
+-- messagesService.ts            [X] ORPHANED --> never integrated
+-- validationService.ts          [X] ORPHANED --> never integrated
```

---

## Root Cause Analysis

| Category | Count | Cause | Prevention |
|----------|-------|-------|------------|
| Refactor leftovers | 3 | Files replaced in SPRINT-001/TASK-606 but deletion step skipped | File Lifecycle Protocol now enforced |
| Never integrated | 3 | Created during TS migration but never wired into app | Code review should catch dead code |
| Feature incomplete | 2 | Services created with tests but never used in production | SR Engineer review now checks for this |

---

## Files to Delete

### Components (6 files)
- `src/components/ContactDetails.tsx`
- `src/components/ContactList.tsx`
- `src/components/OnboardingWizard.tsx`
- `src/components/FieldWithFeedback.tsx`
- `src/components/ManualTransactionModal.tsx`
- `src/components/LLMLoadingStates.tsx`

### Services (2 files)
- `electron/services/messagesService.ts`
- `electron/services/validationService.ts`

### Test Files (3 files)
- `electron/services/__tests__/messagesService.test.ts`
- `electron/services/tests/validationService.test.ts`
- `src/components/__tests__/LLMLoadingStates.test.tsx`

---

## Requirements

### Must Do
1. Delete each orphaned file (8 total)
2. Delete associated test files (3 total)
3. Verify no type errors after deletion
4. Verify all remaining tests pass

### Must NOT Do
- Delete without running verification
- Remove files that have actual imports
- Skip test cleanup

---

## Execution Order

Process one file at a time:
1. Delete component/service file
2. Delete associated test file (if exists)
3. Run `npm run type-check`
4. If errors, investigate (file may not be orphaned)
5. Move to next file

---

## Acceptance Criteria

- [ ] All 8 orphaned files deleted
- [ ] All 3 associated test files deleted
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Branch

```
feature/TASK-618-orphaned-files-cleanup
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Old/replaced files DELETED (this IS a cleanup task)

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

- **Before**: 11 orphaned files (8 code + 3 tests)
- **After**: 0 orphaned files
- **Actual Turns**: _ (Est: 1-2)
- **Actual Tokens**: ~_K (Est: ~5K)
- **Actual Time**: _ min
- **PR**: [URL after PR created]

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
