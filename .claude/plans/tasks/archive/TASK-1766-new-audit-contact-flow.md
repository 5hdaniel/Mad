# TASK-1766: New Audit Contact Flow (Search-First)

**Backlog ID:** SPRINT-066
**Sprint:** SPRINT-066 - Contact Management UX Overhaul
**Phase:** Phase 3 - New Audit Flow Update
**Branch:** `feature/task-1766-new-audit-contact-flow`
**Estimated Tokens:** ~20K
**Depends On:** TASK-1765 (EditContactsModal patterns)

---

## Objective

Update the New Audit (transaction creation) contact flow to use a search-first approach:
- **Step 1**: Go directly to search/select screen (since no contacts exist yet)
- **Step 2**: Assign roles to selected contacts
- Complete transaction creation

This differs from Edit Contacts because there are no pre-assigned contacts to show.

---

## Context

The current New Audit flow uses ContactAssignmentStep which has a similar 2-step process. The new UX inverts the focus:

**Current Flow:**
1. Enter transaction details
2. ContactAssignmentStep: Select contacts (existing ContactSelector)
3. ContactAssignmentStep: Assign roles (RoleAssigner)
4. Review and create

**New Flow:**
1. Enter transaction details
2. **Step 1**: Search/select contacts (ContactSearchList with external support)
3. **Step 2**: Assign roles (ContactRoleRow list)
4. Review and create

The key difference is that Step 1 now includes external contacts with auto-import.

---

## Requirements

### Must Do:
1. Update ContactAssignmentStep to use new flow
2. Step 1: Use ContactSearchList component for search/select
3. Step 2: Show selected contacts with ContactRoleRow for role assignment
4. Support external contact auto-import in Step 1
5. External contacts imported when "Next" is clicked
6. Integrate with existing audit creation flow
7. Update unit tests

### Must NOT Do:
- Do not change other audit steps (property, details, etc.)
- Do not modify the transaction creation API
- Do not remove the step-based navigation pattern

---

## Acceptance Criteria

- [ ] Step 1 shows ContactSearchList with imported + external contacts
- [ ] External contacts can be selected and show [+] import indicator
- [ ] Clicking "Next" imports any selected external contacts
- [ ] Step 2 shows selected contacts with role dropdowns
- [ ] All selected contacts appear in Step 2 (including just-imported)
- [ ] Role assignment works correctly
- [ ] "Create Audit" completes transaction with contact assignments
- [ ] Back button returns to Step 1 preserving selection
- [ ] Tests pass for new flow

---

## Technical Specification

### Step 1: Contact Selection

```tsx
// ContactAssignmentStep - Step 1
const [step, setStep] = useState<1 | 2>(1);
const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
const [roleAssignments, setRoleAssignments] = useState<Map<string, string>>(new Map());

// Step 1 UI
{step === 1 && (
  <div className="flex flex-col h-full">
    <div className="flex-1">
      <ContactSearchList
        contacts={contacts}
        externalContacts={externalContacts}
        selectedIds={selectedContactIds}
        onSelectionChange={setSelectedContactIds}
        onImportContact={handleImportContact}
      />
    </div>

    <div className="flex justify-between p-4 border-t">
      <button onClick={onBack}>Back</button>
      <button
        onClick={handleNextToRoles}
        disabled={selectedContactIds.length === 0}
      >
        Next: Assign Roles
      </button>
    </div>
  </div>
)}
```

### Step 2: Role Assignment

```tsx
// Step 2 UI
{step === 2 && (
  <div className="flex flex-col h-full">
    <div className="p-4">
      <h3 className="font-semibold mb-4">Assign Roles to Contacts</h3>
      <p className="text-sm text-gray-500 mb-4">
        {assignedCount} of {selectedContacts.length} contacts have roles
      </p>
    </div>

    <div className="flex-1 overflow-y-auto px-4">
      <div className="space-y-2">
        {selectedContacts.map((contact) => (
          <ContactRoleRow
            key={contact.id}
            contact={contact}
            currentRole={roleAssignments.get(contact.id) || ''}
            roleOptions={roleOptions}
            onRoleChange={(role) => handleRoleChange(contact.id, role)}
          />
        ))}
      </div>
    </div>

    <div className="flex justify-between p-4 border-t">
      <button onClick={() => setStep(1)}>Back</button>
      <button
        onClick={handleCreateAudit}
        disabled={!canCreate}
      >
        Create Audit
      </button>
    </div>
  </div>
)}
```

### Handling External Contact Import

```tsx
const handleNextToRoles = async () => {
  // Check if any selected contacts are external
  const selectedExternals = externalContacts.filter(c =>
    selectedContactIds.includes(c.id)
  );

  if (selectedExternals.length > 0) {
    setImporting(true);
    try {
      // Import all selected external contacts
      const importPromises = selectedExternals.map(async (external) => {
        const imported = await handleImportContact(external);
        // Update selection to use imported ID
        setSelectedContactIds(prev =>
          prev.map(id => id === external.id ? imported.id : id)
        );
        return imported;
      });
      await Promise.all(importPromises);
    } catch (err) {
      setError('Failed to import some contacts');
      return;
    } finally {
      setImporting(false);
    }
  }

  setStep(2);
};
```

