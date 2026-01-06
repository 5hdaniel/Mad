# BACKLOG-163: Edit Active Transactions

**Created**: 2026-01-05
**Priority**: Medium
**Category**: ui
**Status**: Pending
**Sprint**: SPRINT-026

---

## Problem

Currently, the Edit button only appears for "Pending Review" transactions. Once a transaction is approved and becomes "Active", users cannot edit it.

Users need to edit active transactions to:
- Update property details (address corrections)
- Change transaction stage (offer → inspection → closing)
- Modify dates
- Update notes

## Current Behavior

| Status | Edit Available? |
|--------|-----------------|
| Pending Review | ✅ Yes |
| Active | ❌ No |
| Rejected | ❌ No |

## Proposed Change

Add Edit button to Active transactions in `TransactionHeader.tsx`.

## Files Affected

- `src/components/transactionDetailsModule/components/TransactionHeader.tsx`
- `src/components/transaction/components/EditTransactionModal.tsx` (verify compatibility)

## Acceptance Criteria

- [ ] Edit button visible for Active transactions
- [ ] EditTransactionModal opens and works for active transactions
- [ ] Changes save correctly
- [ ] No regression for Pending Review edit flow

## Estimate

~4,000 tokens (simple UI addition)

## Task Reference

TASK-981
