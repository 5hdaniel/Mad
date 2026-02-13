# TASK-1987: Add remove contact button on Step 3 of new audit

**Backlog ID:** BACKLOG-695
**Sprint:** SPRINT-082
**Phase:** 1 - UI Stabilization
**Branch:** `fix/task-1987-remove-contact-step3`
**Estimated Tokens:** ~10K (ui x 1.0)

---

## Objective

On Step 3 (role assignment) of the new audit transaction flow, add a way to remove a selected contact -- just like the remove button that exists in the Edit Transaction Contacts modal (`EditContactsModal`).

---

## Context

- **Step 3 in audit flow** (`src/components/audit/ContactAssignmentStep.tsx` lines 301-337): Renders `ContactRoleRow` for each selected contact with role assignment dropdowns
- The `ContactRoleRow` component (`src/components/shared/ContactRoleRow.tsx`) currently only shows role dropdown and does NOT have a remove/delete button
- **Edit Contacts modal** (`src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`) has remove functionality for assigned contacts -- this is the reference implementation
- The `RoleAssignment` component (`src/components/audit/RoleAssignment.tsx` line 140) has `onRemove` callback, but `ContactRoleRow` does not

The user asks: "Are they not using the same component? Is it an issue with the props?" -- The answer is they use DIFFERENT components:
- Step 3 uses `ContactRoleRow` (shared component, no remove button)
- EditContactsModal has its own inline assigned contacts rendering with remove button

The fix: add an optional `onRemove` prop to `ContactRoleRow` that renders a remove/X button when provided.

---

## Requirements

### Must Do:
1. Add an optional `onRemove?: (contactId: string) => void` prop to `ContactRoleRow`
2. When `onRemove` is provided, render a small X/remove button on the row (right side, before or after the role dropdown)
3. Style the remove button to match the existing remove button in `EditContactsModal` (red/gray X icon)
4. In `ContactAssignmentStep.tsx` Step 3, pass `onRemove` to each `ContactRoleRow` that:
   - Removes the contact from `selectedContactIds`
   - Removes any role assignment for that contact
5. When a contact is removed from Step 3, going back to Step 2 should show it as unselected

### Must NOT Do:
- Change the `EditContactsModal` remove behavior
- Add remove buttons to Step 2 (selection step) -- that uses checkboxes already
- Change the `ContactRoleRow` role dropdown behavior
- Remove contacts from the database -- this only deselects them from the current audit

---

## Acceptance Criteria

- [ ] Step 3 of new audit shows a remove button (X icon) on each contact row
- [ ] Clicking remove deselects the contact and removes from the role assignment list
- [ ] Going back to Step 2 shows the removed contact as unselected (checkbox unchecked)
- [ ] The remove button is visually consistent with the one in EditContactsModal
- [ ] When `onRemove` is NOT provided (other usages of ContactRoleRow), no remove button shows
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `src/components/shared/ContactRoleRow.tsx` - Add optional `onRemove` prop and render remove button
- `src/components/audit/ContactAssignmentStep.tsx` - Pass `onRemove` handler to `ContactRoleRow` in Step 3

## Files to Read (for context)

- `src/components/shared/ContactRoleRow.tsx` - Current component interface and rendering
- `src/components/audit/ContactAssignmentStep.tsx` - Step 3 rendering (lines 301-337)
- `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx` - Reference remove button implementation
- `src/components/audit/RoleAssignment.tsx` - Has `onRemove` pattern at line 140

---

## Testing Expectations

### Unit Tests
- **Required:** No new test file, but update existing tests
- **Existing tests to update:**
  - `src/components/shared/ContactRoleRow.test.tsx` - Add test for remove button rendering when `onRemove` is provided
  - `src/components/audit/ContactAssignmentStep.test.tsx` - Test remove behavior in Step 3

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(audit): add remove contact button on Step 3 role assignment`
- **Branch:** `fix/task-1987-remove-contact-step3`
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
- **Actual Tokens**: ~XK (Est: 10K)
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
- `ContactRoleRow` is used in many other places where adding `onRemove` could have unintended side effects
- The remove action needs to also remove communications linked to that contact
- The `onSelectedContactIdsChange` callback does not properly propagate back to Step 2
- You encounter blockers not covered in the task file
