# Task TASK-800: Create Fake Email Mailbox Fixtures

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Create a comprehensive fake email mailbox fixture system that provides realistic email test data for both Gmail and Outlook providers, enabling reproducible testing of email sync, AI detection, and transaction extraction features.

## Non-Goals

- Do NOT create actual email provider connections
- Do NOT modify production email fetch services
- Do NOT implement real OAuth flows
- Do NOT create fixtures for text messages (that is TASK-801)

## Deliverables

1. New file: `electron/services/__tests__/fixtures/fake-mailbox/emails.json`
2. New file: `electron/services/__tests__/fixtures/fake-mailbox/types.ts`
3. New file: `electron/services/__tests__/fixtures/fake-mailbox/emailFixtureService.ts`
4. New file: `electron/services/__tests__/fixtures/fake-mailbox/README.md`

## Acceptance Criteria

- [ ] Email fixture JSON contains at least 100 emails across 30+ threads
- [ ] Emails cover all transaction stages: prospecting, negotiation, under_contract, due_diligence, closing, closed
- [ ] Emails include realistic metadata: subjects, bodies, timestamps, thread IDs, labels
- [ ] Fixture includes spam emails, normal emails, and edge cases
- [ ] Fixture includes both Gmail and Outlook email formats
- [ ] EmailFixtureService provides loading, filtering, and conversion utilities
- [ ] Type definitions match existing `ParsedEmail` interfaces
- [ ] All fixtures use deterministic IDs for reproducible testing
- [ ] All CI checks pass

## Implementation Notes

### Email Fixture Structure

```typescript
export interface FakeEmail {
  id: string;
  thread_id: string;
  provider: 'gmail' | 'outlook';
  subject: string;
  body: string;
  bodyHtml?: string;
  sender: string;
  recipients: string[];
  labels: string[];
  sent_at: string;

  // Test metadata
  category: 'transaction' | 'spam' | 'normal' | 'edge_case';
  stage?: TransactionStage;
  expected: {
    isTransaction: boolean;
    transactionType: 'purchase' | 'sale' | 'lease' | null;
    shouldBeSpam: boolean;
  };
}
```

### Email Content Suggestions

Include realistic real estate emails:
1. **Prospecting**: "New listing at 123 Main St", "Price reduction"
2. **Negotiation**: "Counter offer received", "Inspection terms"
3. **Under Contract**: "Contract signed", "Earnest money receipt"
4. **Closing**: "Closing documents attached", "Final walkthrough"

## Integration Notes

- Used by: TASK-802 (Integration Testing Framework)
- Depends on: None

## PR Preparation

- **Title**: `test(fixtures): add fake email mailbox fixtures`
- **Labels**: `test`, `infrastructure`

---

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2025-12-28 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-800-email-fixtures

### Execution Classification
- **Parallel Safe:** YES - no shared files with TASK-801
- **Depends On:** None
- **Blocks:** TASK-802 (Integration Testing Framework)

### Shared File Analysis

| File | Tasks | Risk |
|------|-------|------|
| `jest.config.js` | TASK-802 only | None for this task |
| New fixture directory | TASK-800 only | None |

### Technical Validation

1. **Existing Fixture Pattern:**
   - Reference: `electron/services/extraction/__tests__/fixtures/accuracy-test-emails.json`
   - Good pattern with 60 emails, metadata, expected results
   - New fixtures should match this structure for consistency

2. **ParsedEmail Interface:**
   - Located in `electron/services/gmailFetchService.ts`
   - Key fields: id, thread_id, subject, body, sender, recipients, labels, sent_at
   - Also: hasAttachments, attachmentCount, attachments[]

3. **Email Fixture Requirements - APPROVED:**
   - 100 emails across 30+ threads is appropriate
   - Stage coverage (prospecting -> closing) aligns with TransactionStage enum
   - Include both Gmail and Outlook format variations
   - Deterministic IDs (e.g., `test-email-001`) for reproducibility

4. **Recommended Fixture Structure:**
   ```typescript
   // Align with existing accuracy-test-emails.json pattern
   {
     "metadata": {
       "description": "...",
       "version": "1.0.0",
       "totalEmails": 100,
       ...
     },
     "emails": [
       {
         "id": "fake-email-001",
         "thread_id": "thread-001",
         "provider": "gmail",  // NEW: distinguish provider
         "subject": "...",
         "body": "...",
         // ... standard email fields
         "category": "transaction",
         "stage": "closing",
         "expected": {
           "isTransaction": true,
           "transactionType": "purchase",
           "shouldBeSpam": false
         }
       }
     ]
   }
   ```

### Technical Considerations
- Keep fixture JSON under 1MB for fast loading in tests
- Include realistic email threading (replies, forwards)
- Add edge cases: empty body, long subject, unicode characters
- Include attachment metadata samples (not actual files)

### Risk Assessment
- **LOW:** This is test infrastructure, not production code
- Ensure fixture loading helper handles JSON parse errors gracefully

---

## PM Estimate

**Turns:** 8-12 | **Tokens:** ~40K-60K | **Time:** ~1-2h
