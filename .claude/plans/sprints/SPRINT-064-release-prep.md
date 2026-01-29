# Sprint Plan: SPRINT-064 - Release Preparation

**Created**: 2026-01-28
**Updated**: 2026-01-28
**Status**: COMPLETE
**Goal**: Complete final release preparation tasks including async import UX, contact workflow components, and email state fixes
**Branch**: `claude/real-estate-archive-app-011CUStmvmVNXPNe4oF321jJ`

---

## Sprint Goal

This sprint focuses on release preparatioso n tasks that improve user experience and complete the contact management workflow:

1. **Async Import UX** - Show progress bar during data import operations
2. **Contact Workflow** - ContactSelector and RoleAssigner components for 2-step contact selection
3. **Email State Fix** - Ensure email connection state propagates correctly to UI

---

## In Scope

### Phase 1: Import UX

| Task ID | Title | Est. Tokens | Status | PR |
|---------|-------|-------------|--------|-----|
| TASK-1710 | Async Import with Progress Bar | ~25K | **COMPLETE** | #669 |

### Phase 2: Contact Workflow

| Task ID | Title | Est. Tokens | Status | PR |
|---------|-------|-------------|--------|-----|
| TASK-1720 | ContactSelector Component | ~20K | **COMPLETE** | #667 |
| TASK-1721 | RoleAssigner Integration | ~15K | **COMPLETE** | #670 |

### Phase 3: Email State Fix

| Task ID | Title | Est. Tokens | Status | PR |
|---------|-------|-------------|--------|-----|
| TASK-1730 | Email Connection UI Fix | ~25K | **COMPLETE** | #668 |

---

## Dependency Graph

```
Phase 1: Import UX
  TASK-1710 (Async Import + Progress) [COMPLETE]
       |
       v (independent)

Phase 2: Contact Workflow
  TASK-1720 (ContactSelector) [COMPLETE]
       |
       v
  TASK-1721 (RoleAssigner Integration) [COMPLETE]
       |
       v (independent)

Phase 3: Email State
  TASK-1730 (Email Connection State) [COMPLETE]
```

**Note:** All phases are independent and can run in parallel.

---

## Task Execution Status

| Phase | Task | Status | PR | Notes |
|-------|------|--------|-----|-------|
| 1 | TASK-1710 | **COMPLETE** | #669 | Async import with progress bar |
| 2 | TASK-1720 | **COMPLETE** | #667 | ContactSelector component merged |
| 2 | TASK-1721 | IN_PROGRESS | - | RoleAssigner integration |
| 3 | TASK-1730 | **COMPLETE** | #668 | Email connection state propagation |

---

## PRs Summary

| PR | Task | Title | Status |
|----|------|-------|--------|
| #667 | TASK-1720 | ContactSelector component | **MERGED** |
| #668 | TASK-1730 | Email connection UI fix | **MERGED** |
| #669 | TASK-1710 | Async import with progress bar | **MERGING** |

---

## Files Affected

### TASK-1710: Async Import Progress
| File | Action | Description |
|------|--------|-------------|
| `src/components/import/ImportProgress.tsx` | Create/Modify | Progress bar component |
| `src/appCore/state/flows/useImportHandlers.ts` | Modify | Add progress tracking |

### TASK-1720: ContactSelector
| File | Action | Description |
|------|--------|-------------|
| `src/components/shared/ContactSelector.tsx` | Create | Multi-select contact component |
| `src/components/shared/ContactSelector.test.tsx` | Create | Unit tests |

### TASK-1721: RoleAssigner
| File | Action | Description |
|------|--------|-------------|
| `src/components/shared/RoleAssigner.tsx` | Create | Role assignment component |
| `src/components/shared/RoleAssigner.test.tsx` | Create | Unit tests |

### TASK-1730: Email Connection State
| File | Action | Description |
|------|--------|-------------|
| `src/utils/emailConnectionEvents.ts` | Create | Event utility |
| `src/appCore/state/flows/useEmailHandlers.ts` | Modify | Emit events |
| `src/components/Settings.tsx` | Modify | Listen for events |
| `src/appCore/AppModals.tsx` | Modify | Handle disconnect |

---

## Success Criteria

### Sprint Complete When:
- [x] TASK-1710: Import operations show progress bar (PR #669)
- [x] TASK-1720: ContactSelector component available (PR #667)
- [ ] TASK-1721: RoleAssigner integrates with ContactSelector for 2-step flow
- [x] TASK-1730: Email connection state propagates to Settings and Dashboard (PR #668)

---

## Estimated Effort

| Phase | Tasks | Est. Tokens | Status |
|-------|-------|-------------|--------|
| Phase 1: Import UX | 1 task | ~25K | COMPLETE |
| Phase 2: Contact Workflow | 2 tasks | ~35K | 1/2 COMPLETE |
| Phase 3: Email State | 1 task | ~25K | COMPLETE |
| **Total** | **4 tasks** | **~85K** | 3/4 COMPLETE |

---

## Notes

This sprint continues the release preparation work. The contact workflow components (ContactSelector + RoleAssigner) enable a cleaner 2-step flow for assigning contacts to transaction roles.

---

## Sprint Progress

| Date | Update |
|------|--------|
| 2026-01-28 | Sprint created. TASK-1720 (#667) and TASK-1730 (#668) already merged. TASK-1710 (#669) being merged. TASK-1721 in progress. |
