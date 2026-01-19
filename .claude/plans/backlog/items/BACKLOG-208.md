# BACKLOG-208: Separate Email and Text Message Counts on Transaction Cards

**Created**: 2026-01-11
**Priority**: Medium
**Category**: ui
**Status**: Pending

---

## Description

Transaction cards currently display a combined count showing "X emails" but this count may include text messages or texts are being mislabeled as emails. The UI should separate and accurately display counts for each communication type.

## Problem Context

On the transaction page, transaction cards show something like "12 emails" but:
1. This count may include text messages (SMS/iMessage) mixed with emails
2. Or text messages are being incorrectly labeled as "emails"
3. Users cannot distinguish how many emails vs text messages are linked to a transaction at a glance
4. This creates confusion about what communications are actually associated

## Current Behavior

Transaction cards display:
```
[Transaction Card]
  Property Address
  12 emails
```

But "12 emails" may actually be 8 emails + 4 text messages, or the texts are mislabeled.

## Expected Behavior

Transaction cards should display separate counts:

**Option A (Text labels):**
```
[Transaction Card]
  Property Address
  8 emails, 4 texts
```

**Option B (Icons):**
```
[Transaction Card]
  Property Address
  [email-icon] 8  [message-icon] 4
```

**Option C (Combined with breakdown):**
```
[Transaction Card]
  Property Address
  12 messages (8 emails, 4 texts)
```

## Technical Investigation Needed

1. **Data source check**: Verify how counts are being calculated
   - Is the query filtering by channel type (`email` vs `sms`/`imessage`)?
   - Are the channels being set correctly during import?

2. **Possible issues**:
   - Query might not be filtering by channel
   - iMessage/SMS might have incorrect channel value in database
   - UI might be hardcoding "emails" label regardless of actual types

## Files Likely Involved

| File | Changes |
|------|---------|
| `src/components/transaction/TransactionCard.tsx` | Update UI to show separate counts |
| `electron/services/transactionService.ts` | Modify query to return counts by type |
| Database query | Split COUNT by channel type |

## Proposed Implementation

### Database Query Change

```sql
-- Current (suspected)
SELECT COUNT(*) as email_count
FROM messages
WHERE transaction_id = ?

-- Proposed
SELECT
  SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) as email_count,
  SUM(CASE WHEN channel IN ('sms', 'imessage') THEN 1 ELSE 0 END) as text_count
FROM messages
WHERE transaction_id = ?
```

### UI Component Update

```typescript
interface TransactionCounts {
  emails: number;
  texts: number;
}

// In TransactionCard
function renderCommunicationCount({ emails, texts }: TransactionCounts) {
  const parts = [];
  if (emails > 0) parts.push(`${emails} ${emails === 1 ? 'email' : 'emails'}`);
  if (texts > 0) parts.push(`${texts} ${texts === 1 ? 'text' : 'texts'}`);

  if (parts.length === 0) return 'No communications';
  return parts.join(', ');
}
```

## Acceptance Criteria

- [ ] Transaction cards display separate counts for emails and text messages
- [ ] Counts accurately reflect the actual communication types in the database
- [ ] Zero counts are handled gracefully (e.g., "3 emails" not "3 emails, 0 texts")
- [ ] Singular/plural grammar is correct ("1 email" vs "2 emails")
- [ ] UI design is clear and not cluttered
- [ ] Query performance is not degraded

## Estimated Tokens

~15,000-25,000 (straightforward UI + query change)

## Testing

- [ ] Transaction with only emails shows only email count
- [ ] Transaction with only texts shows only text count
- [ ] Transaction with both shows both counts correctly
- [ ] Transaction with no communications shows appropriate message
- [ ] Verify counts match actual database records
- [ ] Check performance with transactions having many linked messages

## Related Items

- BACKLOG-105: Text Messages Tab in Transaction Details (completed)
- BACKLOG-207: Auto-Link Communications When Contact Added

## Notes

This is a data accuracy and UX improvement. Users need to know at a glance what types of communications are linked to each transaction, especially for audit purposes where the distinction between email and text evidence matters.
