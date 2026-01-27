# BACKLOG-510: Communication Counter Accuracy Investigation

**Investigation Date:** 2026-01-26
**Task:** TASK-1400
**Sprint:** SPRINT-061
**Status:** COMPLETE

---

## Executive Summary

The email counter on TransactionCard shows incorrect counts due to a query that references a non-existent column (`c.communication_type`) in the `communications` table. This column was removed as part of the BACKLOG-506 database architecture cleanup, but the email count queries in `transactionDbService.ts` were not updated.

The text thread count implementation appears correct and compatible with the new architecture.

---

## Issue 1: Email Count Query - CONFIRMED BUG

### Current Implementation (BROKEN)

**File:** `electron/services/db/transactionDbService.ts`

**Lines 119-125 (getTransactions):**
```sql
(SELECT COUNT(*) FROM communications c
 LEFT JOIN messages m ON (c.message_id IS NOT NULL AND c.message_id = m.id)
                      OR (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
 WHERE c.transaction_id = t.id
 AND COALESCE(m.channel, c.communication_type) = 'email') as email_count
```

**Lines 177-182 (getTransactionById):**
```sql
(SELECT COUNT(*) FROM communications c
 LEFT JOIN messages m ON (c.message_id IS NOT NULL AND c.message_id = m.id)
                      OR (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
 WHERE c.transaction_id = t.id
 AND COALESCE(m.channel, c.communication_type) = 'email') as email_count
```

### Root Cause Analysis

1. **Column Removed:** The `communications.communication_type` column was removed in BACKLOG-506 (Migration 23). The `communications` table is now a pure junction table with only linking columns.

2. **COALESCE Failure:** The query uses `COALESCE(m.channel, c.communication_type)`:
   - When `m.channel` is NULL (no messages join), the query falls back to `c.communication_type`
   - But `c.communication_type` no longer exists, so SQLite returns NULL
   - `NULL = 'email'` evaluates to FALSE, so emails are not counted

3. **New Architecture:** With BACKLOG-506:
   - Emails are stored in the `emails` table
   - Communications link to emails via `communications.email_id`
   - The query does NOT join to the `emails` table, missing all email-linked communications

### Why This Wasn't Caught Earlier

The query doesn't throw an error because:
- SQLite silently returns NULL for non-existent columns in some contexts
- The query syntax is valid, it just produces wrong results
- The UI was temporarily hiding counters (BACKLOG-510), masking the issue

### Impact

- Email count always shows 0 or incorrect counts
- TransactionCard displays misleading information
- Users cannot rely on email counters for transaction management

### Proposed Fix (TASK-1403)

Replace the broken query with one that:
1. Joins to the `emails` table via `communications.email_id`
2. Also checks `messages.channel = 'email'` for legacy message-based emails
3. Removes reference to non-existent `c.communication_type`

**Corrected Query:**
```sql
(SELECT COUNT(DISTINCT c.id) FROM communications c
 LEFT JOIN messages m ON c.message_id IS NOT NULL AND c.message_id = m.id
 LEFT JOIN emails e ON c.email_id IS NOT NULL AND c.email_id = e.id
 WHERE c.transaction_id = t.id
 AND (
   m.channel = 'email'           -- Legacy: emails stored in messages table
   OR e.id IS NOT NULL           -- New: emails in emails table via email_id link
 )
) as email_count
```

---

## Issue 2: Text Thread Count - NO BUG FOUND

### Current Implementation (CORRECT)

**File:** `electron/services/db/communicationDbService.ts`

**Lines 837-870 (countTextThreadsForTransaction):**
```sql
SELECT
  COALESCE(m.id, c.id) as id,
  m.thread_id as thread_id,
  m.participants as participants
FROM communications c
LEFT JOIN messages m ON (
  (c.message_id IS NOT NULL AND c.message_id = m.id)
  OR
  (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
)
WHERE c.transaction_id = ?
  AND (m.channel IN ('text', 'sms', 'imessage') OR (m.id IS NULL AND c.thread_id IS NOT NULL))
```

### Analysis

