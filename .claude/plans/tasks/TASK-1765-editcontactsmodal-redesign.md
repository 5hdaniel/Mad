# TASK-1765: EditContactsModal 2-Screen Flow Redesign

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 2 - Edit Contacts Modal Redesign
**Branch:** `feature/task-1765-editcontactsmodal-redesign`
**Estimated Tokens:** ~25K
**Depends On:** TASK-1763 (ContactSearchList), TASK-1764 (ContactRoleRow)

---

## Objective

Redesign the EditContactsModal to implement the new 2-screen UX flow:
- **Screen 1**: Show assigned contacts with role dropdowns + "Add Contacts" button
- **Screen 2**: Search/select modal to add new contacts (imported + external)

This replaces the current 2-step (select then assign) flow with a more intuitive contact-first experience.

---

## Context

The current EditContactsModal (post-TASK-1751) uses a 2-step ContactSelector + RoleAssigner flow. The new design inverts this:

**Current Flow (Being Replaced):**
1. Step 1: Select contacts (checkboxes)
2. Step 2: Assign roles (dropdowns)
3. Save

**New Flow (Target):**
1. Screen 1: View/edit assigned contacts with inline role dropdowns
2. Click "Add Contacts" -> Opens Screen 2 (search/select modal)
3. Screen 2: Search imported + external, select multiple
4. Click "Add Selected" -> Returns to Screen 1 with new contacts
5. Assign roles to new contacts
6. Save

---

## Requirements

### Must Do:
1. Redesign EditContactsModal to show assigned contacts with role dropdowns (Screen 1)
2. Add "Add Contacts" button that opens search modal (Screen 2)
3. Use ContactSearchList component for Screen 2
4. Use ContactRoleRow component for Screen 1 rows
5. Support auto-import of external contacts when adding
6. Maintain existing save logic (batch operations)
7. Update unit tests for new flow
8. Handle edge cases (no contacts, loading states)

