# TASK-1760: Redesign RoleAssigner to Contact-Centric Approach

## Status: READY FOR IMPLEMENTATION

## Overview

The current RoleAssigner (Step 2 of contact selection flow) is too complex. It displays ALL available roles in a grid, each with a dropdown to pick contacts. The user wants a simpler contact-centric approach.

## User Feedback

**Current (Bad):**
- Shows all 15+ roles in a 2-column grid (Client & Agents section + Professional Services section)
- Each role slot has a dropdown to add contacts
- Overwhelming UI - user sees 15+ empty slots they need to fill

**Desired (Simple):**
- Show only the selected contacts from Step 1 (no role slots)
- Each contact has a dropdown next to it to pick their role
- Simple list format: `[Contact Avatar] [Contact Name] -> [Role Dropdown]`
- Much cleaner, contact-centric UI

## File to Modify

`/Users/daniel/Documents/Mad/src/components/shared/RoleAssigner.tsx`

---

## Technical Requirements

### 1. Remove the Role-Centric Grid Layout

**DELETE these components (no longer needed):**
- `RoleSlot` component (lines 103-197)
- `ContactChip` component (lines 62-99) - contacts won't be in chips anymore
- The entire right panel with `AUDIT_WORKFLOW_STEPS.map()` logic (lines 424-478)

**KEEP these components (still useful):**
- `ContactSidebarItem` - refactor to become the main list item

### 2. Create New Contact-Centric Layout

Replace the two-panel layout with a single-panel list:

```tsx
// New structure - simple list
<div className="space-y-2 p-4">
  {selectedContacts.map((contact) => (
    <ContactRoleRow
      key={contact.id}
      contact={contact}
      assignedRoles={contactRolesMap.get(contact.id) || []}
      availableRoles={allRoles}  // Filtered by transaction type
      transactionType={transactionType}
      onRoleChange={(role) => handleRoleChange(contact.id, role)}
    />
  ))}
</div>
```

### 3. New `ContactRoleRow` Component Design

Each row should display:

```
[Avatar] [Contact Name + Email]  [Role Dropdown v]
```

**Layout spec:**
- Left: Contact avatar (32x32 circle with initial)
- Middle: Contact name (bold) + email (smaller, gray) - stacked vertically
- Right: Role dropdown (select element)

**Role dropdown options:**
1. First option: "Select role..." (empty value)
2. Grouped options by category OR flat list of all roles
3. Include "Other" at the end

**Recommended: Flat list for simplicity:**
```tsx
<select value={currentRole} onChange={...}>
  <option value="">Select role...</option>
  <option value="client">Buyer/Seller (Client)</option>
  <option value="seller_agent">Seller Agent</option>
  <option value="buyer_agent">Buyer Agent</option>
  <option value="title_company">Title Company</option>
  <option value="escrow_officer">Escrow Officer</option>
  <option value="inspector">Inspector</option>
  <option value="appraiser">Appraiser</option>
  <option value="mortgage_broker">Mortgage Broker</option>
  <option value="real_estate_attorney">Real Estate Attorney</option>
  <option value="transaction_coordinator">Transaction Coordinator</option>
  <option value="insurance_agent">Insurance Agent</option>
  <option value="hoa_management">HOA Management</option>
  <option value="other">Other</option>
</select>
```

### 4. Data Model Changes

**Current model (role-centric):**
```ts
assignments: { [role: string]: string[] }  // role -> contactIds
```

**Keep the same model** - the parent component expects this format. Just change how the UI populates it.

**New behavior:**
- When user selects a role for a contact, update `assignments` to add that contact to the role
- A contact can only have ONE role at a time (simplification)
- If user changes a contact's role, remove them from old role, add to new role

### 5. Handler Logic

