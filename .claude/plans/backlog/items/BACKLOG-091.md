# BACKLOG-091: Prevent Duplicate Emails Across Providers

## Priority: High

## Summary

Detect and prevent processing duplicate emails when users connect multiple email providers (Gmail + Outlook) that may contain the same messages (e.g., forwarded emails, CC'd messages, or migrated mailboxes).

## Problem

Users can connect both Gmail and Outlook accounts. If they:
- Forward emails between accounts
- Are CC'd on the same thread via both addresses
- Migrated from one provider to another
- Have auto-forwarding set up

...the same email content may exist in both mailboxes, leading to:
- Duplicate LLM processing costs
- Duplicate transactions detected
- Confusing UI with same email appearing twice

## Detection Strategies

### 1. Message-ID Header (Preferred)
Email RFC 5322 requires a unique `Message-ID` header per email:
```
Message-ID: <unique-id@example.com>
```

This ID is preserved when forwarding/syncing between providers.

```typescript
interface Message {
  // Add field
  message_id_header?: string; // RFC 5322 Message-ID
}

// Dedup query
SELECT * FROM messages
WHERE message_id_header NOT IN (
  SELECT message_id_header FROM messages
  WHERE message_id_header IS NOT NULL
  GROUP BY message_id_header
  HAVING COUNT(*) > 1
)
```

### 2. Content Hash Fallback
For emails without Message-ID or when headers aren't available:

```typescript
function computeEmailHash(email: Email): string {
  const content = [
    email.subject,
    email.from,
    email.sentDate?.toISOString(),
    email.bodyPlain?.slice(0, 500) // First 500 chars
  ].join('|');

  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### 3. Fuzzy Matching (Optional)
For edge cases with slight variations:
- Ignore whitespace differences
- Ignore signature blocks
- Compare core content only

## Implementation

### Schema Changes

```sql
-- Add to messages table
ALTER TABLE messages ADD COLUMN message_id_header TEXT;
ALTER TABLE messages ADD COLUMN content_hash TEXT;
ALTER TABLE messages ADD COLUMN duplicate_of TEXT; -- Points to original message ID

CREATE INDEX idx_messages_message_id_header ON messages(message_id_header);
CREATE INDEX idx_messages_content_hash ON messages(content_hash);
```

### Fetch & Store Flow

```typescript
async function storeEmail(email: ParsedEmail, userId: string) {
  const messageIdHeader = extractMessageIdHeader(email.raw);
  const contentHash = computeEmailHash(email);

  // Check for existing duplicate
  const existing = await db.query(`
    SELECT id FROM messages
    WHERE user_id = ?
    AND (message_id_header = ? OR content_hash = ?)
  `, [userId, messageIdHeader, contentHash]);

  if (existing) {
    // Store as duplicate, link to original
    return await db.insert('messages', {
      ...email,
      message_id_header: messageIdHeader,
      content_hash: contentHash,
      duplicate_of: existing.id,
      is_transaction_related: null // Skip LLM analysis
    });
  }

  // Store as original
  return await db.insert('messages', {
    ...email,
    message_id_header: messageIdHeader,
    content_hash: contentHash
  });
}
```

### LLM Processing Filter

```typescript
// Only process non-duplicate emails
SELECT * FROM messages
WHERE user_id = ?
AND duplicate_of IS NULL
AND is_transaction_related IS NULL
```

## Acceptance Criteria

- [ ] Message-ID header extracted and stored for Gmail emails
- [ ] Message-ID header extracted and stored for Outlook emails
- [ ] Content hash computed as fallback
- [ ] Duplicate emails linked via `duplicate_of` field
- [ ] LLM pipeline skips duplicates
- [ ] UI shows duplicate count/indicator (optional)
- [ ] Existing emails backfilled with hashes (migration)

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Schema migration | 0.25 sprint |
| Gmail header extraction | 0.25 sprint |
| Outlook header extraction | 0.25 sprint |
| Dedup logic + storage | 0.5 sprint |
| LLM filter update | 0.25 sprint |
| Testing | 0.5 sprint |
| **Total** | 2 sprints |

## Edge Cases

| Case | Handling |
|------|----------|
| No Message-ID header | Use content hash |
| Email edited after forwarding | Content hash differs, treated as new |
| Same email, different threads | Message-ID same, deduped |
| Newsletter to both addresses | Deduped by Message-ID |

## References

- [RFC 5322 - Message-ID](https://datatracker.ietf.org/doc/html/rfc5322#section-3.6.4)
- Gmail API: `payload.headers` contains Message-ID
- Graph API: `internetMessageHeaders` or `internetMessageId`
