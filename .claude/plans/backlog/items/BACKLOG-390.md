# BACKLOG-390: Email Count Mismatch Between Transaction Card and Details

**Created**: 2026-01-22
**Priority**: High
**Category**: Bug
**Status**: In Progress

---

## Problem

Transaction cards show a different email count than the transaction details view:

- **Transaction Card**: Shows "6 email threads" (from `transaction.email_count`)
- **Transaction Details**: Shows "Emails (0)" (from `emailCommunications.length`)

## Root Cause Analysis

The card uses a **stored count field** (`transaction.email_count`) while the details view uses the **actual linked emails** (`emailCommunications.length`).

These values are out of sync, meaning:
1. The stored count is stale/incorrect, OR
2. Emails were unlinked but count wasn't updated, OR
3. The count was set incorrectly during import/creation

## Files to Investigate

- `src/components/transaction/components/TransactionCard.tsx` - Uses `transaction.email_count`
- `src/components/TransactionDetails.tsx` - Uses `emailCommunications.length`
- Email linking/unlinking logic that should update counts
- Transaction creation/import logic

## Acceptance Criteria

- [ ] Transaction card count matches transaction details count
- [ ] Both use the same source of truth (either stored count OR actual linked emails)
- [ ] If using stored count, ensure it's updated when emails are linked/unlinked

## Related

- BACKLOG-388: Was incorrectly identified as just a label issue