### Must NOT Do:
- Do not remove the modal entirely (it's still modal-based)
- Do not change the save API (backend contract unchanged)
- Do not implement inline contact editing (separate feature)

---

## Acceptance Criteria

- [ ] Screen 1 shows assigned contacts with role dropdowns
- [ ] "Add Contacts" button opens Screen 2 modal/overlay
- [ ] Screen 2 shows ContactSearchList with imported + external contacts
- [ ] Selecting contacts in Screen 2 and clicking "Add Selected" adds them to Screen 1
- [ ] External contacts are auto-imported when added
- [ ] New contacts appear in Screen 1 with "Select role..." dropdown
- [ ] Role changes update the assignments state
- [ ] Save button persists all changes (add/remove contacts, role changes)
- [ ] Cancel button discards all changes
- [ ] Tests pass for new flow

---

## Technical Specification

### Screen 1: Assigned Contacts View

```tsx
// Main modal content when not showing add modal
<div className="flex flex-col h-full">
  {/* Header */}
  <div className="flex items-center justify-between p-4 border-b">
    <h3 className="text-lg font-semibold">Edit Transaction Contacts</h3>
    <button onClick={onClose}>X</button>
  </div>

  {/* Assigned Contacts List */}
  <div className="flex-1 overflow-y-auto p-4">
    {assignedContacts.length === 0 ? (
      <EmptyState message="No contacts assigned. Click 'Add Contacts' to get started." />
    ) : (
      <div className="space-y-2">
        {assignedContacts.map((contact) => (
          <ContactRoleRow
            key={contact.id}
            contact={contact}
            currentRole={getRoleForContact(contact.id)}
            roleOptions={roleOptions}
            onRoleChange={(role) => handleRoleChange(contact.id, role)}
          />
        ))}
      </div>
    )}
  </div>

  {/* Footer */}
  <div className="flex items-center justify-between p-4 border-t bg-gray-50">
    <button onClick={() => setShowAddModal(true)} className="btn-secondary">
      + Add Contacts
    </button>
    <div className="flex gap-2">
      <button onClick={onClose} className="btn-cancel">Cancel</button>
      <button onClick={handleSave} className="btn-primary">Save Changes</button>
    </div>
  </div>
</div>
```

### Screen 2: Add Contacts Modal (Overlay)

```tsx
// Rendered as overlay when showAddModal is true
{showAddModal && (
  <div className="absolute inset-0 bg-white flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b">
      <h3 className="text-lg font-semibold">Select Contacts to Add</h3>
      <button onClick={() => setShowAddModal(false)}>X</button>
    </div>

    {/* ContactSearchList */}
    <ContactSearchList
      contacts={availableContacts}
      externalContacts={externalContacts}
      selectedIds={pendingAddIds}
      onSelectionChange={setPendingAddIds}
      onImportContact={handleImportContact}
      className="flex-1"
    />

    {/* Footer */}
    <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
      <button onClick={() => setShowAddModal(false)} className="btn-cancel">Cancel</button>
      <button
        onClick={handleAddSelected}
        disabled={pendingAddIds.length === 0}
        className="btn-primary"
      >
        Add Selected ({pendingAddIds.length})
      </button>
    </div>
  </div>
)}
```

### State Management

```tsx
// Assigned contact IDs (those shown in Screen 1)
const [assignedContactIds, setAssignedContactIds] = useState<string[]>([]);

// Role assignments: contactId -> role
const [roleAssignments, setRoleAssignments] = useState<Map<string, string>>(new Map());

// Screen 2 state
const [showAddModal, setShowAddModal] = useState(false);
const [pendingAddIds, setPendingAddIds] = useState<string[]>([]);

// Available contacts (all contacts minus assigned)
const availableContacts = useMemo(() => {
  return allContacts.filter(c => !assignedContactIds.includes(c.id));
}, [allContacts, assignedContactIds]);

// Assigned contacts with data
const assignedContacts = useMemo(() => {
  return allContacts.filter(c => assignedContactIds.includes(c.id));
}, [allContacts, assignedContactIds]);
```

### Key Handlers

```tsx
// Handle adding selected contacts from Screen 2
const handleAddSelected = () => {
  setAssignedContactIds(prev => [...prev, ...pendingAddIds]);
  setPendingAddIds([]);
  setShowAddModal(false);
};

// Handle role change for a contact
const handleRoleChange = (contactId: string, role: string) => {
  setRoleAssignments(prev => {
    const next = new Map(prev);
    if (role) {
      next.set(contactId, role);
    } else {
      next.delete(contactId);
    }
    return next;
  });
};

// Handle importing an external contact
const handleImportContact = async (external: ExternalContact): Promise<ExtendedContact> => {
  // Call import API
  const result = await window.api.contacts.importExternal(external);
  if (result.success && result.contact) {
    // Add to local contacts list
    setAllContacts(prev => [...prev, result.contact]);
    return result.contact;
  }
  throw new Error(result.error || 'Import failed');
};

// Get role for a contact
const getRoleForContact = (contactId: string): string => {
  return roleAssignments.get(contactId) || '';
};
```

### Save Logic (Largely Unchanged)

The save logic compares current state to original state and generates add/remove operations:

```tsx
const handleSave = async () => {
  setSaving(true);

  try {
    const operations = [];

    // Find removed contacts (in original, not in current)
    for (const orig of originalAssignments) {
      const stillAssigned = assignedContactIds.includes(orig.contact_id);
      const currentRole = roleAssignments.get(orig.contact_id);
      const origRole = orig.role || orig.specific_role;

      if (!stillAssigned || currentRole !== origRole) {
        // Remove old assignment
        operations.push({
          action: 'remove',
          contactId: orig.contact_id,
          role: origRole,
        });
      }
    }

    // Find added contacts (in current, not in original or role changed)
    for (const contactId of assignedContactIds) {
      const role = roleAssignments.get(contactId);
      if (!role) continue; // Skip unassigned

      const orig = originalAssignments.find(a => a.contact_id === contactId);
      const origRole = orig?.role || orig?.specific_role;

      if (!orig || origRole !== role) {
        operations.push({
          action: 'add',
          contactId,
          role,
          roleCategory: ROLE_TO_CATEGORY[role] || 'support',
          specificRole: role,
        });
      }
    }

    if (operations.length > 0) {
      const result = await window.api.transactions.batchUpdateContacts(
        transaction.id,
        operations
      );
      if (!result.success) {
        throw new Error(result.error);
      }
    }

    onSave();
    onClose();
  } catch (err) {
    setError(err.message);
    setSaving(false);
  }
};
```

---

## Visual Design

### Screen 1: Assigned Contacts

```
+----------------------------------------------------------+
| Edit Transaction Contacts                            [X] |
+----------------------------------------------------------+
|                                                          |
| [Avatar] John Smith        [Imported] [Role: Buyer     v]|
|          john@email.com                                  |
|                                                          |
| [Avatar] Jane Doe          [Imported] [Role: Seller Ag v]|
|          jane@realty.com                                 |
|                                                          |
| [Avatar] New Contact       [Imported] [Select role...  v]|
|          new@example.com                                 |
|                                                          |
+----------------------------------------------------------+
| [+ Add Contacts]                   [Cancel] [Save Changes]|
+----------------------------------------------------------+
```

### Screen 2: Add Contacts (Overlay)

```
+----------------------------------------------------------+
| Select Contacts to Add                               [X] |
+----------------------------------------------------------+
| Search: [____________________________]                   |
|                                                          |
| [ ] [Avatar] Alice Brown   [Imported]                    |
|              alice@ex.com                                |
|                                                          |
| [x] [Avatar] Bob Wilson    [External] [+]                |
|              bob@work.com                                |
|                                                          |
| [x] [Avatar] Carol Chen    [External] [+]                |
|              carol@ti.co                                 |
|                                                          |
+----------------------------------------------------------+
|                            [Cancel] [Add Selected (2)]   |
+----------------------------------------------------------+
```

---

## Files to Modify

- **Modify:** `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Major refactor
- **Modify:** `src/components/transactionDetailsModule/components/modals/EditContactsModal.test.tsx` - Update tests

## Files to Read (for context)

- `src/components/shared/ContactSearchList.tsx` - Dependency (TASK-1763)
- `src/components/shared/ContactRoleRow.tsx` - Dependency (TASK-1764)
- `src/components/shared/RoleAssigner.tsx` - Current role assignment patterns
- `src/constants/contactRoles.ts` - Role definitions and categories

---

## Testing Expectations

### Unit Tests

**Required:** Yes - Update existing test file

```tsx
describe('EditContactsModal - New 2-Screen Flow', () => {
  describe('Screen 1: Assigned Contacts', () => {
    it('displays assigned contacts with role dropdowns', () => {});
    it('shows empty state when no contacts assigned', () => {});
    it('updates role when dropdown changed', () => {});
    it('shows "Add Contacts" button', () => {});
  });

  describe('Screen 2: Add Contacts Modal', () => {
    it('opens when "Add Contacts" clicked', () => {});
    it('shows ContactSearchList component', () => {});
    it('allows selecting multiple contacts', () => {});
    it('closes when "Cancel" clicked without adding', () => {});
    it('adds selected contacts when "Add Selected" clicked', () => {});
    it('handles external contact import', () => {});
  });

  describe('integration', () => {
    it('added contacts appear in Screen 1 with unassigned role', () => {});
    it('save generates correct add/remove operations', () => {});
    it('cancel discards all changes', () => {});
  });

  describe('loading and errors', () => {
    it('shows loading state while fetching contacts', () => {});
    it('shows error message on save failure', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): redesign EditContactsModal 2-screen flow (TASK-1765)`
- **Branch:** `feature/task-1765-editcontactsmodal-redesign`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Verified TASK-1763 and TASK-1764 are merged
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

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

- **Before**: 2-step select-then-assign flow
- **After**: 2-screen assigned-first flow with add modal
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~25K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- TASK-1763 or TASK-1764 are not merged yet
- You need to change the save API contract
- External contact import API doesn't exist or behaves differently
- You encounter issues with the overlay/modal nesting pattern
- Save logic becomes significantly different from current implementation
