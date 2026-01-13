# TASK-1031: Auto-Link Communications When Contact Added to Transaction

**Backlog ID:** BACKLOG-207
**Sprint:** SPRINT-033
**Phase:** Phase 3 - UX Improvements
**Branch:** `feature/task-1031-auto-link-communications`
**Estimated Tokens:** ~40K
**Token Cap:** 160K

---

## Objective

Automatically search for and link existing communications (emails and iMessages/SMS) when a contact is added to a transaction. This eliminates the tedious manual process of attaching messages after adding a contact.

---

## Context

Currently, when a user adds a contact to a transaction:
1. The contact is associated with the transaction
2. Existing emails and text messages with that contact are NOT automatically linked
3. User must manually go to the Messages/Emails tab and attach relevant communications
4. This is tedious, especially for transactions with multiple contacts

### User Value

- **Time savings**: Eliminates manual message attachment for each contact
- **Completeness**: Ensures relevant communications are not missed
- **Better UX**: Transaction setup is more "automatic" and intelligent

---

## Requirements

### Must Do:

1. **Trigger auto-link** when contact is added to transaction
2. **Search emails** by contact's email address(es)
3. **Search messages** by contact's phone number(s)
4. **Filter by date range** (transaction dates if available, else last 6 months)
5. **Prevent duplicates** - Don't link already-linked communications
6. **Notify user** of how many communications were linked
7. **Run asynchronously** - Don't block contact save operation

### Must NOT Do:

- Auto-link during bulk import operations (performance)
- Auto-link when contact is updated (unless email/phone changed)
- Link communications from before transaction listing date (if date is set)
- Add user preference to disable (stretch goal - defer to future)

---

## Acceptance Criteria

- [ ] When a contact is added to a transaction, relevant emails are auto-linked
- [ ] When a contact is added to a transaction, relevant iMessages/SMS are auto-linked
- [ ] Communications are filtered to transaction date range (if available)
- [ ] User is notified of how many communications were linked
- [ ] Duplicate links are prevented (idempotent operation)
- [ ] Performance is acceptable (< 3 seconds for typical contact)
- [ ] Full test suite passes (`npm test`)

---

## Implementation Approach

### Trigger Point

The auto-link should trigger in `transactionService.ts` or similar when `addContactToTransaction` is called:

```typescript
async function addContactToTransaction(
  transactionId: string,
  contactId: string,
  role: string
): Promise<AddContactResult> {
  // 1. Save contact association (existing code)
  await saveContactAssociation(transactionId, contactId, role);

  // 2. Auto-link communications (NEW)
  const linkResult = await autoLinkCommunicationsForContact({
    contactId,
    transactionId
  });

  return {
    success: true,
    linkedEmails: linkResult.emailsLinked,
    linkedMessages: linkResult.messagesLinked
  };
}
```

### Auto-Link Service

```typescript
interface AutoLinkOptions {
  contactId: string;
  transactionId: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface AutoLinkResult {
  emailsLinked: number;
  messagesLinked: number;
  alreadyLinked: number;
}

async function autoLinkCommunicationsForContact(
  options: AutoLinkOptions
): Promise<AutoLinkResult> {
  const contact = await getContact(options.contactId);

  // Get transaction date range if not provided
  const dateRange = options.dateRange || await getTransactionDateRange(options.transactionId);

  // Search emails by email address(es)
  const emails = await searchEmailsByAddresses(
    contact.emails,
    dateRange
  );

  // Search messages by phone number(s)
  const messages = await searchMessagesByPhones(
    contact.phoneNumbers,
    dateRange
  );

  // Filter out already-linked communications
  const { newEmails, alreadyLinkedEmails } = await filterAlreadyLinked(
    emails,
    options.transactionId,
    'email'
  );
  const { newMessages, alreadyLinkedMessages } = await filterAlreadyLinked(
    messages,
    options.transactionId,
    'message'
  );

  // Link new communications
  await linkEmailsToTransaction(newEmails, options.transactionId);
  await linkMessagesToTransaction(newMessages, options.transactionId);

  return {
    emailsLinked: newEmails.length,
    messagesLinked: newMessages.length,
    alreadyLinked: alreadyLinkedEmails + alreadyLinkedMessages
  };
}
```

### Date Range Logic

```typescript
async function getTransactionDateRange(transactionId: string): Promise<DateRange> {
  const transaction = await getTransaction(transactionId);

  // If transaction has listing/closing dates, use them (with buffer)
  if (transaction.listing_date || transaction.closing_date) {
    const start = transaction.listing_date
      ? new Date(transaction.listing_date)
      : subMonths(new Date(), 6);

    const end = transaction.closing_date
      ? addDays(new Date(transaction.closing_date), 30)  // 30 day buffer
      : new Date();

    return { start, end };
  }

  // Default: last 6 months
  return {
    start: subMonths(new Date(), 6),
    end: new Date()
  };
}
```

### User Notification

Options for notifying the user after contact save:

