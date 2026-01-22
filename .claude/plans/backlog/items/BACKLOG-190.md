# BACKLOG-190: Transaction Date Range for Message Linking

**Created**: 2026-01-10
**Priority**: High
**Category**: enhancement/bug
**Status**: Pending

---

## Description

When adding contacts with many messages to a transaction, the app freezes because it tries to link ALL messages from that contact. Messages should be filtered to the transaction date range.

Additionally, Step 1 of the Audit Transaction Modal should be expanded to include transaction start/end dates.

## Current Behavior

- Adding a contact triggers linking ALL their messages (can be thousands)
- App freezes with contacts that have extensive message history
- No way to specify transaction date range
- Step 1 only has address and transaction type

## Expected Behavior

1. **UI Changes (Step 1)**:
   - Rename "Step 1: Verify Property Address" → "Step 1: Transaction Details"
   - Add "Transaction Start Date" (required) - date picker
   - Add "Transaction End Date" (optional) - date picker, defaults to null/ongoing

2. **Backend Changes**:
   - When linking messages to transaction, filter by date range
   - Only link messages where `sent_at >= start_date`
   - If end_date provided, also filter `sent_at <= end_date`
   - Significantly reduces number of messages to process

3. **Performance**:
   - Should prevent freeze even for contacts with years of history
   - Most transactions are < 1 year, so this naturally limits scope

## Technical Notes

### Files to Modify

1. **AddressVerificationStep.tsx** - Add date pickers, rename component?
2. **useAuditTransaction.ts** - Add start_date/end_date to addressData
3. **AuditTransactionModal.tsx** - Update step title
4. **messageMatchingService.ts** - Add date filtering to `autoLinkTextsToTransaction`
5. **schema.sql** - Verify transactions table has start_date/end_date columns

### UI Design

```
Step 1: Transaction Details

Property Address *
[________________________]

Transaction Type *
[Purchase] [Sale]

Transaction Start Date *
[__/__/____]  (date picker)

Transaction End Date (optional)
[__/__/____]  (date picker, or "Ongoing" checkbox)
```

### SQL Filter

```sql
WHERE sent_at >= ?
  AND (? IS NULL OR sent_at <= ?)
```

## Acceptance Criteria

- [ ] Step 1 renamed to "Transaction Details"
- [ ] Start date picker added (required)
- [ ] End date picker added (optional)
- [ ] Dates stored in transaction record
- [ ] Message linking filters by transaction date range
- [ ] No freeze when adding contacts with extensive history
- [ ] Existing transactions without dates continue to work

## Estimated Tokens

~15,000 (UI + backend changes)

---

## Notes

Reported during SPRINT-029 session. Root cause is unbounded message linking.
Real estate transactions typically span weeks to months, not years.