```tsx
const handleRoleChange = useCallback((contactId: string, newRole: string) => {
  // Build new assignments object
  const newAssignments: RoleAssignments = {};

  // First, copy all existing assignments except this contact
  Object.entries(assignments).forEach(([role, ids]) => {
    newAssignments[role] = ids.filter(id => id !== contactId);
  });

  // Then add contact to new role (if not empty)
  if (newRole) {
    newAssignments[newRole] = [...(newAssignments[newRole] || []), contactId];
  }

  // Clean up empty arrays
  Object.keys(newAssignments).forEach(role => {
    if (newAssignments[role].length === 0) {
      delete newAssignments[role];
    }
  });

  onAssignmentsChange(newAssignments);
}, [assignments, onAssignmentsChange]);
```

### 6. Helper to Get Contact's Current Role

```tsx
const getContactRole = useCallback((contactId: string): string => {
  for (const [role, ids] of Object.entries(assignments)) {
    if (ids.includes(contactId)) {
      return role;
    }
  }
  return ""; // No role assigned
}, [assignments]);
```

### 7. Build Filtered Role Options

Use existing utilities but create a flat list:

```tsx
const roleOptions = useMemo(() => {
  // Get all unique roles from AUDIT_WORKFLOW_STEPS
  const allRoles: Array<{value: string, label: string}> = [];

  AUDIT_WORKFLOW_STEPS.forEach((step) => {
    const filteredRoles = filterRolesByTransactionType(
      step.roles,
      transactionType,
      step.title
    );

    filteredRoles.forEach((roleConfig) => {
      allRoles.push({
        value: roleConfig.role,
        label: getRoleDisplayName(roleConfig.role, transactionType),
      });
    });
  });

  return allRoles;
}, [transactionType]);
```

---

## Visual Design

### Before (Current - Role Grid)
```
+------------------+--------------------------------+
| Selected Contacts|  Client & Agents               |
|                  |  +--------+  +--------+        |
| [Avatar] John    |  | Client |  | Seller |        |
|   john@email.com |  |  [v]   |  | Agent  |        |
|                  |  +--------+  |  [v]   |        |
| [Avatar] Jane    |              +--------+        |
|   jane@email.com |                                |
|                  |  Professional Services         |
|                  |  +--------+  +--------+  ...   |
|                  |  | Title  |  | Escrow |        |
|                  |  |  [v]   |  |  [v]   |        |
+------------------+--------------------------------+
```

### After (New - Contact List)
```
+----------------------------------------------------+
|  Assign Roles to Selected Contacts                  |
|                                                     |
|  [Avatar] John Smith                   [Role    v]  |
|           john@email.com                            |
|                                                     |
|  [Avatar] Jane Doe                     [Role    v]  |
|           jane@email.com                            |
|                                                     |
|  [Avatar] Title Company Inc            [Role    v]  |
|           contact@title.com                         |
+----------------------------------------------------+
```

---

## Props Interface (No Changes)

The `RoleAssignerProps` interface stays the same:

```tsx
export interface RoleAssignerProps {
  selectedContacts: ExtendedContact[];
  transactionType: "purchase" | "sale" | "other";
  assignments: RoleAssignments;
  onAssignmentsChange: (assignments: RoleAssignments) => void;
  className?: string;
}
```

---

## Test IDs to Maintain

Update test IDs for the new structure:
- `data-testid="role-assigner"` - main container (keep)
- `data-testid="contact-role-row-{contactId}"` - each contact row (new)
- `data-testid="role-select-{contactId}"` - role dropdown per contact (new)

Remove old test IDs:
- `data-testid="role-slot-{role}"` - no longer needed
- `data-testid="contact-chip-{contactId}"` - no longer needed
- `data-testid="workflow-step-{idx}"` - no longer needed

---

## Acceptance Criteria

1. [ ] RoleAssigner displays a simple list of selected contacts
2. [ ] Each contact row shows: avatar, name, email, and role dropdown
3. [ ] Role dropdown contains all valid roles for the transaction type
4. [ ] Selecting a role updates the `assignments` object correctly
5. [ ] Changing a role removes contact from old role and adds to new
6. [ ] "Select role..." option allows unassigning a contact
7. [ ] Props interface unchanged - parent components work without modification
8. [ ] Existing tests updated or replaced to test new UI structure
9. [ ] ARIA labels maintained for accessibility

