# TASK-1303: Update communicationDbService queries to JOIN emails table

**Sprint:** SPRINT-060
**Phase:** 3 - Service Layer - Read Paths
**Branch:** `fix/task-1303-comm-db-service-reads`
**Estimated Tokens:** ~10K
**Dependencies:** TASK-1302 (emails are now in emails table)

---

## Objective

Update `communicationDbService.ts` query functions to JOIN with the `emails` table for email content, similar to how they already JOIN with `messages` for text content.

---

## Context Checkpoint

**RE-READ BEFORE STARTING:**

After TASK-1302, emails are stored in the `emails` table and `communications` only has `email_id` as a foreign key. The query functions need to:

1. JOIN to `emails` table when `email_id` is set
2. Return email content (subject, body, sender, etc.) from `emails` table
3. Keep existing JOIN to `messages` table for text messages
4. Remove COALESCE patterns that fall back to legacy content columns

---

## Pre-Implementation Check

Run these grep commands to verify current state:

```bash
# Find getCommunicationsWithMessages function
grep -n "getCommunicationsWithMessages" electron/services/db/communicationDbService.ts
# Expected: Shows function around line 542

# Check for COALESCE patterns (we'll be updating these)
grep -n "COALESCE" electron/services/db/communicationDbService.ts
# Expected: Shows multiple COALESCE patterns

# Verify emails table has data (from TASK-1302)
sqlite3 ~/Library/Application\ Support/mad/mad.db "SELECT COUNT(*) FROM emails"
# Expected: At least 1 if you've linked emails
```

---

## Files to Modify

### File 1: `electron/services/db/communicationDbService.ts`

#### Step 1: Update getCommunicationsWithMessages function

**LOCATION:** Around line 542, the `getCommunicationsWithMessages` function.

