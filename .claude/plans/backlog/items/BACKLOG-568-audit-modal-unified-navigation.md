# BACKLOG-568: Unify New Audit Modal Navigation (Remove Nested Buttons)

## Status
- **Priority**: High
- **Status**: Ready
- **Category**: UX Bug
- **Created**: 2026-01-29
- **Related Sprint**: SPRINT-066 (follow-up to TASK-1769)

## Problem Statement

The New Audit modal (`AuditTransactionModal`) has a confusing "module within module" navigation pattern that creates redundant buttons:

**Current State:**
1. Main modal footer has: `Cancel | <- Back | Continue/Create Transaction`
2. Inside `ContactAssignmentStep` (step 2), there's ALSO:
   - Step 2a footer: `Next: Assign Roles (N)` button
   - Step 2b footer: `<- Back to Select` button + "Click Continue below when done" text

**User Confusion:**
- Users see 2 sets of navigation buttons (modal footer + step footer)
- The step's internal "Back" button navigates within the step, while modal's "Back" navigates to step 1
- The "Click Continue below when done" text is a workaround indicating the navigation is disjointed
- Screen readers announce duplicate navigation controls

## Root Cause Analysis

`ContactAssignmentStep` was designed with its own internal 2-step flow (select contacts -> assign roles) that manages its own navigation state. However, the parent modal also has navigation. This creates:

1. **Duplicate Back buttons** - Modal "Back" vs Step "Back to Select"
2. **Action confusion** - "Next: Assign Roles" is internal to step, "Continue" is modal-level
3. **Visual clutter** - Two footer areas with buttons

## Proposed Solution

Lift the internal step navigation to the modal level using a callback pattern:

### Architecture Change

**Before:**
```
AuditTransactionModal
  ├── step 1: AddressVerificationStep
  └── step 2: ContactAssignmentStep
               ├── internal step 1: Select contacts (own footer)
               └── internal step 2: Assign roles (own footer)
```

**After:**
```
AuditTransactionModal (manages all navigation)
  ├── step 1: AddressVerificationStep
  ├── step 2a: Contact selection view (no footer)
  └── step 2b: Role assignment view (no footer)
```

### Implementation Approach

**Option A: Lift State to Parent (Recommended)**
1. Move `internalStep` state from `ContactAssignmentStep` to `useAuditTransaction` hook
2. Change modal step logic: `step` becomes 1, 2, 3 (instead of 1, 2 with substeps)
3. Remove internal footers from `ContactAssignmentStep`
4. Modal footer shows appropriate buttons based on current step:
   - Step 1: `Cancel | Continue`
   - Step 2 (select): `Cancel | <- Back | Next: Assign Roles`
   - Step 3 (roles): `Cancel | <- Back | Create Transaction`

**Option B: Callback Pattern (Less Refactoring)**
1. `ContactAssignmentStep` exposes callbacks for navigation
2. Parent modal renders step's internal navigation in its own footer
3. Step becomes "headless" (no internal footer)

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `src/hooks/useAuditTransaction.ts` | MODIFY | Add internalStep state, update step count |
| `src/components/AuditTransactionModal.tsx` | MODIFY | Update footer buttons, adjust step display |
| `src/components/audit/ContactAssignmentStep.tsx` | MODIFY | Remove internal footer sections |
| `src/components/audit/ContactAssignmentStep.test.tsx` | MODIFY | Update tests for new API |

## Acceptance Criteria

- [ ] Only ONE set of navigation buttons visible at any time (in modal footer)
- [ ] "Back" always goes to the previous logical step
- [ ] Step indicator shows all 3 steps (or 2 with visual substep)
- [ ] No "Click Continue below when done" workaround text
- [ ] Edit mode still works (single step)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Verification Steps

1. Open New Audit modal
2. Verify only modal footer has navigation buttons
3. Fill step 1 (address) -> click Continue
4. Verify step 2 (select contacts) shows: `Cancel | <- Back | Next: Assign Roles`
5. Select contacts -> click Next
6. Verify step 3 (assign roles) shows: `Cancel | <- Back | Create Transaction`
7. Click Back -> verify returns to contact selection
8. Complete flow and verify transaction created
9. Test edit mode: verify single step with Save Changes

## Estimated Effort

~20K tokens (medium refactor, state lifting + test updates)

## Dependencies

- Should be implemented after TASK-1769 merge (current sprint work)

## Notes

This is a follow-up UX fix from TASK-1769 review. The current implementation was a quick solution during TASK-1766; this backlog item provides the proper unified navigation.

The key insight is that the user should perceive a single, linear wizard flow - not a wizard with nested sub-wizards. All navigation should be in one place (the modal footer).