---

## Test File Update Required

**File:** `/Users/daniel/Documents/Mad/src/components/shared/RoleAssigner.test.tsx`

The existing test file (674 lines) tests the role-centric UI that is being replaced. You must:

### Tests to DELETE (no longer applicable):

1. `"should display workflow step sections"` - no more sections
2. `"should display role slots with names"` - no role slots
3. `"should show required indicator for client role"` - no required indicators
4. `"should show (multiple) indicator for multi-select roles"` - no multiple indicators
5. `"should allow multiple contacts for roles marked as multiple"` - contacts get one role
6. `"should add second contact to same role"` - not testing this way anymore
7. `"should display multiple assigned contacts as chips"` - no chips
8. `"should not show already-assigned contacts in dropdown for same role"` - different logic
9. `"should allow same contact to be assigned to different roles"` - contacts get one role now
10. `"should show all assigned roles for a contact in sidebar"` - no sidebar

### Tests to MODIFY:

1. `"should render the component with sidebar and role area"` -> `"should render contact list"`
2. `"should display all selected contacts in sidebar"` -> `"should display all contacts with role dropdowns"`
3. `"should call onAssignmentsChange when assigning contact to role"` - update selectors
4. `"should show contact count in sidebar header"` - remove or change to simple count
5. `"should update sidebar to show assigned status"` - update for new UI

### Tests to ADD:

```tsx
describe("Contact-Centric Role Assignment", () => {
  it("should display each contact with a role dropdown", () => {
    // Verify contact-role-row-{id} and role-select-{id} test IDs
  });

  it("should show all available roles in each dropdown", () => {
    // Verify dropdown options match filtered roles
  });

  it("should update assignments when role is selected", () => {
    // Select role for contact, verify onAssignmentsChange called correctly
  });

  it("should remove contact from old role when changing to new role", () => {
    // Contact assigned to role A, change to role B
    // Verify contact removed from A and added to B
  });

  it("should clear role when 'Select role...' is chosen", () => {
    // Contact has role, select empty option
    // Verify contact removed from that role
  });

  it("should show current role as selected in dropdown", () => {
    // With pre-existing assignments, verify dropdown shows correct value
  });
});
```

### Test ID Migration:

| Old Test ID | New Test ID |
|-------------|-------------|
| `role-slot-{role}` | (removed) |
| `role-select-{role}` | `role-select-{contactId}` |
| `contact-sidebar-{id}` | `contact-role-row-{id}` |
| `contact-chip-{id}` | (removed) |
| `workflow-step-{idx}` | (removed) |

---

## Out of Scope

- Multi-role assignment (a contact having multiple roles) - keep it simple
- Required role validation UI - can be added later
- Drag-and-drop reordering - not needed

---

## SR Engineer Review Notes

**Review Date:** 2025-01-28 | **Status:** READY FOR IMPLEMENTATION

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1760-roleassigner-contact-centric

### Execution Classification
- **Parallel Safe:** Yes - isolated component change
- **Depends On:** None
- **Blocks:** None

### Shared File Analysis
- Files modified: `src/components/shared/RoleAssigner.tsx`
- Test file: `src/components/shared/__tests__/RoleAssigner.test.tsx` (if exists)
- Conflicts with: None expected

### Technical Considerations
- This is a UI-only refactor - props interface unchanged
- Parent components using RoleAssigner should continue to work
- The `assignments` data structure remains the same
- Simplification: one role per contact (not multiple)

### Risk Level: LOW
- Isolated component change
- No backend/service changes
- No migration required

---

## Engineer Plan

**Created:** 2025-01-28 | **Status:** AWAITING SR ENGINEER REVIEW

### Summary

Refactor `RoleAssigner.tsx` from a role-centric grid layout (15+ role slots with contact dropdowns) to a contact-centric list layout (selected contacts with role dropdowns). This simplifies the UX significantly.

### Implementation Steps

#### Step 1: Add New Helper Functions (~10 lines)