```typescript
// Option 1: Return in API response
interface AddContactResponse {
  success: boolean;
  linkedEmails: number;
  linkedMessages: number;
}

// UI shows toast:
// "Added John Smith. Linked 12 emails and 8 text messages."

// Option 2: IPC event
ipcMain.emit('communications-auto-linked', {
  contactName: 'John Smith',
  emailsLinked: 12,
  messagesLinked: 8
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/transactionService.ts` | Add auto-link trigger after contact add |
| `electron/services/emailService.ts` | Add `searchEmailsByAddresses()` function |
| `electron/services/macOSMessagesImportService.ts` | Add `searchMessagesByPhones()` function |
| `src/components/transaction/components/EditTransactionModal.tsx` | Show linking results notification |
| `src/components/transaction/components/AuditTransactionModal.tsx` | Same for audit flow |

## Files to Read (for context)

- `electron/services/transactionService.ts` - Current contact add flow
- Existing email/message search functions
- How communications are currently linked to transactions

---

## Edge Cases

| Case | Handling |
|------|----------|
| Contact with no email/phone | Skip auto-link, return zeros |
| Duplicate communications | Check existing links before adding |
| Large result sets | Limit to top 100 most recent |
| Contact added to multiple transactions | Each transaction gets its own links |
| Email provider not connected | Only search available sources |
| No transaction dates set | Use 6-month lookback |

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test cases:**
```typescript
describe('autoLinkCommunicationsForContact', () => {
  it('links emails matching contact email addresses', async () => {
    const contact = { emails: ['john@example.com'] };
    const emails = [{ id: '1', from: 'john@example.com' }];

    mockSearchEmailsByAddresses.mockResolvedValue(emails);

    const result = await autoLinkCommunicationsForContact({
      contactId: 'contact-1',
      transactionId: 'tx-1'
    });

    expect(result.emailsLinked).toBe(1);
  });

  it('links messages matching contact phone numbers', async () => {
    const contact = { phoneNumbers: ['+15551234567'] };
    const messages = [{ id: '1', phone: '+15551234567' }];

    mockSearchMessagesByPhones.mockResolvedValue(messages);

    const result = await autoLinkCommunicationsForContact({
      contactId: 'contact-1',
      transactionId: 'tx-1'
    });

    expect(result.messagesLinked).toBe(1);
  });

  it('skips already-linked communications', async () => {
    // Communication already linked to transaction
    const result = await autoLinkCommunicationsForContact(...);
    expect(result.alreadyLinked).toBe(1);
    expect(result.emailsLinked).toBe(0);
  });

  it('respects date range filtering', async () => {
    // Only communications within date range should be linked
  });

  it('handles contact with no email or phone', async () => {
    const result = await autoLinkCommunicationsForContact({
      contactId: 'contact-no-info',
      transactionId: 'tx-1'
    });

    expect(result.emailsLinked).toBe(0);
    expect(result.messagesLinked).toBe(0);
  });
});
```

### Integration Tests

- [ ] Add contact with emails -> verify emails linked
- [ ] Add contact with phone -> verify messages linked
- [ ] Add contact to transaction with dates -> verify filtering

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(transaction): auto-link communications when contact added`
- **Branch:** `feature/task-1031-auto-link-communications`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Implementation:
- [ ] Auto-link service implemented
- [ ] Email search by address implemented
- [ ] Message search by phone implemented
- [ ] Date range filtering working
- [ ] Duplicate prevention working
- [ ] User notification working
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Performance > 5 seconds for typical contact
- Existing email/message search functions don't exist or have different interface
- User notification requires significant UI changes
- Auto-link conflicts with existing linking logic
- You encounter blockers not covered in the task file

---

## SR Engineer Review Notes

**Review Date:** 2026-01-11 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after TASK-1030 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** feature/task-1031-auto-link-communications

### Execution Classification
- **Parallel Safe:** No - Must run after TASK-1030
- **Depends On:** TASK-1030 (shared transactionService.ts)
- **Blocks:** None

### Shared File Analysis
- Files modified: `electron/services/transactionService.ts`, `electron/services/emailService.ts`, `electron/services/macOSMessagesImportService.ts`, UI components
- Conflicts with: TASK-1030 (transactionService.ts)

### Technical Considerations

**Existing Infrastructure:**
- `transactionService.ts` has `linkMessages()` function (lines 1509-1551) that can be reused
- `createCommunicationReference()` exists for linking messages
- `getMessagesByContact()` provides phone-based message search pattern

**Recommended Trigger Point:**
```typescript
// In assignContactToTransaction (line 1234-1250)
// Add auto-link call after successful assignment
```

**Architecture Recommendation:**
Consider creating a new `autoLinkService.ts` to isolate this logic from `transactionService.ts`. This:
1. Reduces merge conflicts with TASK-1030
2. Makes the feature more testable
3. Keeps transactionService focused on CRUD operations

**Performance Safeguards:**
- Limit to top 100 most recent communications per contact
- Add timeout (3 second max for auto-link operation)
- Run asynchronously - don't block the contact save response

**Edge Cases to Handle:**
- Contact with no email/phone: Skip gracefully
- Large result sets: Paginate or limit
- Already-linked communications: Check before creating duplicates
