# Task TASK-1183: Display Emails in Natural Thread Format

**Backlog Item:** BACKLOG-494
**Sprint:** SPRINT-052
**Status:** Ready
**Estimated Tokens:** ~25K
**Priority:** P0 (Critical)

---

## Objective

Display emails linked to transactions in their natural thread/conversation format, matching the UX of how text messages are displayed in threads.

---

## Context

Currently emails may display as individual items without conversation grouping. Users expect to see email conversations grouped like they see in their email client or like how text messages are displayed in Magic Audit. This improves usability for auditing transaction communications.

---

## Requirements

1. Group emails by conversation thread
2. Use email headers for threading (In-Reply-To, References, Message-ID)
3. Display threads in chronological order
4. Provide consistent UX with text message thread display
5. Handle both Gmail and Outlook emails

---

## Implementation Steps

### Step 1: Analyze Current Email Data Structure

Check what threading metadata is stored during email sync:

```typescript
// Check if these fields exist in communications or email-specific tables:
// - message_id (email Message-ID header)
// - in_reply_to (email In-Reply-To header)
// - references (email References header)
// - thread_id or conversation_id
```

Files to check:
- `electron/services/db/communicationDbService.ts`
- `electron/services/email/` (email sync services)
- Database schema: `electron/services/db/schema.sql`

### Step 2: Add Thread Grouping to Communication Service

If threading metadata exists, add grouping logic:

```typescript
// In communicationDbService.ts or new threadingService.ts

export async function getEmailThreads(transactionId: string): Promise<EmailThread[]> {
  // 1. Get all emails for transaction
  // 2. Group by thread using:
  //    - Primary: message_id chains (in_reply_to -> message_id)
  //    - Fallback: normalized subject + contact matching
  // 3. Sort threads by most recent email
  // 4. Sort emails within thread chronologically
}
```

### Step 3: Update Email Display Component

Modify the email tab to display grouped threads:

```tsx
// In TransactionEmailsTab.tsx or similar

interface EmailThread {
  id: string;
  subject: string;
  participants: string[];
  emailCount: number;
  dateRange: { start: Date; end: Date };
  emails: Communication[];
  isExpanded?: boolean;
}

// Display as collapsible thread cards
```

### Step 4: Create Thread Card Component

Match the pattern used for text message thread cards:

```tsx
// Component structure
<EmailThreadCard>
  <ThreadHeader onClick={toggleExpand}>
    <Subject>{thread.subject}</Subject>
    <Metadata>
      {thread.emailCount} emails | {dateRange}
    </Metadata>
  </ThreadHeader>
  {isExpanded && (
    <ThreadBody>
      {thread.emails.map(email => <EmailItem ... />)}
    </ThreadBody>
  )}
</EmailThreadCard>
```

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/db/communicationDbService.ts` | Add thread grouping query/logic |
| `src/components/TransactionEmailsTab.tsx` | Display grouped threads |
| `src/components/EmailThreadCard.tsx` (new) | Thread container component |
| `src/types/communication.ts` | Add EmailThread type if needed |

---

## Acceptance Criteria

- [ ] Emails grouped by conversation thread
- [ ] Thread displays in chronological order
- [ ] Reply chains are visually connected
- [ ] Consistent with message thread display UX
- [ ] Works for both Gmail and Outlook emails
- [ ] Thread summary visible when collapsed (subject, count, date range)
- [ ] Can expand/collapse threads
- [ ] No regression in existing email display functionality

---

## Testing

### Manual Testing

1. Create transaction with contacts
2. Sync emails that include multi-email threads
3. Verify:
   - Emails are grouped by conversation
   - Threads show correct email count
   - Chronological order within threads
   - Expand/collapse works
4. Test with Gmail account
5. Test with Outlook/Microsoft account
6. Test with single-email "threads" (should work)
7. Test with broken thread chains (missing In-Reply-To)

### Automated Testing

- Unit tests for thread grouping logic
- Component tests for EmailThreadCard

---

## Technical Notes

### Email Threading Headers

- **Message-ID**: Unique identifier for each email
- **In-Reply-To**: Message-ID of the email being replied to
- **References**: Space-separated list of Message-IDs in the thread chain

### Thread Grouping Algorithm

```
1. Build adjacency map: in_reply_to -> parent message_id
2. Find root messages (no in_reply_to or parent not found)
3. Group all emails by following parent chains to root
4. Sort threads by most recent email date
5. Sort emails within thread chronologically
```

### Fallback Strategy

If email headers are missing or incomplete:
1. Normalize subject (strip Re:, Fwd:, FW:, RE:, etc.)
2. Group by normalized subject + overlapping participants
3. Apply time proximity heuristic (emails within reasonable time window)

---

## Branch Information

**Branch From:** develop
**Branch Name:** feature/TASK-1183-email-thread-display
**Branch Into:** develop

---

## Implementation Summary

*(To be filled in by engineer after implementation)*

---

## Engineer Metrics

| Metric | Value |
|--------|-------|
| Agent ID | - |
| Start Time | - |
| End Time | - |
| Total Tokens | - |
| Turns | - |
| Branch | feature/TASK-1183-email-thread-display |
| PR | - |
