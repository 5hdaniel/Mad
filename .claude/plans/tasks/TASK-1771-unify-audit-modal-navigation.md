# TASK-1771: Unify New Audit Modal Navigation

## Status: COMPLETE

**Completion Date:** 2026-01-30
**Related Backlog:** BACKLOG-568

---

## Overview

This task addressed the confusing "module within module" navigation in the New Audit modal where users saw duplicate navigation buttons (modal footer + step footer).

## Problem Statement (from BACKLOG-568)

**Before:**
- Main modal footer: `Cancel | <- Back | Continue/Create Transaction`
- Inside `ContactAssignmentStep`: Additional internal navigation buttons
- "Click Continue below when done" workaround text indicating disjointed navigation
- Users confused by 2 sets of navigation controls

## Solution Implemented

**Option A: Lift State to Parent** - The navigation was unified by:

1. Moving `internalStep` state to `useAuditTransaction` hook
2. Changing modal from 2 steps with substeps to **3 linear steps**
3. Removing internal footers from `ContactAssignmentStep`
4. Modal footer shows appropriate buttons based on current step

---

## Implementation Summary

### Architecture Change

**Before:**
```
AuditTransactionModal
  +-- step 1: AddressVerificationStep
  +-- step 2: ContactAssignmentStep
               +-- internal step 1: Select contacts (own footer)
               +-- internal step 2: Assign roles (own footer)
```

**After:**
```
AuditTransactionModal (manages all navigation)
  +-- step 1: AddressVerificationStep
  +-- step 2: Contact selection (ContactAssignmentStep step=2)
  +-- step 3: Role assignment (ContactAssignmentStep step=3)
```

### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useAuditTransaction.ts` | Step state manages 3 steps, contacts loaded at hook level |
| `src/components/AuditTransactionModal.tsx` | Footer shows unified navigation, progress bar shows 3 steps |
| `src/components/audit/ContactAssignmentStep.tsx` | Removed internal footer, accepts `step` prop from parent |

### Current Navigation (Unified)

| Step | Header | Footer Buttons |
|------|--------|----------------|
| 1 (Details) | "Step 1: Transaction Details" | `Cancel` / `Continue ->` |
| 2 (Select) | "Step 2: Select Contacts" | `Cancel` / `<- Back` / `Continue ->` |
| 3 (Roles) | "Step 3: Assign Roles" | `Cancel` / `<- Back` / `Create Transaction` |

### Key Code Sections

**AuditTransactionModal.tsx - Progress Bar (lines 132-157):**
```tsx
{!isEditing && (
  <div className="flex-shrink-0 bg-gray-100 px-3 sm:px-6 py-3">
    <div className="flex items-center justify-center gap-1 sm:gap-2 max-w-md mx-auto">
      {[1, 2, 3].map((s: number) => (
        // ... 3-step progress indicator
      ))}
    </div>
  </div>
)}
```

**AuditTransactionModal.tsx - Footer (lines 214-255):**
```tsx
<div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-between">
  <button onClick={onClose}>Cancel</button>
  <div className="flex items-center gap-3">
    {step > 1 && <button onClick={handlePreviousStep}>&larr; Back</button>}
    <button onClick={handleNextStep}>
      {step === 3 ? "Create Transaction" : "Continue ->"}
    </button>
  </div>
</div>
```

**ContactAssignmentStep.tsx - Headless Design (line 31-56):**
```tsx
interface ContactAssignmentStepProps {
  step: number;  // 2 = select contacts, 3 = assign roles
  // ... props passed from parent
}
// Component has NO internal footer - all navigation in parent modal
```

---

## Acceptance Criteria (All Met)

- [x] Only ONE set of navigation buttons visible at any time (in modal footer)
- [x] "Back" always goes to the previous logical step
- [x] Step indicator shows all 3 steps
- [x] No "Click Continue below when done" workaround text
- [x] Edit mode still works (single step)
- [x] `npm run type-check` passes
- [x] `npm test` passes

---

## Verification Steps

1. Open New Audit modal - Progress bar shows 3 steps
2. Step 1 (Details) - Only modal footer has buttons: `Cancel` / `Continue ->`
3. Fill address, click Continue - Goes to Step 2
4. Step 2 (Select) - Footer: `Cancel` / `<- Back` / `Continue ->`
5. Select contacts, click Continue - Goes to Step 3
6. Step 3 (Roles) - Footer: `Cancel` / `<- Back` / `Create Transaction`
7. Click Back - Returns to Step 2 (contact selection)
8. Complete flow - Transaction created successfully
9. Edit mode - Single step with `Save Changes` button

---

## SR Engineer Review Notes

**Review Date:** 2026-01-31 | **Status:** VERIFIED COMPLETE

### Implementation Quality

The implementation follows Option A from BACKLOG-568 (Lift State to Parent):
- Clean separation of concerns
- `ContactAssignmentStep` is now truly "headless" (no internal navigation)
- Step state fully managed by `useAuditTransaction` hook
- Single source of truth for navigation

### Architecture Verification

- [x] No duplicate navigation buttons
- [x] No internal footers in `ContactAssignmentStep`
- [x] Progress indicator correctly shows 3 steps
- [x] Back button logic correct (step decrement)
- [x] Continue button text changes appropriately per step

### Notes

This task was implemented as part of the broader SPRINT-066 contact UX refactoring.
The navigation unification was completed alongside:
- TASK-1766 (New Audit contact flow)
- Contact loading optimization (lifted to hook level)
- External contacts integration
