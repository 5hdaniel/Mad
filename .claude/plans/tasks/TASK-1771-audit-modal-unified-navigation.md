# TASK-1771: Unify New Audit Modal Navigation (Remove Nested Buttons)

## Status: READY FOR IMPLEMENTATION

## Overview

Eliminate the "module within module" navigation pattern in the New Audit modal (`AuditTransactionModal`) by lifting the internal step navigation from `ContactAssignmentStep` to the modal level.

**Related:**
- **Backlog:** BACKLOG-568
- **Sprint:** SPRINT-066 (follow-up UX fix)
- **Depends On:** TASK-1769 (multi-category filtering) - pending merge

## Problem Statement

The New Audit modal has confusing duplicate navigation:

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

---

## Desired State

Single unified navigation in the modal footer only:

```
Step 1 (Address): Cancel | Continue
Step 2 (Select):  Cancel | <- Back | Next: Assign Roles
Step 3 (Roles):   Cancel | <- Back | Create Transaction
```

**Architecture Change:**

```
BEFORE:
AuditTransactionModal
  ├── step 1: AddressVerificationStep
  └── step 2: ContactAssignmentStep
               ├── internal step 1: Select contacts (own footer)
               └── internal step 2: Assign roles (own footer)

AFTER:
AuditTransactionModal (manages all navigation)
  ├── step 1: AddressVerificationStep
  ├── step 2: Contact selection view (no footer)
  └── step 3: Role assignment view (no footer)
```

---

## Files to Modify

| File | Action | Est. Lines Changed |
|------|--------|-------------------|
| `src/hooks/useAuditTransaction.ts` | MODIFY | ~30 lines |
| `src/components/AuditTransactionModal.tsx` | MODIFY | ~50 lines |
| `src/components/audit/ContactAssignmentStep.tsx` | MODIFY | ~80 lines (remove footers) |
| `src/components/audit/__tests__/ContactAssignmentStep.test.tsx` | MODIFY | ~40 lines |

---

## Implementation Plan

### Phase 1: Update useAuditTransaction Hook

**File: `src/hooks/useAuditTransaction.ts`**

Add new state for the expanded step model:

```typescript
// Current: step can be 1 or 2
// New: step can be 1, 2, or 3

// Add to hook state:
const [step, setStep] = useState<1 | 2 | 3>(1);

// Update step navigation functions:
const nextStep = useCallback(() => {
  setStep(prev => Math.min(prev + 1, 3) as 1 | 2 | 3);
}, []);

const prevStep = useCallback(() => {
  setStep(prev => Math.max(prev - 1, 1) as 1 | 2 | 3);
}, []);

// Update isLastStep check:
const isLastStep = step === 3;

// Update step count for progress indicator:
const totalSteps = 3;
```

### Phase 2: Update AuditTransactionModal

**File: `src/components/AuditTransactionModal.tsx`**

#### Step 2.1: Update step rendering

```typescript
// Replace step 2 rendering with conditional based on step 2 vs 3
{step === 1 && (
  <AddressVerificationStep {...addressStepProps} />
)}
{step === 2 && (
  <ContactAssignmentStep
    mode="select"  // New prop to indicate which view
    {...contactStepProps}
  />
)}
{step === 3 && (
  <ContactAssignmentStep
    mode="roles"  // New prop to indicate which view
    {...contactStepProps}
  />
)}
```

#### Step 2.2: Update modal footer

Replace the current footer logic with step-aware buttons:

```typescript
<div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
  <button
    type="button"
    onClick={handleClose}
    className="..."
  >
    Cancel
  </button>

  <div className="flex gap-3">
    {step > 1 && (
      <button
        type="button"
        onClick={prevStep}
        className="..."
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back
      </button>
    )}

    {step === 1 && (
      <button
        type="button"
        onClick={nextStep}
        disabled={!canProceedFromStep1}
        className="..."
      >
        Continue
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    )}

    {step === 2 && (
      <button
        type="button"
        onClick={nextStep}
        disabled={selectedContacts.length === 0}
        className="..."
      >
        Next: Assign Roles
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    )}

    {step === 3 && (
      <button
        type="button"
        onClick={handleCreate}
        disabled={!canCreate}
        className="..."
      >
        Create Transaction
      </button>
    )}
  </div>
</div>
```

