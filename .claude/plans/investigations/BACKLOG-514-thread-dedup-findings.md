# BACKLOG-514: Thread Deduplication Investigation Findings

**Investigation Date:** 2026-01-26
**Investigator:** Engineer Agent (TASK-1402)
**Sprint:** SPRINT-061

---

## Executive Summary

**Root Cause Identified:** The thread deduplication issue is NOT caused by duplicate data in the database. The system has proper deduplication at multiple levels. The most likely cause of users seeing "duplicate threads" is:

1. **Fallback grouping by participants** - When `thread_id` is NULL, messages are grouped by normalized phone numbers, which can produce different keys than `macos-chat-{id}` keys
2. **Mixed linking patterns** - The system supports both per-message (`message_id`) and per-thread (`thread_id`) linking, which can result in the same thread being queried twice via different paths

**Recommendation:** The issue requires frontend grouping consolidation rather than import-side changes.

---

## Investigation Analysis

### 1. Thread ID Assignment During Import

**File:** `electron/services/macOSMessagesImportService.ts`

**How thread_id is assigned (lines 825-826):**
```typescript
// Build thread ID from chat
const threadId = msg.chat_id ? `macos-chat-${msg.chat_id}` : null;
```

**Source:** Direct mapping from macOS `chat_id` (from `chat_message_join` table)

**Deduplication:** Uses `external_id` (macOS GUID) for message-level deduplication:
```typescript
// O(1) lookup for existing messages
const existingIds = new Set<string>();
// ... load existing external_ids ...
if (existingIds.has(msg.guid)) {
  skipped++;
  continue;
}
```

**Potential Issue - NULL chat_id:**
- Messages can have NULL `chat_id` if the `chat_message_join` record is missing
- These get `thread_id = null` in the database
- Import logs warn about this: `"Message has NULL chat_id, will have NULL thread_id"`

**Assessment:** Import is sound - thread_id is stable based on macOS chat_id.

---

### 2. Backend Thread Counting Logic

**File:** `electron/services/db/communicationDbService.ts` (lines 837-870)

**SQL Query:**
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

**Thread Key Generation (lines 790-827):**
```typescript
function getThreadKey(msg: { thread_id?: string | null; participants?: string | null; id: string }): string {
  // FIRST: Use thread_id if available
  if (msg.thread_id) {
    return msg.thread_id;  // Returns: "macos-chat-{chat_id}"
  }

  // FALLBACK: Compute from participants
  // ... normalize participants and create key like "participants-{hash}"

  // Last resort: use message id
  return `msg-${msg.id}`;
}
```

**FINDING 1: Potential Duplicate Thread Keys**

When `thread_id` is NULL, messages fall back to participant-based grouping. This can create different keys than `macos-chat-{id}`, potentially causing:
- Same conversation appearing under multiple keys
- One thread as `macos-chat-123` and another as `participants-5551234567`

---

### 3. Frontend Thread Grouping Logic

**File:** `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

**Frontend getThreadKey (lines 365-404):**
```typescript
function getThreadKey(msg: MessageLike): string {
  // FIRST: Use thread_id if available
  if (msg.thread_id) {
    return msg.thread_id;
  }

  // FALLBACK: Compute from participants
  // ... identical logic to backend ...

  return `msg-${msg.id}`;
}
```

**FINDING 2: Frontend/Backend Logic Match**

The frontend and backend use identical `getThreadKey()` logic, so they should produce the same groupings. This is intentional and correct.

---

### 4. Communications Table Deduplication

**File:** `electron/database/schema.sql` (lines 890-894)

**Unique Indexes:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_msg_txn
  ON communications(message_id, transaction_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_email_txn
  ON communications(email_id, transaction_id) WHERE email_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_thread_txn
  ON communications(thread_id, transaction_id) WHERE thread_id IS NOT NULL;
```

**FINDING 3: Database-Level Deduplication is Correct**

The unique indexes prevent:
- Same `message_id` linked twice to same transaction
- Same `thread_id` linked twice to same transaction

---

### 5. Query-Side Deduplication

**File:** `electron/services/db/communicationDbService.ts` (lines 598-624)

**Two-Level Deduplication:**
```typescript
// Deduplicate by message ID first
const seenIds = new Set<string>();
const dedupedById = results.filter(r => {
  if (seenIds.has(r.id)) return false;
  seenIds.add(r.id);
  return true;
});

// Content-based deduplication for text messages
const seenContent = new Set<string>();
const deduped = dedupedById.filter(r => {
  // ... checks body_text + sent_at ...
});
```

**FINDING 4: Query Returns Deduplicated Results**

The `getCommunicationsWithMessages()` function applies:
1. ID-based deduplication (exact duplicates)
2. Content-based deduplication (same text + timestamp)

---

### 6. Linking Pattern Analysis

**Two Linking Approaches:**

1. **Per-Message Linking** (`createCommunicationReference`):
   - Creates record with `message_id` set
   - Used by `transactionService.linkMessages()`
   - Frontend calls this when attaching individual messages