Add two helper functions to the component:

1. **`getContactRole(contactId: string): string`** - Returns the current role for a contact by iterating through assignments. Returns empty string if no role assigned.

2. **`handleRoleChange(contactId: string, newRole: string)`** - Handles role changes:
   - Removes contact from any existing role assignment
   - Adds contact to new role (if not empty)
   - Cleans up empty arrays
   - Calls `onAssignmentsChange`

These replace the current `handleAssign`/`handleUnassign` pattern.

#### Step 2: Add `roleOptions` Memo (~15 lines)

Create a memoized flat list of all available roles:

```tsx
const roleOptions = useMemo(() => {
  const allRoles: Array<{value: string, label: string}> = [];

  AUDIT_WORKFLOW_STEPS.forEach((step) => {
    const filteredRoles = filterRolesByTransactionType(
      step.roles as RoleConfig[],
      transactionType,
      step.title
    );

    filteredRoles.forEach((roleConfig) => {
      allRoles.push({
        value: roleConfig.role,
        label: getRoleDisplayName(roleConfig.role, transactionType),
      });
    });
  });

  return allRoles;
}, [transactionType]);
```

#### Step 3: Create `ContactRoleRow` Component (~45 lines)

New inline component to replace `RoleSlot` and `ContactChip`:

```tsx
interface ContactRoleRowProps {
  contact: ExtendedContact;
  currentRole: string;
  roleOptions: Array<{value: string, label: string}>;
  onRoleChange: (role: string) => void;
}

function ContactRoleRow({
  contact,
  currentRole,
  roleOptions,
  onRoleChange,
}: ContactRoleRowProps): React.ReactElement {
  const displayName = contact.display_name || contact.name || "Unknown";
  const initial = displayName.charAt(0).toUpperCase();
  const email = contact.email || (contact.allEmails?.[0] ?? null);

  return (
    <div
      className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg"
      data-testid={`contact-role-row-${contact.id}`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {initial}
      </div>

      {/* Contact Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm truncate">{displayName}</div>
        {email && <div className="text-xs text-gray-500 truncate">{email}</div>}
      </div>

      {/* Role Dropdown */}
      <select
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none min-w-[160px]"
        value={currentRole}
        onChange={(e) => onRoleChange(e.target.value)}
        aria-label={`Role for ${displayName}`}
        data-testid={`role-select-${contact.id}`}
      >
        <option value="">Select role...</option>
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

#### Step 4: Replace Main JSX (~30 lines changed)

Replace the two-panel layout with a single-panel list:

**Before (lines 366-482):** Two-panel layout with sidebar + role grid

**After:** Single container with header + contact list

```tsx
return (
  <div
    className={`border border-gray-200 rounded-lg overflow-hidden bg-white ${className || ""}`}
    data-testid="role-assigner"
  >
    {/* Header */}
    <div className="p-4 border-b border-gray-200 bg-gray-50">
      <h3 className="font-semibold text-gray-900">Assign Roles to Contacts</h3>
      <p className="text-sm text-gray-500 mt-1">
        {assignedCount} of {selectedContacts.length} contacts have roles assigned
      </p>
    </div>

    {/* Contact List */}
    <div className="p-4">
      {selectedContacts.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>No contacts selected</p>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedContacts.map((contact) => (
            <ContactRoleRow
              key={contact.id}
              contact={contact}
              currentRole={getContactRole(contact.id)}
              roleOptions={roleOptions}
              onRoleChange={(role) => handleRoleChange(contact.id, role)}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);
```

#### Step 5: Delete Unused Code

Remove these components and functions (no longer needed):

1. **`ContactChip`** component (lines 62-99) - contacts no longer shown as chips
2. **`RoleSlot`** component (lines 103-197) - no more role slots
3. **`ContactSidebarItem`** component (lines 200-278) - no more sidebar
4. **`getAvailableContactsForRole`** function (lines 347-353) - not needed
5. **`getAssignedContactsForRole`** function (lines 356-364) - not needed
6. **`handleAssign`** function (lines 321-332) - replaced by `handleRoleChange`
7. **`handleUnassign`** function (lines 335-344) - replaced by `handleRoleChange`

#### Step 6: Update Test File

**File:** `/Users/daniel/Documents/Mad/src/components/shared/RoleAssigner.test.tsx`

**Tests to DELETE (test role-centric UI that no longer exists):**

| Test Name | Line | Reason |
|-----------|------|--------|
| "should display workflow step sections" | 120-132 | No more sections |
| "should display role slots with names" | 134-147 | No role slots |
| "should show required indicator for client role" | 270-283 | No required indicators |
| "should show (multiple) indicator for multi-select roles" | 305-317 | No multiple indicators |
| "should allow multiple contacts for roles marked as multiple" | 286-303 | Contacts get one role |
| "should add second contact to same role" | 319-340 | Different model |
| "should display multiple assigned contacts as chips" | 342-359 | No chips |
| "should not show already-assigned contacts in dropdown for same role" | 419-442 | Different logic |
| "should allow same contact to be assigned to different roles" | 444-464 | Contacts get one role |
| "should show all assigned roles for a contact in sidebar" | 500-518 | No sidebar |
| "should show checkmark for assigned contacts" | 468-484 | No sidebar with checkmarks |
| "should show Unassigned text for contacts without roles" | 486-498 | No sidebar |

**Tests to MODIFY:**

| Test Name | Change |
|-----------|--------|
| "should render the component with sidebar and role area" | Remove sidebar assertion, check for "Assign Roles to Contacts" header |
| "should display all selected contacts in sidebar" | Change to verify `contact-role-row-{id}` test IDs |
| "should call onAssignmentsChange when assigning contact to role" | Update selector from `role-select-client` to `role-select-contact-1` |
| "should show contact count in sidebar header" | Update text expectation to new format |
| "should update sidebar to show assigned status" | Change to verify count update only |
| "should show assigned contact as chip in role slot" | Delete - no chips |
| "should call onAssignmentsChange when removing contact from role" | Modify to test clearing dropdown |

**Tests to ADD:**

```tsx
describe("Contact-Centric Role Assignment", () => {
  it("should display each contact with a role dropdown", () => {
    // Verify contact-role-row-{id} and role-select-{id} test IDs exist
  });

  it("should show all available roles in each dropdown", () => {
    // Verify dropdown options include filtered roles
  });

  it("should remove contact from old role when changing to new role", () => {
    // Contact assigned to role A, change to role B
    // Verify assignments updated correctly
  });

  it("should clear role when empty option is selected", () => {
    // Contact has role, select ""
    // Verify contact removed from assignments
  });

  it("should show current role as selected in dropdown", () => {
    // With pre-existing assignments, verify dropdown value
  });
});
```

### Files Modified

| File | Action | Est. Lines Changed |
|------|--------|-------------------|
| `src/components/shared/RoleAssigner.tsx` | Major refactor | ~200 (net reduction) |
| `src/components/shared/RoleAssigner.test.tsx` | Update tests | ~300 (net reduction) |

### Test Strategy

1. Run existing tests first to see which fail (expected: many)
2. Delete tests for removed functionality
3. Update test selectors for renamed test IDs
4. Add new tests for contact-centric behavior
5. Verify all tests pass: `npm test -- --testPathPattern="RoleAssigner"`

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Parent components expect certain test IDs | Props interface unchanged; only internal test IDs change |
| Role options might be empty | Use existing `filterRolesByTransactionType` which handles this |
| Assignments format change | Data model stays same - only UI changes |

### Estimated Effort

- **Component refactor:** ~45 minutes
- **Test updates:** ~30 minutes
- **Total:** ~1.5 hours / ~15K tokens

### Pre-Implementation Checklist

- [x] Read current component implementation
- [x] Read existing test file
- [x] Understand data model (no changes needed)
- [x] Identify components to delete
- [x] Identify components to create
- [x] Plan test modifications

### Questions for SR Engineer

None - the task spec is clear and complete.