#### Step 2.3: Update step indicator

If there's a step indicator/progress bar, update to show 3 steps:

```typescript
<StepIndicator current={step} total={3} />
// Or if using text:
// Step {step} of 3
```

### Phase 3: Update ContactAssignmentStep

**File: `src/components/audit/ContactAssignmentStep.tsx`**

#### Step 3.1: Add mode prop

```typescript
interface ContactAssignmentStepProps {
  // ... existing props
  mode: 'select' | 'roles';  // New prop
}
```

#### Step 3.2: Remove internal footer sections

Delete the footer JSX from both internal views:

```typescript
// DELETE this section from the select contacts view:
<div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
  <button onClick={handleNextToRoles}>
    Next: Assign Roles (N)
  </button>
</div>

// DELETE this section from the roles view:
<div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
  <button onClick={handleBackToSelect}>
    <- Back to Select
  </button>
  <span>Click Continue below when done</span>
</div>
```

#### Step 3.3: Remove internal step state

The internal step state is no longer needed since the parent controls it:

```typescript
// DELETE:
const [internalStep, setInternalStep] = useState<'select' | 'roles'>('select');

// DELETE handler functions:
const handleNextToRoles = () => setInternalStep('roles');
const handleBackToSelect = () => setInternalStep('select');
```

#### Step 3.4: Use mode prop for rendering

```typescript
// Replace internalStep checks with mode prop:
{mode === 'select' && (
  <div className="contact-selection-view">
    {/* Selection UI - NO FOOTER */}
  </div>
)}

{mode === 'roles' && (
  <div className="role-assignment-view">
    {/* Role assignment UI - NO FOOTER */}
  </div>
)}
```

### Phase 4: Update Tests

**File: `src/components/audit/__tests__/ContactAssignmentStep.test.tsx`**

Update tests to pass the new `mode` prop:

```typescript
// Update test renders to include mode prop:
render(
  <ContactAssignmentStep
    mode="select"
    {...otherProps}
  />
);

// Remove tests for internal navigation buttons (they no longer exist)
// Add tests for mode prop behavior
```

---

## Test Strategy

### Unit Tests

1. **useAuditTransaction hook:**
   - Verify step can be 1, 2, or 3
   - Verify nextStep/prevStep respect boundaries
   - Verify isLastStep is true only for step 3

2. **ContactAssignmentStep:**
   - Verify mode="select" renders selection view
   - Verify mode="roles" renders role assignment view
   - Verify no footer elements in component

3. **AuditTransactionModal:**
   - Verify correct footer buttons for each step
   - Verify Back button appears only for steps 2 and 3
   - Verify Create Transaction button only on step 3

### Manual Testing

1. Open New Audit modal
2. Verify only modal footer has navigation buttons at all times
3. Fill step 1 (address) -> click Continue
4. Verify step 2 (select contacts) shows: `Cancel | <- Back | Next: Assign Roles`
5. Select contacts -> click Next: Assign Roles
6. Verify step 3 (assign roles) shows: `Cancel | <- Back | Create Transaction`
7. Click Back -> verify returns to contact selection
8. Complete flow and verify transaction created
9. Test edit mode: verify single step with Save Changes (if applicable)

---

## Acceptance Criteria

- [ ] Only ONE set of navigation buttons visible at any time (in modal footer)
- [ ] Modal step count is 3 (Address, Select, Roles)
- [ ] "Back" always goes to the previous logical step
- [ ] Step indicator shows all 3 steps (or appropriate progress)
- [ ] No "Click Continue below when done" workaround text
- [ ] No internal footer buttons in ContactAssignmentStep
- [ ] Edit mode still works correctly
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] `npm run lint` passes

