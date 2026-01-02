# TASK-909: Gmail Message-ID Header Extraction

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-091 (Phase 1)
**Priority:** HIGH
**Category:** service
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 3-4 turns, ~15K tokens, 15-20 min

---

## Goal

Extract and store the RFC 5322 Message-ID header from Gmail emails to enable cross-provider deduplication.

## Non-Goals

- Do NOT implement Outlook Message-ID extraction (Phase 2)
- Do NOT implement dedup logic (TASK-911)
- Do NOT backfill existing emails

---

## Prerequisites

**IMPORTANT:** This task MUST wait for TASK-906 to be merged, as both modify `gmailFetchService.ts`.

---

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/services/gmailFetchService.ts` | Extract Message-ID from headers |
| `electron/types/email.ts` | Add `messageIdHeader` to ParsedEmail |

---

## Implementation Notes

### Gmail API Headers

The Gmail API returns headers in the `payload.headers` array:

```json
{
  "payload": {
    "headers": [
      { "name": "Message-ID", "value": "<unique-id@mail.gmail.com>" },
      { "name": "Subject", "value": "..." },
      ...
    ]
  }
}
```

### Header Extraction

```typescript
// In gmailFetchService.ts

function extractMessageIdHeader(headers: Array<{ name: string; value: string }>): string | null {
  const messageIdHeader = headers.find(
    h => h.name.toLowerCase() === 'message-id'
  );
  return messageIdHeader?.value ?? null;
}

// In _parseMessage or equivalent parsing function
function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedEmail {
  const headers = message.payload?.headers ?? [];

  return {
    // ... existing fields ...
    messageIdHeader: extractMessageIdHeader(headers),
  };
}
```

### Type Updates

```typescript
// In electron/types/email.ts

export interface ParsedEmail {
  // ... existing fields ...

  /** RFC 5322 Message-ID header for deduplication */
  messageIdHeader?: string;
}
```

### Storage Integration

```typescript
// When storing email in database
await databaseService.insertMessage({
  // ... existing fields ...
  message_id_header: email.messageIdHeader,
});
```

---

## Acceptance Criteria

- [ ] `ParsedEmail` interface includes `messageIdHeader` field
- [ ] Gmail parser extracts Message-ID from headers
- [ ] Message-ID stored in `message_id_header` column
- [ ] Null/missing Message-ID handled gracefully
- [ ] >95% of Gmail emails have Message-ID extracted
- [ ] Unit tests for header extraction
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use case-insensitive header name matching
- Handle missing Message-ID gracefully (return null)
- Store the full header value including angle brackets
- Add unit tests for extraction function

### Don't
- Implement Outlook extraction (Phase 2)
- Implement dedup logic
- Backfill existing emails
- Strip angle brackets from Message-ID

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Gmail API returns headers differently than expected
- Message-ID format varies significantly
- Need to handle reply/forward threading

---

## Testing Expectations

- Unit test `extractMessageIdHeader()` with various header formats
- Test with missing Message-ID header
- Test with duplicate headers (should use first)
- Verify storage in database

---

## PR Preparation

**Branch:** `feature/TASK-909-gmail-message-id`
**Title:** `feat(sync): extract Message-ID header from Gmail emails`
**Labels:** `feature`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop (AFTER TASK-906 merged)
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** No - depends on TASK-906
- **Depends On:** TASK-905 (schema), TASK-906 (same file)
- **Blocks:** TASK-912

### Merge Conflict Warning
Both TASK-906 and TASK-909 modify `gmailFetchService.ts`. TASK-909 MUST rebase on TASK-906 before starting work.
