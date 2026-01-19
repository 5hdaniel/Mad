# BACKLOG-171: Contacts Not Pre-Populated When Editing Transaction

**Created**: 2026-01-05
**Priority**: High
**Category**: Bug Fix
**Status**: In Sprint
**Assigned To**: TASK-995 (SPRINT-027)

---

## Description

When clicking "Edit" to edit a transaction from the transaction detail window, the contact assignments are not pre-populated in the edit form.

**What works:**
- Address field correctly pre-fills with existing transaction address
- Transaction type correctly pre-fills with existing type

**What does NOT work:**
- On the following screen (contact assignment step), linked/saved contacts do NOT pre-populate
- User has to re-select all contacts even though they are already assigned to the transaction

## Root Cause Hypothesis

This appears to be a data loading issue where `contact_assignments` are not being passed through when entering edit mode, or the edit form is not receiving/using the existing contact assignments when initializing.

## Investigation Areas

1. **EditTransactionModal.tsx**: Check if `contact_assignments` are being passed to the modal
2. **Transaction detail query**: Verify the transaction query includes contact assignments
3. **Form initialization**: Check if the multi-step form properly initializes contact state from existing data
4. **State persistence**: Verify contact selections persist between form steps

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/transaction/components/EditTransactionModal.tsx` | Main edit modal |
| `src/components/transactionDetailsModule/TransactionDetailsPage.tsx` | Provides transaction data to edit |
| `src/hooks/useTransactionDetails.ts` | Transaction data fetching |
| `src/components/ContactSelectModal.tsx` | Contact selection UI |

## Related Issues

- BACKLOG-103 (Fixed): Contact selection issue in transaction creation - different bug, already completed in SPRINT-010 (TASK-700)
- BACKLOG-158 (Pending): Decompose AuditTransactionModal - refactoring item, not the same bug

## Acceptance Criteria

- [ ] When editing a transaction, existing contact assignments pre-populate in the form
- [ ] All roles (client, agent, lender, title, etc.) show their previously assigned contacts
- [ ] User can modify contact assignments (add/remove)
- [ ] Saving preserves both unchanged and modified contact assignments
- [ ] No regression in new transaction creation flow

## Estimated Effort

- **Est. Tokens:** ~25K
- **Category:** ui (1.0x multiplier)
- **Notes:** Investigation-first task; may require debugging data flow between transaction details and edit modal

---

## Notes

This is a different bug from BACKLOG-103 which addressed contact selection during transaction creation. This bug specifically affects the edit workflow where existing data should pre-populate but contacts do not.
