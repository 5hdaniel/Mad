# BACKLOG-446: Email Count Shows 0 Despite Emails Being Attached

**Priority:** P1 (High)
**Category:** bug / ui
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~10K

---

## Summary

Email count displays as 0 in multiple places even when emails are attached to a transaction:
1. Transaction details modal - "Emails (0)" tab label
2. Transaction card on main transaction list page

---

## Problem Statement

User reported:
- Transaction has 1 email attached (visible in the Emails tab content)
- Tab label shows "Emails (0)"
- Transaction card also shows incorrect email count

### Screenshots/Evidence

Transaction details showing email from `madison.delvigo@cbolympia.com` about "Email Audits" but tab shows "Emails (0)".

---

## Root Cause Analysis

### Transaction Details Modal

The email count comes from `transaction.email_count` which is passed to `TransactionTabs`:
```tsx
// TransactionDetails.tsx:378
emailCount={transaction.email_count || 0}
```

The `getTransactionById` query does a simple `SELECT *` and doesn't compute `email_count`. A fix was attempted to add the computed count but may not be working.

### Transaction Card

The transaction card likely reads from the list query which DOES compute email_count, but there may be a mismatch between:
- How communications are linked (junction table vs direct)
- How email_count is computed (channel detection)

### The Query Issue

Email count computation relies on detecting channel='email':
```sql
AND COALESCE(m.channel, c.communication_type) = 'email'
```

If emails are linked differently (e.g., directly to communications table without message reference), the count may fail.

---

## Proposed Solution

1. **Verify the computed email_count query works** - Test the SQL directly
2. **Ensure consistency** - Both list and detail views should use same counting logic
3. **Consider stored field** - Like `text_thread_count`, add `email_count` column and keep it updated

---

## Files to Check/Modify

| File | Purpose |
|------|---------|
| `electron/services/db/transactionDbService.ts` | getTransactionById query |
| `electron/services/db/communicationDbService.ts` | Email linking logic |
| `src/components/TransactionDetails.tsx` | How emailCount is passed |
| `src/components/transaction/components/TransactionCard.tsx` | Card email count display |

---

## Acceptance Criteria

- [ ] Email tab shows correct count matching visible emails
- [ ] Transaction card shows correct email count
- [ ] Counts update when emails are attached/unlinked
- [ ] Consistent counting logic across list and detail views

---

## Related Items

- BACKLOG-408: Sync Communications Not Finding Emails
- Similar to text_thread_count fix (BACKLOG-396)
