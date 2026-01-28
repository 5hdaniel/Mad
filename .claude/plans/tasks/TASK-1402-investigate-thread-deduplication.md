# Task TASK-1402: Investigate Thread Deduplication Issue

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent investigates, documents findings, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Investigate why the same conversation appears as multiple separate threads in the UI. Document root causes and propose fixes for BACKLOG-514.

## Non-Goals

- Do NOT implement fixes in this task (that's Phase 2)
- Do NOT modify any production code
- Do NOT change the database schema
- Do NOT delete duplicate threads (if found)

## Deliverables

1. Update: `.claude/plans/tasks/TASK-1402-investigate-thread-deduplication.md` (this file - Investigation Findings section)
2. New file: `.claude/plans/investigations/BACKLOG-514-thread-dedup-findings.md`

## Acceptance Criteria

- [x] Thread ID assignment during import analyzed
- [x] Frontend thread grouping logic analyzed
- [x] Re-import/re-sync behavior analyzed
- [x] Root cause of duplicate threads clearly documented
- [x] Proposed fixes documented with specific file/line changes
- [x] No production code modified (investigation only)
- [ ] Findings PR created and merged

## Investigation Notes

### Key Questions to Answer

1. **Import Thread Assignment**:
   - How does `macOSMessagesImportService.ts` assign thread_id?
   - Is it based on chat_id from macOS database?
   - Can the same conversation get different thread_ids on re-import?

2. **Frontend Grouping**:
   - How does `TransactionMessagesTab.tsx` group messages into threads?
   - Does it use message.thread_id or compute groups differently?
   - What happens if thread_id is null/inconsistent?

3. **Backend Grouping**:
   - How does `countTextThreadsForTransaction()` count threads?
   - Does it match the frontend grouping logic?
   - What's the COALESCE fallback behavior?

4. **Re-sync Behavior**:
   - What happens when messages are re-imported?
   - Are existing messages updated or new ones created?
   - Could GUID deduplication be failing?

### Files to Investigate

| File | Focus |
|------|-------|
| `electron/services/macOSMessagesImportService.ts` | Thread ID assignment, GUID deduplication |
| `electron/services/db/communicationDbService.ts` | Lines 837-870: Thread counting logic |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Frontend thread grouping |
| `electron/database/schema.sql` | `messages` table structure, thread_id column |

### Investigation Commands

```bash
# Check thread_id usage in import service
grep -rn "thread_id\|threadId\|chat_id" --include="*.ts" electron/services/macOSMessagesImportService.ts

# Check how threads are grouped in backend
grep -rn "thread_id\|groupBy\|DISTINCT" --include="*.ts" electron/services/db/communicationDbService.ts

# Check frontend grouping logic
grep -rn "thread\|group" --include="*.tsx" src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx

# Check GUID deduplication
grep -rn "guid\|external_id\|dedup" --include="*.ts" electron/services/macOSMessagesImportService.ts

# Check messages table schema
grep -A 30 "CREATE TABLE.*messages" electron/database/schema.sql
```

### Reproduction Steps

To potentially reproduce the issue:
1. Import messages from macOS
2. Note a specific conversation's thread_id
3. Close and reopen the app
4. Re-run message import
5. Check if same conversation now has multiple thread entries
6. Link the conversation to a transaction
7. Check if it appears as multiple threads

## Integration Notes

- **Blocks**: TASK-1406 (Fix thread deduplication)
- **Related**: macOS message import, iPhone sync
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Trace the full import flow from macOS DB to app DB
- Compare frontend and backend grouping logic
- Look for edge cases in thread_id assignment
- Document exactly when/how duplicates are created

### Don't:

- Modify any production code
- Fix bugs (save for Phase 2)
- Delete or modify user data
- Spend more than ~15K tokens on investigation

## When to Stop and Ask

- If duplicates exist in database (data corruption issue)
- If fix requires schema migration
- If iPhone sync has same issue (scope expansion)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (investigation only)

### Coverage

- Coverage impact: None (no code changes)

### Integration / Feature Tests

- Required scenarios: None (investigation only)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no code changes expected)
- [ ] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `investigation`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to read | 4-5 files | +8K |
| Import flow tracing | Complex service | +4K |
| Documentation | Findings document | +3K |

**Confidence:** Medium

**Risk factors:**
- Import logic is complex
- May need to trace through multiple files
- Edge cases may be hard to identify

---

## Investigation Findings (Engineer-Owned)

*Investigation Date: 2026-01-26*

### Agent ID

```
Engineer Agent ID: (background agent - no explicit ID)
```

### Import Thread Assignment Analysis