Find this function and its SQL query:
```typescript
export async function getCommunicationsWithMessages(
  transactionId: string,
): Promise<Communication[]> {
  // Query 1: Records with message_id (legacy per-message linking)
  // Query 2: Records with thread_id (new per-thread linking) - returns all messages in thread
  const sql = `
    SELECT
      -- TASK-1116: Use message ID when available for proper message lookup
      COALESCE(m.id, c.id) as id,
      c.id as communication_id,
      c.user_id,
      c.transaction_id,
      c.message_id,
      c.link_source,
      c.link_confidence,
      c.linked_at,
      c.created_at,
      -- Use message content when available, fall back to legacy columns
      COALESCE(m.channel, c.communication_type) as channel,
      COALESCE(m.channel, c.communication_type) as communication_type,
      COALESCE(m.body_text, c.body_plain) as body_text,
      COALESCE(m.body_text, c.body_plain) as body_plain,
      COALESCE(m.body_html, c.body) as body,
      COALESCE(m.subject, c.subject) as subject,
      COALESCE(json_extract(m.participants, '$.from'), c.sender) as sender,
      COALESCE(
        (SELECT group_concat(value) FROM json_each(json_extract(m.participants, '$.to'))),
        c.recipients
      ) as recipients,
      COALESCE(m.sent_at, c.sent_at) as sent_at,
      COALESCE(m.received_at, c.received_at) as received_at,
      COALESCE(m.has_attachments, c.has_attachments) as has_attachments,
      COALESCE(m.thread_id, c.email_thread_id) as email_thread_id,
      -- Thread ID for grouping messages into conversations
      m.thread_id as thread_id,
      -- Participants JSON for group chat detection and sender identification
      m.participants as participants,
      -- TASK-992: Direction from messages table for bubble display
      m.direction as direction,
      -- External ID (macOS GUID) for attachment lookup fallback
      m.external_id as external_id,
      -- Legacy columns preserved for backward compatibility
      c.source,
      c.cc,
      c.bcc,
      c.attachment_count,
      c.attachment_metadata,
      c.keywords_detected,
      c.parties_involved,
      c.communication_category,
      c.relevance_score,
      c.is_compliance_related
    FROM communications c
    LEFT JOIN messages m ON (
      -- Legacy: join by message_id
      (c.message_id IS NOT NULL AND c.message_id = m.id)
      OR
      -- TASK-1116: Thread-based linking - join by thread_id
      (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
    )
    WHERE c.transaction_id = ?
    ORDER BY COALESCE(m.sent_at, c.sent_at) DESC
  `;
```

Replace with:
```typescript
export async function getCommunicationsWithMessages(
  transactionId: string,
): Promise<Communication[]> {
  // BACKLOG-506: Three-way join - messages for texts, emails for emails
  // Query handles:
  //   1. Records with message_id (per-message text linking)
  //   2. Records with thread_id (per-thread text linking)
  //   3. Records with email_id (email linking - NEW)
  //
  // NOTE: The return type Communication is aliased to Message for backward compatibility.
  // The SELECT populates Message fields from JOINs to messages/emails tables.
  const sql = `
    SELECT
      -- Use content table ID when available, fall back to communication ID
      COALESCE(m.id, e.id, c.id) as id,
      c.id as communication_id,
      c.user_id,
      c.transaction_id,
      c.message_id,
      c.email_id,
      c.link_source,
      c.link_confidence,
      c.linked_at,
      c.created_at,
      -- Type: prefer message channel, then 'email' if email_id set
      CASE
        WHEN m.id IS NOT NULL THEN m.channel
        WHEN e.id IS NOT NULL THEN 'email'
        ELSE 'unknown'
      END as channel,
      CASE
        WHEN m.id IS NOT NULL THEN m.channel
        WHEN e.id IS NOT NULL THEN 'email'
        ELSE 'unknown'
      END as communication_type,
      -- Content from messages or emails table (NO legacy column fallback)
      COALESCE(m.body_text, e.body_plain) as body_text,
      COALESCE(m.body_text, e.body_plain) as body_plain,
      COALESCE(m.body_html, e.body_html) as body,
      COALESCE(m.subject, e.subject) as subject,
      COALESCE(json_extract(m.participants, '$.from'), e.sender) as sender,
      COALESCE(
        (SELECT group_concat(value) FROM json_each(json_extract(m.participants, '$.to'))),
        e.recipients
      ) as recipients,
      COALESCE(m.sent_at, e.sent_at) as sent_at,
      COALESCE(m.received_at, e.received_at) as received_at,
      COALESCE(m.has_attachments, e.has_attachments) as has_attachments,
      COALESCE(m.thread_id, e.thread_id) as email_thread_id,
      -- Thread ID for grouping messages into conversations
      COALESCE(m.thread_id, e.thread_id) as thread_id,
      -- Participants JSON for group chat detection and sender identification
      m.participants as participants,
      -- Direction from messages table for bubble display
      m.direction as direction,
      -- External ID for attachment lookup fallback
      COALESCE(m.external_id, e.external_id) as external_id,
      -- Email-specific fields from emails table only
      e.source as source,
      e.cc as cc,
      e.bcc as bcc,
      e.attachment_count as attachment_count
    FROM communications c
    LEFT JOIN messages m ON (
      -- Per-message linking
      (c.message_id IS NOT NULL AND c.message_id = m.id)
      OR
      -- Thread-based linking
      (c.message_id IS NULL AND c.email_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
    )
    LEFT JOIN emails e ON (
      -- BACKLOG-506: Email linking - join only when email_id is set and matches
      c.email_id IS NOT NULL AND c.email_id = e.id
    )
    WHERE c.transaction_id = ?
    ORDER BY COALESCE(m.sent_at, e.sent_at) DESC
  `;
```

**Note:** The rest of the function (deduplication logic) remains unchanged.

#### Step 2: Update createCommunication function to accept email_id

**LOCATION:** Around line 30, the `createCommunication` function.

**CRITICAL NOTE (BACKLOG-506):** The `createCommunication` function currently takes `NewCommunication` which is aliased to `NewMessage`. This is a **temporary** situation:
- The type system will be properly fixed in TASK-1306
- For now, we add `email_id` support while keeping backward compatibility
- After TASK-1307, this function should be refactored to use `NewJunctionCommunication`

Find the SQL statement:
```typescript
  const sql = `
    INSERT INTO communications (
      id, user_id, transaction_id, message_id,
      link_source, link_confidence, linked_at,
      communication_type, source,
```

Replace with (add email_id):
```typescript
  const sql = `
    INSERT INTO communications (
      id, user_id, transaction_id, message_id, email_id,
      link_source, link_confidence, linked_at,
      communication_type, source,
```

Find the params array:
```typescript
  const params = [
    id,
    communicationData.user_id,
    communicationData.transaction_id || null,
    communicationData.message_id || null,
    communicationData.link_source || null,
```

Replace with:
```typescript
  const params = [
    id,
    communicationData.user_id,
    communicationData.transaction_id || null,
    communicationData.message_id || null,
    // BACKLOG-506: email_id support - cast needed until types are fully updated in TASK-1306
    (communicationData as Record<string, unknown>).email_id || null,
    communicationData.link_source || null,
```

---

## Acceptance Criteria

- [ ] getCommunicationsWithMessages JOINs to emails table
- [ ] Emails display correctly in transaction (subject, sender, body visible)
- [ ] Text messages still display correctly (no regression)
- [ ] createCommunication accepts email_id parameter
- [ ] TypeScript compiles without errors
- [ ] All tests pass

---

## Test Commands

```bash
# 1. Run type check
npm run type-check
# Expected: No errors

# 2. Run tests
npm test
# Expected: All tests pass

# 3. Start app and verify emails display
npm run dev
# 1. Open a transaction with linked emails
# 2. Verify emails show subject, sender, and body content
# 3. Verify text messages still show correctly

# 4. Verify query is working (in separate terminal)
sqlite3 ~/Library/Application\ Support/mad/mad.db "
SELECT c.id, c.email_id, e.subject, e.sender
FROM communications c
LEFT JOIN emails e ON c.email_id = e.id
WHERE c.email_id IS NOT NULL
LIMIT 5"
# Expected: Shows email data from JOIN
```

---

## Rollback Instructions

If something goes wrong:

```bash
# Revert code changes
git checkout electron/services/db/communicationDbService.ts
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: 2026-01-25*

### Results

- **File Modified**: electron/services/db/communicationDbService.ts
- **Functions Updated**: 1 (getCommunicationsWithMessages) - Note: createCommunication already had email_id from previous task
- **SQL Changes**:
  - Added `LEFT JOIN emails e ON (c.email_id IS NOT NULL AND c.email_id = e.id)`
  - Added `c.email_id` to SELECT columns
  - Updated COALESCE patterns to pull content from `e.*` (emails table) instead of `c.*` (legacy columns)
  - Changed channel/communication_type to use CASE logic to return 'email' when email_id is set
  - Added condition `c.email_id IS NULL` to messages thread join to prevent double-joining
  - Updated ORDER BY to include `e.sent_at`
- **TypeScript Errors**: 0
- **Test Results**: All passing (1 pre-existing failure in nativeModules.test.ts unrelated to this change)
- **Actual Tokens**: ~15K
- **PR**: (fill after)

---

## Guardrails

**STOP and ask PM if:**
- Text messages stop displaying (regression)
- SQL syntax errors
- Email content not appearing after JOIN
- Need to modify other files
