# BACKLOG-230: NULL thread_id Investigation and Fix

**Created:** 2026-01-14
**Updated:** 2026-01-14
**Priority:** Medium (historical data, not blocking)
**Category:** Data Integrity

---

## Problem Statement

7.2% of messages (48,502 out of 674,652) have NULL thread_id, causing them to not be properly grouped into chat threads.

### Root Cause Analysis (Completed)

**Key Finding:** These messages are **orphaned at the macOS level** - Apple's chat.db has no chat association for them.

| Category | Count | Percentage |
|----------|-------|------------|
| Outbound to "unknown" | 24,816 | 51% |
| Known senders (deleted chats) | 23,686 | 49% |
| **Total** | 48,502 | 100% |

### Why This Happens

macOS stores messages with:
- `handle_id = 0` (no recipient link)
- No entry in `chat_message_join` table
- Even Apple doesn't know the recipient

This occurs when:
- Chat was deleted but message metadata remained
- iCloud sync issues between devices
- Messages sent during connectivity problems

---

## Detailed Investigation Results

### Analysis Query Results

```javascript
await window.api.system.diagnosticNullThreadIdAnalysis(userId);
```

**By Channel:**
- iMessage: 41,717 (86%)
- SMS: 6,785 (14%)

**By Time (recent is minimal):**
- Jan 2026: 6 messages
- Dec 2025: 8 messages
- Jul 2025: 352 messages (bulk historical)

**Top Senders with NULL thread_id:**
| Sender | Count | Sample |
|--------|-------|--------|
| unknown | 24,816 | "Where are you?" |
| +14153071897 | 9,777 | (attachment) |
| +15109819028 | 789 | Normal conversation |
| +14153072985 | 375 | Normal conversation |

### macOS chat.db Analysis

Verified 24,825 orphaned outbound messages directly in macOS:

```sql
SELECT COUNT(*) FROM message m
LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
WHERE cmj.chat_id IS NULL AND m.is_from_me = 1;
-- Result: 24,825
```

**Recovery attempts:**
- Only 2 messages have `reply_to_guid` (could trace to chat)
- Only 6 messages have `thread_originator_guid`
- Timestamp proximity matching: inconclusive

---

## Test Cases from Production

### Case 1: Orphaned Message with Reply Chain (Recoverable)

**Message:**
```json
{
  "external_id": "4728C738-7127-44A3-8DB6-50AE8DDE280D",
  "body_text": "Also",
  "participants": "{\"from\":\"me\",\"to\":[\"unknown\"]}",
  "sent_at": "2026-01-12T03:22:21.162Z"
}
```

**macOS data:**
```sql
-- Message has reply_to_guid
reply_to_guid: CE694AAC-0E4B-433D-9817-DE14FF416AB1
destination_caller_id: +14158064240  -- User's number (sender)
handle_id: 0  -- No recipient handle

-- Parent message has chat association
chat_identifier: chat88807631268728891
display_name: "JP sales team"
participants: +14082104874, +14088076253
```

**Conclusion:** Can recover recipient by following reply chain (only 2 of 24K have this)

### Case 2: Truly Orphaned (Not Recoverable)

**Message:**
```json
{
  "external_id": "6EB502E6-38E9-4884-8440-B44E3F0C173E",
  "body_text": "Can one of you try to help me with the kitchen faucet...",
  "participants": "{\"from\":\"me\",\"to\":[\"unknown\"]}",
  "sent_at": "2025-12-22T22:18:34.707Z"
}
```

**macOS data:**
- `handle_id = 0`
- No `chat_message_join` entry
- No `reply_to_guid`
- No `thread_originator_guid`
- Likely sent to "Hall Family" group chat (based on content)

**Conclusion:** Cannot programmatically recover recipient

### Case 3: Known Sender, Deleted Chat

```json
{
  "sender": "+14153706109",
  "count": 259,
  "sampleText": "Ladies. What r your plans for tomorrow evening..."
}
```

**Conclusion:** Chat was deleted, but messages remain. Can group by sender.

### Case 4: SMS Short Codes

```json
{
  "body_text": "Your United verification code is 510438...",
  "participants": "{\"from\":\"26266\",\"to\":[\"me\"]}"
}
```

**Conclusion:** Short codes don't create proper chats. Expected behavior.

---

## Available Data for Orphaned Messages

What we **have**:
- Message text (in attributedBody blob)
- Timestamp
- User's account (e.g., danielxhaim@gmail.com)
- `is_sent = 1` (confirmed sent)
- `destination_caller_id` (user's phone number, not recipient)

What we **don't have**:
- Recipient phone/email
- Chat association
- Thread context

---

## Potential Solutions

### Option A: Accept "Unknown" as Accurate ✓
These are truly orphaned at macOS level. "Unknown" is correct.

**Pros:** Honest, no false data
**Cons:** 7.2% of messages incomplete

### Option B: Synthetic thread_id by Sender
For known senders, group messages together:
```typescript
const threadId = senderId
  ? `orphan-${senderId}`
  : null;
```

**Pros:** Groups related messages
**Cons:** May group unrelated conversations

### Option C: "Orphaned Messages" UI Section
Separate view showing messages with no chat association.

**Pros:** Audit trail preserved
**Cons:** UI complexity

### Option D: Manual Mapping Table
User provides corrections: "Message X was sent to Contact Y"

**Pros:** Accurate when mapped
**Cons:** Manual effort

---

## Group Chats in User's Database (Reference)

For manual mapping if needed:

| ROWID | display_name | participants |
|-------|--------------|--------------|
| 452 | Hall Family | (family members) |
| 809 | JP sales team | +14082104874, +14088076253 |
| 2042 | Incline Gays™ | (11 participants) |
| 1948 | New Orleans Cruise | (9 participants) |
| 2302 | Dorian Clan | (9 participants) |
| 2301 | The Middle Agers | (8 participants) |
| 1834 | Incline OGs ❤️‍🩹 | (6 participants) |

---

## Diagnostic Tools Available

```javascript
// Full health report
await window.api.system.diagnosticMessageHealth(userId);

// NULL thread_id samples
await window.api.system.diagnosticNullThreadId(userId);

// Detailed NULL analysis (by sender, channel, month)
await window.api.system.diagnosticNullThreadIdAnalysis(userId);

// Unknown recipient messages with macOS IDs
await window.api.system.diagnosticUnknownRecipientMessages(userId);

// Threads for a specific contact
await window.api.system.diagnosticThreadsForContact(userId, "4155551234");
```

---

## Recommendation

**Accept as-is for now.** The good news:
- Only ~40 recent orphaned messages (last 6 months)
- Bulk (24K) are historical
- Current import is working correctly for new messages

Future enhancement: Add "Orphaned Messages" section in UI for compliance review.

---

## Related

- SPRINT-036: Deterministic Message Parsing (completed)
- FIX-PLAN-message-parsing-and-grouping.md (original analysis)
