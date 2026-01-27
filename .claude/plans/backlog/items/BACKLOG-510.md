# BACKLOG-510: Fix Transaction Card Communication Counters

## Type
bug

## Priority
medium

## Status
in_progress

## Sprint
SPRINT-061

## Description

Text and email thread counters on TransactionCard show wrong counts. Counters are currently hidden (commented out in UI) until the counting logic is fixed to work with the new three-table architecture from BACKLOG-506.

### Root Cause (Investigation Needed)

The email count query in `transactionDbService.ts` uses:
```sql
COALESCE(m.channel, c.communication_type) = 'email'
```

But `c.communication_type` was removed from the `communications` table in BACKLOG-506 (schema v23). The `communications` table is now a pure junction table.

### Current Workaround

Counters are hidden in `TransactionCard.tsx` (lines 208-225) with comment:
```tsx
{/* BACKLOG-510: Counters hidden until count accuracy is fixed */}
```

### Technical Details

**New Architecture (BACKLOG-506):**
- `emails` table: stores email content
- `messages` table: stores text message content
- `communications` table: pure junction table linking content to transactions
  - `email_id` FK -> emails (for email links)
  - `message_id` FK -> messages (for text links)
  - `thread_id` for batch text thread links
  - NO `communication_type` column

**Files Affected:**
- `electron/services/db/transactionDbService.ts` - email count query (lines 119-125, 177-182)
- `electron/services/db/communicationDbService.ts` - thread count logic
- `src/components/transaction/components/TransactionCard.tsx` - counter display

## Acceptance Criteria

- [ ] Email count correctly counts distinct emails linked via `communications.email_id`
- [ ] Text thread count correctly counts distinct threads linked via `communications`
- [ ] TransactionCard displays accurate counters (re-enable hidden UI)
- [ ] Counts match between card view and transaction details view

## Related

- BACKLOG-506: Database architecture cleanup (parent issue)
- BACKLOG-396: Text thread count consistency
- SPRINT-061: Communication Display Fixes
