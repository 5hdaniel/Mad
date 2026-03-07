# BACKLOG-858: Transaction count not incrementing and limit gate broken

**Type:** bug
**Area:** service
**Priority:** medium
**Status:** pending

---

## Description

Two related issues with the transaction licensing system:

### Bug 1: transaction_count not incrementing
- The `transaction_count` column in the `licenses` table stays at 0 despite 5 actual transactions existing in `transaction_submissions`
- The submission flow is not incrementing the count when transactions are created
- Affected user: `agent@izzyrescue.org` (user_id: `ef052d1b-17f6-4f6c-ad31-114f3cdce82f`)

### Bug 2: null transaction_limit treated as "no plan"
- When `transaction_limit` is NULL, the app displays "Transaction Limit Reached" with "You've used 0 of Infinity transactions. Upgrade to create more."
- NULL should mean "unlimited" but the gate logic blocks transaction creation
- The UI shows "Infinity" (correct interpretation) but still blocks (incorrect gate logic)

## Evidence

```sql
-- License record
SELECT transaction_count, transaction_limit FROM licenses
WHERE user_id = 'ef052d1b-17f6-4f6c-ad31-114f3cdce82f';
-- Result: transaction_count = 0, transaction_limit = NULL

-- Actual transactions
SELECT COUNT(*) FROM transaction_submissions ts
JOIN organization_members om ON om.organization_id = ts.organization_id
WHERE om.user_id = 'ef052d1b-17f6-4f6c-ad31-114f3cdce82f';
-- Result: 5
```

## Investigation Notes

- Check the transaction submission flow for where `transaction_count` should be incremented (likely a Supabase function or app-side logic after insert)
- Check the license gate logic in the renderer — look for how `transaction_limit = null` is evaluated
- May need both a Supabase fix (increment trigger or RPC) and a client-side fix (null = unlimited)

## Discovered

2026-03-06, during SPRINT-114 QA testing