1. **Correct Architecture:** The query correctly:
   - Joins to `messages` table (where texts are stored)
   - Filters by `m.channel` (not the removed `c.communication_type`)
   - Handles both direct message links and thread-based links

2. **Thread Grouping:** The function uses `getThreadKey()` to group messages by:
   - `thread_id` (iMessage)
   - `participants` (SMS group chats)
   - `message_id` (fallback for ungrouped messages)

3. **Consistency:** The stored `text_thread_count` in `transactions` table is updated via `updateTransactionThreadCount()` which calls this function.

### Recommendation

TASK-1404 may not be needed for the text thread count query itself. However, verify:
- The stored count is being updated when messages are linked/unlinked
- Edge cases with NULL thread_id are handled correctly

---

## Architecture Verification

### Schema Confirmation (schema.sql)

**Communications Table (Lines 855-880):**
```sql
CREATE TABLE IF NOT EXISTS communications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT,

  -- Link to content (ONE of these should be set)
  message_id TEXT,                         -- FK to messages (for texts)
  email_id TEXT,                           -- FK to emails (for emails)
  thread_id TEXT,                          -- For batch-linking all texts in a thread

  -- Link metadata
  link_source TEXT CHECK (link_source IN ('auto', 'manual', 'scan')),
  link_confidence REAL,
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys and constraints
  ...
);
```

**Key Points:**
- [x] NO `communication_type` column exists
- [x] `email_id` column exists for linking to `emails` table
- [x] `message_id` column exists for linking to `messages` table
- [x] `thread_id` column exists for batch-linking threads

### Emails Table (Lines 303-358)

```sql
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  external_id TEXT,                    -- Gmail/Outlook message ID
  source TEXT CHECK (source IN ('gmail', 'outlook')),
  ...
);
```

**Key Points:**
- [x] Emails table exists and is properly structured
- [x] Has all necessary fields (sender, recipients, subject, body, etc.)
- [x] Has proper indexes for performance

---

## Export Services Compatibility Check

As noted in the task file, export services use `communication_type` but get it from joined queries:

**communicationDbService.ts (Lines 540-550):**
```sql
CASE
  WHEN m.id IS NOT NULL THEN m.channel
  WHEN e.id IS NOT NULL THEN 'email'
  ELSE 'unknown'
END as communication_type,
```

**Status:** COMPATIBLE - Export services get `communication_type` as a computed column from the join, not from a table column. The `getCommunicationsForTransaction()` function correctly computes this field.

---

## Recommendations for Phase 2

### TASK-1403: Fix Email Count Query (REQUIRED)

**Scope:**
- Update `getTransactions()` in `transactionDbService.ts` (lines 119-125)
- Update `getTransactionById()` in `transactionDbService.ts` (lines 177-182)
- Join to `emails` table via `email_id`
- Remove reference to `c.communication_type`

**Estimated effort:** ~5K tokens

### TASK-1404: Verify Text Thread Count (REDUCED SCOPE)

**Original scope:** Fix text thread count query
**Revised scope:** The query is correct. Task should verify:
- Count updates correctly on link/unlink operations
- Edge cases are handled (null thread_id, mixed channels)
- Consider adding unit tests for `countTextThreadsForTransaction()`

**Estimated effort:** ~3K tokens (verification only, no query changes)

---

## Files Analyzed

| File | Lines | Status |
|------|-------|--------|
| `electron/services/db/transactionDbService.ts` | 119-125, 177-182 | BUG FOUND |
| `electron/services/db/communicationDbService.ts` | 530-627, 837-870 | OK |
| `electron/database/schema.sql` | 855-895 (communications), 303-358 (emails) | VERIFIED |
| `src/components/transaction/components/TransactionCard.tsx` | 117-120 | OK (uses correct data) |

---

## Conclusion

**Primary Issue:** Email count query references removed `c.communication_type` column and does not join to the `emails` table.

**Secondary Issue:** None found for text thread count.

**Action Required:** Implement fix in TASK-1403. TASK-1404 scope can be reduced to verification only.
