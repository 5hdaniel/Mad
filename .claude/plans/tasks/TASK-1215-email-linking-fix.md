# Task TASK-1215: Create messageDbService and Update Email Linking

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Create a `messageDbService` with idempotent message creation, and update the email linking code path to use messages table as the source of truth.

## Non-Goals

- Do NOT remove legacy columns yet (that's Phase 7)
- Do NOT update ALL queries yet (that's Phase 6)
- Do NOT break existing functionality - emails must still link correctly
- Do NOT change the UI components

## Deliverables

1. New file: `electron/services/db/messageDbService.ts`
2. Update: `electron/services/db/index.ts` - Export messageDbService
3. Update: `electron/transaction-handlers.ts` - Gmail email linking
4. Update: `electron/transaction-handlers.ts` - Outlook email linking
5. (Possibly) Update: Email scan operations if they create messages

## Acceptance Criteria

- [ ] `messageDbService.createOrGetMessage()` works idempotently
- [ ] Gmail emails link correctly to transactions
- [ ] Outlook emails link correctly to transactions
- [ ] No duplicate messages created
- [ ] Existing linked emails still display
- [ ] All tests pass

## Implementation Notes

### messageDbService Structure

```typescript
// electron/services/db/messageDbService.ts
import { Database } from 'better-sqlite3';
import { Message } from '../types';

export function createOrGetMessage(
  db: Database,
  message: {
    external_id: string;
    subject?: string;
    body_plain?: string;
    body_html?: string;
    sender?: string;
    recipients?: string;
    cc?: string;
    bcc?: string;
    sent_at?: string;
    received_at?: string;
    thread_id?: string;
    has_attachments?: boolean;
    attachment_count?: number;
    source: 'gmail' | 'outlook' | 'imessage';
  }
): { id: number; created: boolean } {
  return db.transaction(() => {
    // Check if message exists
    const existing = db.prepare(
      'SELECT id FROM messages WHERE external_id = ?'
    ).get(message.external_id) as { id: number } | undefined;

    if (existing) {
      return { id: existing.id, created: false };
    }

    // Create new message
    const result = db.prepare(`
      INSERT INTO messages (
        external_id, subject, body_plain, body_html,
        sender, recipients, cc, bcc,
        sent_at, received_at, thread_id,
        has_attachments, attachment_count, source,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      message.external_id,
      message.subject || null,
      message.body_plain || null,
      message.body_html || null,
      message.sender || null,
      message.recipients || null,
      message.cc || null,
      message.bcc || null,
      message.sent_at || null,
      message.received_at || null,
      message.thread_id || null,
      message.has_attachments ? 1 : 0,
      message.attachment_count || 0,
      message.source
    );

    return { id: result.lastInsertRowid as number, created: true };
  })();
}

export function getMessageById(db: Database, id: number): Message | null {
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | null;
}

export function getMessageByExternalId(db: Database, externalId: string): Message | null {
  return db.prepare('SELECT * FROM messages WHERE external_id = ?').get(externalId) as Message | null;
}
```

### Update Email Linking

In `transaction-handlers.ts`, update the email linking to:
1. Create message in messages table first
2. Create communication reference pointing to message_id

```typescript
// Before (storing in communications directly)
const commResult = await createCommunicationReference(db, {
  transaction_id: transactionId,
  subject: email.subject,
  body_plain: email.body,
  // ... other fields
});

// After (store in messages, reference from communications)
const { id: messageId } = createOrGetMessage(db, {
  external_id: email.id,
  subject: email.subject,
  body_plain: email.body,
  sender: email.from,
  recipients: email.to,
  sent_at: email.date,
  source: 'gmail', // or 'outlook'
});

const commResult = await createCommunicationReference(db, {
  transaction_id: transactionId,
  message_id: messageId,
  communication_type: 'email',
  link_source: 'manual',
});
```

## Integration Notes

- Depends on: TASK-1214
- This changes how emails are stored but should be transparent to UI
- Phase 6 will update the queries to read from messages table

## Do / Don't

### Do:

- Make `createOrGetMessage` truly idempotent (check by external_id)
- Wrap in transaction for atomicity
- Keep the communications reference creation (just update it)

### Don't:

- Don't remove the legacy columns yet
- Don't break existing email display
- Don't change how text messages work (only emails in this task)

## When to Stop and Ask

- If the messages table schema doesn't match expectations
- If email linking was working differently than assumed
- If more than 5 files need modification (scope creep) *[SR Engineer adjusted from 3 - handler updates naturally touch multiple files]*

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests: `messageDbService.test.ts`
  - Test idempotent creation
  - Test getMessageById
  - Test getMessageByExternalId

### Integration / Feature Tests

- Manual: Link a Gmail email to a transaction
- Manual: Link an Outlook email to a transaction
- Manual: Verify email displays correctly

### CI Requirements

- [ ] All checks pass
- [ ] New tests pass

## PR Preparation

- **Title**: `feat(db): create messageDbService and update email linking`
- **Labels**: `database`, `feature`
- **Depends on**: TASK-1214

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~25K-30K

**Token Cap:** 120K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| New service | ~150 lines | +15K |
| Handler updates | ~50 lines each | +10K |
| Tests | Basic coverage | +5K |

**Confidence:** Medium (handler complexity uncertain)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/services/db/messageDbService.ts
- [ ] electron/services/db/messageDbService.test.ts

Files updated:
- [ ] electron/services/db/index.ts
- [ ] electron/transaction-handlers.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] Manual: Gmail email links correctly
- [ ] Manual: Outlook email links correctly
- [ ] Manual: Email displays correctly after linking
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Idempotency Verified:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Verification (MANDATORY)

- [ ] Merge verified: state shows `MERGED`

---

## User Testing Gate

**AFTER this task merges, user must test EMAIL LINKING specifically:**

- [ ] Connect Gmail account (if not already)
- [ ] Link an email to a transaction
- [ ] Verify email appears in transaction messages tab
- [ ] Open the email - verify content displays
- [ ] Connect Outlook account (if applicable)
- [ ] Link an Outlook email
- [ ] Verify display

**This is the email-specific gate. If email linking works, approve proceeding to TASK-1216.**