### Integration with Audit Creation

```tsx
// When completing the audit
const handleCreateAudit = async () => {
  // Build contact assignments for transaction creation
  const contactAssignments = [];

  for (const contactId of selectedContactIds) {
    const role = roleAssignments.get(contactId);
    if (role) {
      contactAssignments.push({
        contactId,
        role,
        roleCategory: ROLE_TO_CATEGORY[role] || 'support',
      });
    }
  }

  // Pass to parent for transaction creation
  onComplete({
    ...transactionData,
    contactAssignments,
  });
};
```

### Role Options

Use the same role filtering as RoleAssigner:

```tsx
const roleOptions = useMemo(() => {
  const options: RoleOption[] = [];

  AUDIT_WORKFLOW_STEPS.forEach((step) => {
    const filteredRoles = filterRolesByTransactionType(
      step.roles,
      transactionType,
      step.title
    );

    filteredRoles.forEach((roleConfig) => {
      options.push({
        value: roleConfig.role,
        label: getRoleDisplayName(roleConfig.role, transactionType),
      });
    });
  });

  return options;
}, [transactionType]);
```

---

## Visual Design

### Step 1: Search & Select

```
+----------------------------------------------------------+
| Step 3 of 4: Select Contacts                             |
+----------------------------------------------------------+
| Search: [____________________________]                   |
|                                                          |
| [x] [Avatar] John Smith    [Imported]                    |
|              john@email.com                              |
|                                                          |
| [x] [Avatar] Alice Brown   [External] [+]                |
|              alice@ex.com                                |
|                                                          |
| [ ] [Avatar] Bob Wilson    [External] [+]                |
|              bob@work.com                                |
|                                                          |
| Selected: 2 contacts                                     |
+----------------------------------------------------------+
| [< Back]                              [Next: Assign Roles]|
+----------------------------------------------------------+
```

### Step 2: Assign Roles

```
+----------------------------------------------------------+
| Step 3 of 4: Assign Roles                                |
+----------------------------------------------------------+
| Assign Roles to Contacts                                 |
| 1 of 2 contacts have roles assigned                      |
|                                                          |
| [Avatar] John Smith        [Imported] [Role: Buyer     v]|
|          john@email.com                                  |
|                                                          |
| [Avatar] Alice Brown       [Imported] [Select role...  v]|
|          alice@ex.com      (just imported)               |
|                                                          |
+----------------------------------------------------------+
| [< Back]                                   [Create Audit]|
+----------------------------------------------------------+
```

---

## Files to Modify

- **Modify:** `src/components/audit/ContactAssignmentStep.tsx` - Major refactor
- **Modify:** `src/components/audit/ContactAssignmentStep.test.tsx` - Update tests (if exists)

## Files to Read (for context)

- `src/components/shared/ContactSearchList.tsx` - Dependency (TASK-1763)
- `src/components/shared/ContactRoleRow.tsx` - Dependency (TASK-1764)
- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Pattern reference (TASK-1765)
- `src/constants/contactRoles.ts` - Role definitions

---

## Testing Expectations

### Unit Tests

**Required:** Yes

```tsx
describe('ContactAssignmentStep - New Flow', () => {
  describe('Step 1: Contact Selection', () => {
    it('shows ContactSearchList component', () => {});
    it('displays both imported and external contacts', () => {});
    it('allows selecting multiple contacts', () => {});
    it('shows selection count', () => {});
    it('disables Next when no contacts selected', () => {});
  });

  describe('Step 1 to Step 2 transition', () => {
    it('imports selected external contacts on Next', () => {});
    it('shows loading state while importing', () => {});
    it('handles import errors gracefully', () => {});
    it('advances to Step 2 after import completes', () => {});
  });

  describe('Step 2: Role Assignment', () => {
    it('shows all selected contacts with role dropdowns', () => {});
    it('includes just-imported contacts', () => {});
    it('updates role assignment on dropdown change', () => {});
    it('shows assigned count', () => {});
  });

  describe('navigation', () => {
    it('Back button returns to Step 1', () => {});
    it('preserves selection when going back', () => {});
    it('preserves role assignments when going back', () => {});
  });

  describe('audit creation', () => {
    it('calls onComplete with contact assignments', () => {});
    it('includes role and roleCategory in assignments', () => {});
  });
});
```

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(audit): update contact flow to search-first (TASK-1766)`
- **Branch:** `feature/task-1766-new-audit-contact-flow`
- **Target:** `sprint-066-contact-ux-overhaul`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from sprint-066-contact-ux-overhaul
- [ ] Verified TASK-1765 is merged (uses same patterns)
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

- **Before**: Select contacts, then assign roles separately
- **After**: Search-first flow with auto-import, then role assignment
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: ~20K)
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
- TASK-1765 is not merged yet
- The audit step numbering/navigation needs to change
- External contact import API is different than expected
- You need to modify the transaction creation payload significantly
