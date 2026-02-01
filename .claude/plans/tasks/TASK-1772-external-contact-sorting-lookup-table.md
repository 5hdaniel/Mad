# TASK-1772: External Contact Sorting by Recent Message Date (Lookup Table)

## Status
- **Sprint**: SPRINT-066 (Contact Management UX Overhaul)
- **Phase**: 5 (Follow-up Enhancements)
- **Status**: COMPLETED
- **Priority**: High (performance critical)
- **Created**: 2026-01-30
- **Completed**: 2026-01-30
- **Related**: BACKLOG-567 (contact-selection-sort-by-recent)

---

## Problem Statement

The contact selection screen was hanging for 50-100 seconds when loading external contacts with sort-by-recent-message functionality. The root cause was an N+1 query pattern: for each external contact (~1000+), the system ran a separate LIKE query against the messages table (676K+ rows) to find the most recent message date.

**Performance Issue:**
- ~1000 external contacts
- 676K+ messages in database
- 1000+ individual LIKE queries with phone number pattern matching
- Result: 50-100 second UI freeze

---

## Solution Implemented

Created a `phone_last_message` lookup table that maintains a pre-computed index of the most recent message date for each normalized phone number. This enables O(1) indexed lookups instead of N+1 LIKE queries.

### Architecture

```
phone_last_message table
+-------------------+----------+---------------------+
| phone_normalized  | user_id  | last_message_at     |
+-------------------+----------+---------------------+
| 14245551234       | uuid-1   | 2026-01-29 10:30:00 |
| 13105556789       | uuid-1   | 2026-01-28 15:45:00 |
+-------------------+----------+---------------------+

Index: (phone_normalized, user_id) -> O(1) lookup
```

### Performance Improvement
- **Before**: ~50-100 seconds (1000+ LIKE queries against 676K messages)
- **After**: ~50ms (single batch lookup with indexed access)
- **Improvement**: ~1000-2000x faster

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `electron/services/databaseService.ts` | MODIFIED | Migration 24 + new methods |
| `electron/contact-handlers.ts` | MODIFIED | Batch lookup logic |
| `electron/handlers/messageImportHandlers.ts` | MODIFIED | Post-import backfill trigger |

---

## Implementation Details

### 1. Migration 24: phone_last_message Table

```sql
CREATE TABLE IF NOT EXISTS phone_last_message (
  phone_normalized TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  PRIMARY KEY (phone_normalized, user_id)
)
```

### 2. New Database Methods

**getLastMessageDatesForPhones(phones: string[], userId: string)**
- Accepts array of normalized phone numbers
- Returns Map<phone, lastMessageAt>
- Uses IN clause for batch lookup (efficient with index)

**backfillPhoneLastMessageTable(userId: string)**
- Populates lookup table from messages table
- Uses GROUP BY phone + MAX(date) aggregation
- Called once for existing users, then kept updated incrementally

### 3. Contact Handler Updates

Replaced N+1 query pattern:
```typescript
// BEFORE (slow)
for (const contact of externalContacts) {
  const lastDate = await db.getLastMessageDateForPhone(contact.phone);
  contact.last_communication_at = lastDate;
}

// AFTER (fast)
const phones = externalContacts.map(c => normalizePhone(c.phone));
const dateMap = await db.getLastMessageDatesForPhones(phones, userId);
for (const contact of externalContacts) {
  contact.last_communication_at = dateMap.get(normalizePhone(contact.phone));
}
```

### 4. Incremental Updates

After message imports, `messageImportHandlers.ts` triggers an update to keep the lookup table current with newly imported messages.

---

## Acceptance Criteria

- [x] phone_last_message table created via migration
- [x] Batch lookup method returns correct dates for phone numbers
- [x] Backfill correctly populates table from existing messages
- [x] External contacts sorted by recent message date
- [x] Contact selection screen loads in under 1 second (was 50-100s)
- [x] New message imports update the lookup table
- [x] `npm run type-check` passes
- [x] `npm test` passes

---

## Verification Steps

1. Open app with large message database (676K+ messages)
2. Create/edit transaction and open contact selection
3. Verify external contacts appear within 1 second
4. Verify contacts with recent messages appear at top
5. Import new messages and verify sort order updates

---

## Technical Notes

### Phone Normalization
Phone numbers are normalized (digits only) for consistent matching:
- `+1 (424) 555-1234` -> `14245551234`
- `424-555-1234` -> `4245551234`

### One-Time Backfill
For existing users upgrading to this version, a one-time backfill runs on first load to populate the lookup table from the messages table.

### Index Efficiency
The PRIMARY KEY on (phone_normalized, user_id) provides:
- Fast exact-match lookups
- Efficient batch queries with IN clause
- No additional index needed

---

## Estimated vs Actual Effort

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Tokens | ~8K | TBD |
| Duration | ~30 min | ~60 min |

**Notes:** Implementation took longer due to debugging phone normalization edge cases and verifying the backfill logic with real data.

---

## Implementation Summary

**Completed By:** Direct implementation (not via engineer agent)
**Branch:** sprint-066-contact-ux-overhaul (direct commits)
**PR:** N/A (committed directly to sprint branch)

### Changes Summary

1. **Migration 24**: Created `phone_last_message` lookup table with composite primary key
2. **Batch Lookup**: Added `getLastMessageDatesForPhones()` for efficient O(1) indexed lookups
3. **Backfill Logic**: Added `backfillPhoneLastMessageTable()` to populate from existing messages
4. **Contact Handlers**: Updated to use batch lookup instead of N+1 queries
5. **Import Handlers**: Added trigger to keep lookup table updated after message imports

### Performance Impact
- Contact selection screen: 50-100s -> <1s
- User-visible improvement: Immediate response vs. 1+ minute hang