---

## SR Engineer Review Notes

**Review Date:** Pending | **Status:** READY FOR TECHNICAL REVIEW

### Branch Information
- **Branch From:** `sprint-066-contact-ux-overhaul`
- **Branch Into:** `sprint-066-contact-ux-overhaul`
- **Suggested Branch Name:** `feature/task-1771-unified-navigation`

### Execution Classification
- **Parallel Safe:** No - significant changes to shared modal/hook
- **Depends On:** TASK-1769 (pending merge - changes to ContactAssignmentStep)
- **Blocks:** None

### Shared File Analysis
| File | Action | Conflict Risk |
|------|--------|---------------|
| `useAuditTransaction.ts` | MODIFY | Medium (state changes) |
| `AuditTransactionModal.tsx` | MODIFY | Medium (footer refactor) |
| `ContactAssignmentStep.tsx` | MODIFY | Medium (remove internal nav) |

### Technical Considerations
1. **State lifting:** Moving internalStep from component to hook changes data flow
2. **Edit mode:** Verify edit mode (if used) still works with 3-step model
3. **Keyboard navigation:** Ensure hotkeys (if any) work with new structure
4. **Accessibility:** Single navigation improves screen reader experience

### Risk Level: MEDIUM
- Multiple file changes
- State management refactor
- Must maintain backward compatibility for edit mode
- Test updates required

### Recommended Approach
Option A (Lift State to Parent) is recommended over Option B (Callback Pattern) because:
- Cleaner data flow
- Easier to reason about step state
- Better for future extensibility

---

## Estimated Effort

~20K tokens

---

## Implementation Summary

### Files Changed
| File | Lines Added | Lines Removed | Summary |
|------|-------------|---------------|---------|
| `src/hooks/useAuditTransaction.ts` | ~25 | ~10 | Added selectedContactIds state, updated step logic for 3-step flow |
| `src/components/AuditTransactionModal.tsx` | ~30 | ~15 | Updated to render 3 steps with mode prop, updated footer buttons |
| `src/components/audit/ContactAssignmentStep.tsx` | ~40 | ~60 | Added mode prop, removed internal navigation, lifted selectedContactIds |
| `src/components/audit/ContactAssignmentStep.test.tsx` | ~100 | ~100 | Rewrote tests for mode-based rendering |
| `src/components/__tests__/AuditTransactionModal.test.tsx` | ~3 | ~3 | Updated test to expect 3 steps |

### Test Results
- [x] `npm test` passed (60 tests pass for AuditTransaction/ContactAssignment)
- [x] `npm run type-check` passed
- [x] `npm run lint` passed (for modified files)

### Manual Verification
- [x] Single navigation footer in all steps (internal footers removed)
- [x] Back button works correctly (modal footer only)
- [ ] Create Transaction flow completes (requires manual testing)
- [ ] Edit mode works (requires manual testing)

### Notes

**Implementation followed the plan with these key changes:**

1. **State Lifting:** The `selectedContactIds` state was lifted from `ContactAssignmentStep` to `useAuditTransaction` hook. This allows the state to persist when switching between mode="select" and mode="roles".

2. **Mode Prop:** Added `mode: 'select' | 'roles'` prop to `ContactAssignmentStep` to control which view is rendered. The parent modal now manages step transitions.

3. **Footer Removal:** Removed all internal navigation footers from `ContactAssignmentStep`. Navigation is now exclusively in the modal footer with these button labels:
   - Step 1: "Continue"
   - Step 2: "Next: Assign Roles"
   - Step 3: "Create Transaction"

4. **Test Refactoring:** Created a `TestWrapper` component in tests to manage `selectedContactIds` state, since the component now expects it from parent.

5. **Data Flow:** The `selectedContactIds` is initialized from `contactAssignments` when editing a transaction, ensuring proper pre-population.