**How thread_id is assigned:**
```typescript
// macOSMessagesImportService.ts lines 825-826
const threadId = msg.chat_id ? `macos-chat-${msg.chat_id}` : null;
```

**Source of thread_id:**
- [x] From macOS `chat_id`
- [ ] Generated UUID
- [ ] Computed from participants
- [ ] Other: <explain>

**Potential Issues:**
- Messages can have NULL `chat_id` if `chat_message_join` record is missing in macOS database
- These messages get `thread_id = null` and fall back to participant-based grouping
- Import service logs warnings: `"Message has NULL chat_id, will have NULL thread_id"`

---

### Frontend Grouping Analysis

**Grouping Logic:**
```typescript
// MessageThreadCard.tsx lines 365-404
function getThreadKey(msg: MessageLike): string {
  // FIRST: Use thread_id if available
  if (msg.thread_id) {
    return msg.thread_id;  // Returns "macos-chat-{id}"
  }

  // FALLBACK: Compute from participants
  // Creates key like "participants-{normalized_phone}"

  // Last resort: use message id
  return `msg-${msg.id}`;
}
```

**Groups by:**
- [x] `message.thread_id`
- [x] Computed from participants (fallback)
- [ ] Other: <explain>

**Edge Case Handling:**
- NULL thread_id -> normalized participant-based key
- No participants -> individual message key (`msg-{id}`)

---

### Backend Counting Analysis

**Counting Logic (communicationDbService.ts lines 837-870):**
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

**COALESCE Behavior:**
- When `m.thread_id` is NULL, backend `getThreadKey()` falls back to participant-based grouping
- Same logic as frontend (intentionally duplicated)

**Match with Frontend:**
- [x] Yes, same grouping logic
- [ ] No, differs because: <explanation>

---

### Re-Import/Re-Sync Analysis

**GUID Deduplication:**
```typescript
// macOSMessagesImportService.ts lines 717-735
const existingIds = new Set<string>();
const existingRows = db.prepare(`
  SELECT external_id FROM messages
  WHERE user_id = ? AND external_id IS NOT NULL
`).all(userId);

for (const row of existingRows) {
  existingIds.add(row.external_id);
}

// Later in processing:
if (existingIds.has(msg.guid)) {
  skipped++;
  continue;
}
```

**Can duplicates occur?**
- [ ] Yes, under these conditions: <explain>
- [x] No, because: GUID (external_id) deduplication prevents duplicate messages

**Database-Level Deduplication:**
```sql
-- schema.sql lines 890-894
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_msg_txn
  ON communications(message_id, transaction_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_thread_txn
  ON communications(thread_id, transaction_id) WHERE thread_id IS NOT NULL;
```

---

### Root Cause

**Primary Issue:**
The thread deduplication issue is NOT caused by duplicate data in the database. The most likely causes of users seeing "duplicate threads" are:

1. **NULL thread_id fallback**: When `thread_id` is NULL (missing macOS `chat_message_join`), messages are grouped by normalized phone numbers, which produces different keys than `macos-chat-{id}` keys. Same conversation can appear as two threads.

2. **Mixed linking patterns**: The system supports both:
   - Per-message linking (`createCommunicationReference` with `message_id`)
   - Per-thread linking (`createThreadCommunicationReference` with `thread_id`)

   If both link types exist for the same conversation, the query could return duplicate rows.

**Evidence:**
- Import assigns `thread_id = null` when `chat_id` is NULL (line 826)
- `getThreadKey()` has fallback logic that creates different key format
- Communications table allows both `message_id` and `thread_id` links
- JOIN in `getCommunicationsWithMessages()` matches on both patterns

---

### Proposed Fix

**File Changes:**
| File | Line(s) | Change |
|------|---------|--------|
| `TransactionMessagesTab.tsx` | After 265 | Add thread consolidation by participants |
| `communicationDbService.ts` | 458-494 | Check for existing thread link before per-message link |

**Fix Approach:**
1. **Frontend consolidation**: After grouping by thread key, merge threads that share the same participant set
2. **Prevent duplicate links**: When creating per-message link, check if thread is already linked

---

### Recommended Phase 2 Task

Based on investigation:

**TASK-1406**: Implement two-part fix:
1. Frontend: Add `consolidateByParticipants()` step after `groupMessagesByThread()`
2. Backend: In `createCommunicationReference()`, check `isThreadLinkedToTransaction()` before creating per-message link

Estimated: ~8-10K tokens

---

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured at session end) |
| Duration | (auto-captured at session end) |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Investigation Quality:** PASS / NEEDS MORE
**Root Cause Identified:** Yes / No / Partial

**Review Notes:**
<Key observations, concerns, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes
