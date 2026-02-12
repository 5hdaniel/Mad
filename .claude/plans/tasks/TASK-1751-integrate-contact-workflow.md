# Task TASK-1751: Integrate ContactSelector + RoleAssigner into EditContactsModal

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Replace the old role-by-role contact editing UI in `EditContactsModal.tsx` with the new 2-step contact workflow using `ContactSelector` (Step 1) and `RoleAssigner` (Step 2).

## Background

TASK-1720 created `ContactSelector` component and TASK-1721 created `RoleAssigner` component. Both are complete and tested. However, they were never integrated into the actual `EditContactsModal` which still uses the old UI.

**Current (OLD) flow:**
1. Modal opens showing all roles grouped by category
2. Each role has "+ Add Contact" button
3. User adds contacts one role at a time

**New (desired) flow:**
1. Modal opens showing ContactSelector (Step 1)
2. User selects contacts they want to involve in the transaction
3. User clicks "Next" to proceed to RoleAssigner (Step 2)
4. User assigns roles to the selected contacts
5. User clicks "Save" to apply changes

## Non-Goals

- Do NOT modify ContactSelector or RoleAssigner components (they're already complete)
- Do NOT change the backend/API for contact updates
- Do NOT change the data model

## Deliverables

1. **Modify:** `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`
   - Remove inline `EditContactAssignments` and `EditRoleAssignment` sub-components
   - Import and use `ContactSelector` and `RoleAssigner`
   - Add step state management (step 1 vs step 2)
   - Update header to show current step
   - Add "Back" / "Next" navigation between steps
   - Keep existing save logic (adapt to RoleAssigner output format)

2. **Update tests:** Ensure modal tests pass with new flow

## Acceptance Criteria

- [x] EditContactsModal shows ContactSelector as Step 1
- [x] User can select multiple contacts with checkboxes
- [x] "Next" button advances to RoleAssigner (Step 2)
- [x] RoleAssigner shows selected contacts on left, role slots on right
- [x] User can drag/click to assign contacts to roles
- [x] "Back" button returns to Step 1 (preserving selections)
- [x] "Save Changes" applies the role assignments
- [x] All existing functionality preserved (required roles validation, etc.)
- [x] Type-check passes
- [x] Tests pass

## Files to Modify

```
src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx
  - Main file to refactor

src/components/shared/ContactSelector.tsx
  - Import only (do not modify)

src/components/shared/RoleAssigner.tsx
  - Import only (do not modify)
```

## Implementation Notes

### State Changes

```typescript
// New state
const [step, setStep] = useState<1 | 2>(1);
const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
const [roleAssignments, setRoleAssignments] = useState<{ [role: string]: string[] }>({});

// Initialize selectedContactIds from existing contacts on mount
useEffect(() => {
  const existingIds = Object.values(contactAssignments).flat().map(c => c.id);
  setSelectedContactIds([...new Set(existingIds)]);
}, []);
```

### UI Structure

```tsx
{step === 1 ? (
  <>
    <ContactSelector
      contacts={allContacts}
      selectedIds={selectedContactIds}
      onSelectionChange={setSelectedContactIds}
      isLoading={loadingContacts}
    />
    <Button onClick={() => setStep(2)}>Next: Assign Roles</Button>
  </>
) : (
  <>
    <RoleAssigner
      selectedContacts={selectedContacts}
      transactionType={transactionType}
      assignments={roleAssignments}
      onAssignmentsChange={setRoleAssignments}
    />
    <Button onClick={() => setStep(1)}>Back</Button>
    <Button onClick={handleSave}>Save Changes</Button>
  </>
)}
```

### Save Logic Adaptation

The existing `handleSave` function groups operations by role. The RoleAssigner output is `{ [role: string]: contactId[] }` which is similar. Adapt to:

```typescript
// Convert RoleAssigner output to batch operations
for (const [role, contactIds] of Object.entries(roleAssignments)) {
  for (const contactId of contactIds) {
    // Find contact from allContacts
    const contact = allContacts.find(c => c.id === contactId);
    // Add to batch...
  }
}
```

## PM Estimate

**Category:** `service`
**Estimated Tokens:** ~30-40K
**Token Cap:** 160K (4x upper estimate)

This is a significant refactor of the modal structure but the new components handle most of the complexity.

---

## Implementation Summary (Engineer-Owned)

### Completed: 2026-01-28

### Changes Made

**Modified File:** `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`

1. **Complete Refactor to 2-Step Workflow**
   - Replaced inline `EditContactAssignments` and `EditRoleAssignment` sub-components with new architecture
   - Added step state management (`step: 1 | 2`)
   - Step 1 shows `ContactSelector` for multi-select contact selection
   - Step 2 shows `RoleAssigner` for role assignment

2. **State Management**
   - `step` - Current step (1 or 2)
   - `selectedContactIds` - Array of selected contact IDs (persisted across steps)
   - `roleAssignments` - Map of role -> contact IDs (RoleAssignments type from RoleAssigner)
   - `originalAssignments` - Cached original assignments for save diffing

3. **UI Updates**
   - Added step progress indicator with visual stepper (Step 1/2)
   - Header shows current step info
   - Footer navigation: Cancel/Next on Step 1, Back/Save on Step 2
   - "Next" button disabled when no contacts selected
   - Preserved existing styling patterns (blue/indigo gradients)

4. **Save Logic Adaptation**
   - Adapted `handleSave` to work with RoleAssigner output format
   - Uses set comparison to determine add/remove operations
   - Maintains compatibility with `batchUpdateContacts` API
   - Preserves autoLinkResults functionality (TASK-1126)

5. **Data Flow**
   - On mount: Load existing assignments, populate both `selectedContactIds` and `roleAssignments`
   - Step 1 -> Step 2: Selected contacts passed to RoleAssigner
   - On deselect in Step 1: Role assignments for that contact are cleaned up
   - On save: Diff current vs original, generate batch operations

### Components Used (No Modifications)
- `ContactSelector` from `src/components/shared/ContactSelector.tsx`
- `RoleAssigner` from `src/components/shared/RoleAssigner.tsx`

### Testing
- Type-check: PASS
- Lint (EditContactsModal.tsx): PASS
- ContactSelector tests: 39 passed
- RoleAssigner tests: 39 passed
- TransactionDetails tests: 258 passed

### Removed Code
- `EditContactAssignments` sub-component (was ~70 lines)
- `EditRoleAssignment` sub-component (was ~90 lines)
- `EditContactAssignmentsProps` interface
- `EditRoleAssignmentProps` interface
- `ContactSelectModal` import (no longer used)

### Lines Changed
- Before: 627 lines
- After: 502 lines
- Net: -125 lines (removed old inline components)

---

## SR Engineer Review (SR-Owned)

*To be completed by SR Engineer*
