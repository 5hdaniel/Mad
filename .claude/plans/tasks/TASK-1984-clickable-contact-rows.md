# TASK-1984: Make contact rows clickable everywhere for detail view

**Backlog ID:** BACKLOG-692
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `feature/task-1984-clickable-contact-rows`
**Estimated Tokens:** ~20K (ui x 1.0)

---

## Objective

Anywhere the app displays a contact row, clicking on it should open the contact details screen (with edit capability for imported contacts). This pattern already works on Step 2 of the audit flow (via `ContactSearchList` with `onContactClick`). Extend it to all other contact list locations.

---

## Context

The contact details pattern is already implemented:
- `ContactSearchList` has an `onContactClick` prop (line 52)
- `ContactAssignmentStep` passes `handleContactClick` which opens a `ContactPreview` modal
- `ContactPreview` shows details and has an "Edit" button for imported contacts

Locations that display contact rows and need clickable behavior:
1. **Contacts screen** (`src/components/Contacts.tsx`) - Main contacts list
2. **Transaction Contacts tab** (`src/components/transactionDetailsModule/components/TransactionContactsTab.tsx`) - Contacts assigned to a transaction
3. **Edit Contacts modal** (`src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`) - Screen 1 shows assigned contacts
4. **Contact Role Row** (`src/components/shared/ContactRoleRow.tsx`) - Step 3 of audit, role assignment
5. **ContactSelectModal** (`src/components/ContactSelectModal.tsx`) - Contact picker modal

Each location uses different components (`ContactRow`, `ContactRoleRow`, `ContactCard`, etc.) so the click handler needs to be wired up at each location.

---

## Requirements

### Must Do:
1. Audit all locations where contact rows are rendered
2. For each location, add a click handler that opens `ContactPreview` (or `ContactDetailsModal`)
3. Ensure the contact details view shows:
   - Contact name, email, phone, company
   - Edit button (for imported contacts only, not external/message-derived)
   - Close button
4. Use the existing `ContactPreview` or `ContactDetailsModal` component -- do NOT create a new modal
5. Ensure clicking the row does not interfere with existing selection behavior (checkboxes, role dropdowns, etc.)

### Must NOT Do:
- Create a new contact details component -- reuse existing
- Change the contact data model
- Modify the edit contact form itself
- Break existing selection/checkbox behavior on contact rows

---

## Acceptance Criteria

- [ ] Clicking a contact row on the Contacts screen opens contact details
- [ ] Clicking a contact row on the Transaction Contacts tab opens contact details
- [ ] Clicking a contact in the Edit Contacts modal shows contact details
- [ ] Clicking a contact in Step 3 (role assignment) of audit shows contact details
- [ ] Contact details modal shows edit button for imported contacts
- [ ] Contact details modal does NOT show edit for external/message-derived contacts
- [ ] Existing checkbox/selection behavior is preserved (click on row vs click on checkbox)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/Contacts.tsx` - Add contact click handler and details modal
- `src/components/transactionDetailsModule/components/TransactionContactsTab.tsx` - Add click handler
- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Add click handler to assigned contacts list
- `src/components/shared/ContactRoleRow.tsx` - Add onClick prop for contact name/row area
- `src/components/ContactSelectModal.tsx` - Add click handler

## Files to Read (for context)

- `src/components/audit/ContactAssignmentStep.tsx` - Reference implementation (Step 2 click behavior)
- `src/components/shared/ContactPreview.tsx` - Contact details component
- `src/components/contact/components/ContactDetailsModal.tsx` - Alternative details component
- `src/components/shared/ContactRow.tsx` - Base row component
- `src/components/shared/ContactSearchList.tsx` - `onContactClick` pattern

---

## Testing Expectations

### Unit Tests
- **Required:** No new test files, but may need to update existing tests that simulate row clicks
- **Existing tests to update:** Tests in files being modified if they assert on click behavior

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(contacts): make contact rows clickable for detail view everywhere`
- **Branch:** `feature/task-1984-clickable-contact-rows`
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

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: 20K)
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
- Some contact list locations use completely different patterns that cannot easily reuse ContactPreview
- Adding click handlers breaks existing selection/checkbox behavior and you need guidance on UX priority
- The ContactPreview and ContactDetailsModal are significantly different and you are unsure which to standardize on
- You encounter blockers not covered in the task file
