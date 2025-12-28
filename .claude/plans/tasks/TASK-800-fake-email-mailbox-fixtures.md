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

## PM Estimate

**Turns:** 8-12 | **Tokens:** ~40K-60K | **Time:** ~1-2h