2. **Per-Thread Linking** (`createThreadCommunicationReference`):
   - Creates record with `thread_id` set (not `message_id`)
   - Used by `autoLinkService.autoLinkCommunicationsForContact()`
   - Links entire thread in one record

**FINDING 5: Mixed Linking Creates Query Complexity**

The JOIN in `getCommunicationsWithMessages()` handles both:
```sql
LEFT JOIN messages m ON (
  (c.message_id IS NOT NULL AND c.message_id = m.id)
  OR
  (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
)
```

**Potential Issue:** If a thread is linked via `thread_id` AND some messages are also linked via `message_id`, the query could return duplicate rows (same message via both paths).

---

## Root Cause Analysis

### Primary Issue: NULL thread_id Messages

**Scenario:**
1. User imports messages from macOS
2. Most messages get `thread_id = "macos-chat-{id}"`
3. Some messages have `thread_id = NULL` (missing chat_message_join)
4. NULL messages fall back to `participants-{hash}` grouping
5. UI shows two "threads" for what is actually one conversation

**Evidence:**
- Import service logs warnings for NULL thread_id messages
- Fallback grouping uses different key format

### Secondary Issue: Mixed Link Patterns

**Scenario:**
1. User attaches a thread via AttachMessagesModal (per-message linking)
2. Auto-link runs and creates per-thread link for same conversation
3. Query returns same messages twice via different JOIN paths

**Evidence:**
- Both linking patterns exist in codebase
- No deduplication when both `message_id` and matching `thread_id` links exist

---

## Proposed Fixes

### Fix 1: Consolidate Frontend Grouping (Low Risk)

**Approach:** After query results, always re-group by computed thread key before rendering.

**File:** `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`

**Change:**
```typescript
// Current: Uses threads directly from query
const threads = groupMessagesByThread(messages);

// Proposed: Consolidate threads with same participants
const threads = groupMessagesByThread(messages);
const consolidatedThreads = consolidateByParticipants(threads);
```

**Risk:** Low - client-side only, no data changes

### Fix 2: Query-Level Deduplication (Medium Risk)

**Approach:** Enhance `getCommunicationsWithMessages()` to detect and merge overlapping links.

**File:** `electron/services/db/communicationDbService.ts`

**Change:** Add thread-aware deduplication that handles both link types:
```typescript
// Group by thread_id first, then apply deduplication
const threadGroups = new Map<string, Communication[]>();
for (const comm of results) {
  const key = comm.thread_id || `msg-${comm.id}`;
  const group = threadGroups.get(key) || [];
  group.push(comm);
  threadGroups.set(key, group);
}
```

**Risk:** Medium - changes query behavior

### Fix 3: Prevent Duplicate Links at Creation (Low Risk)

**Approach:** When creating per-message links, check if thread is already linked.

**File:** `electron/services/db/communicationDbService.ts`

**Change to `createCommunicationReference()`:**
```typescript
// Before creating message_id link, check if thread_id link exists
const message = dbGet<{ thread_id: string | null }>(
  "SELECT thread_id FROM messages WHERE id = ?",
  [data.message_id]
);

if (message?.thread_id) {
  const threadLinked = await isThreadLinkedToTransaction(
    message.thread_id,
    data.transaction_id
  );
  if (threadLinked) {
    // Skip - thread already linked
    return existingCommunication;
  }
}
```

**Risk:** Low - additive check, no data changes

---

## Recommended Phase 2 Task (TASK-1406)

**Scope:** Implement Fix 1 (Frontend Consolidation) + Fix 3 (Prevent Duplicate Links)

**Why:**
- Fix 1: Immediate UI improvement with no backend changes
- Fix 3: Prevents future duplicates without changing existing data

**Files to Change:**
| File | Lines | Change |
|------|-------|--------|
| `TransactionMessagesTab.tsx` | After line 265 | Add thread consolidation step |
| `communicationDbService.ts` | Lines 458-494 | Add thread-linked check |

**Estimated Effort:** ~8-10K tokens

---

## Test Scenarios for Verification

1. **Import fresh messages** - Verify all messages have thread_id
2. **Link thread manually** - Verify single communication record created
3. **Auto-link same thread** - Verify no duplicate created
4. **View linked messages** - Verify single thread card displayed
5. **Re-import messages** - Verify no duplicates in UI

---

## Appendix: Key Code References

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Thread ID assignment | `macOSMessagesImportService.ts` | 825-826 | Creates `macos-chat-{id}` |
| GUID deduplication | `macOSMessagesImportService.ts` | 717-735 | Prevents message duplicates |
| Backend getThreadKey | `communicationDbService.ts` | 790-827 | Thread grouping logic |
| Frontend getThreadKey | `MessageThreadCard.tsx` | 365-404 | Thread grouping logic |
| Query deduplication | `communicationDbService.ts` | 598-624 | Post-query dedup |
| Thread counting | `communicationDbService.ts` | 837-870 | Backend thread count |
| Unique indexes | `schema.sql` | 890-894 | DB-level dedup |
