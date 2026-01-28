# TASK-1032: Separate Email and Text Message Counts on Transaction Cards

**Backlog ID:** BACKLOG-208
**Sprint:** SPRINT-033
**Phase:** Phase 3 - UX Improvements
**Branch:** `fix/task-1032-separate-counts`
**Estimated Tokens:** ~20K
**Token Cap:** 80K

---

## Objective

Update transaction cards to display separate counts for emails and text messages instead of a combined or mislabeled count. Users need to distinguish at a glance how many of each communication type are linked to a transaction.

---

## Context

Transaction cards currently display a combined count showing "X emails" but this count may include text messages or texts are being mislabeled as emails. For an audit tool, the distinction between email and text evidence matters.

### Current Behavior

Transaction cards display:
```
[Transaction Card]
  Property Address
  12 emails
```

But "12 emails" may actually be 8 emails + 4 text messages, or texts are mislabeled.

### Expected Behavior

Transaction cards should display separate counts:
```
[Transaction Card]
  Property Address
  8 emails, 4 texts
```

Or if only one type exists:
```
[Transaction Card]
  Property Address
  8 emails
```

---

## Requirements

### Must Do:

1. **Update database query** to return separate counts by communication type
2. **Update TransactionCard UI** to display separate email and text counts
3. **Handle edge cases** gracefully (zero counts, singular/plural)
4. **Maintain performance** - No degradation in transaction list rendering

### Must NOT Do:

- Add icons without design approval (text labels are sufficient)
- Change the overall card layout significantly
- Add new database columns

---

## Acceptance Criteria

- [ ] Transaction cards display separate counts for emails and text messages
- [ ] Counts accurately reflect the actual communication types in the database
- [ ] Zero counts are handled gracefully (e.g., "3 emails" not "3 emails, 0 texts")
- [ ] Singular/plural grammar is correct ("1 email" vs "2 emails", "1 text" vs "2 texts")
- [ ] UI design is clear and not cluttered
- [ ] Query performance is not degraded
- [ ] Full test suite passes (`npm test`)

---

## Implementation Approach

### Database Query Change

```sql
-- Current (suspected)
SELECT COUNT(*) as email_count
FROM communications
WHERE transaction_id = ?

-- Proposed
SELECT
  SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) as email_count,
  SUM(CASE WHEN channel IN ('sms', 'imessage') THEN 1 ELSE 0 END) as text_count
FROM communications
WHERE transaction_id = ?
```

Or if using a different table structure:

```sql
SELECT
  (SELECT COUNT(*) FROM emails WHERE transaction_id = ?) as email_count,
  (SELECT COUNT(*) FROM messages WHERE transaction_id = ?) as text_count
```

### Service Layer Change

```typescript
interface TransactionCommunicationCounts {
  emails: number;
  texts: number;
}

async function getTransactionCommunicationCounts(
  transactionId: string
): Promise<TransactionCommunicationCounts> {
  // Execute query and return counts
}

// Update getTransactionSummary or similar to include both counts
interface TransactionSummary {
  // ... existing fields
  emailCount: number;  // was: communicationCount
  textCount: number;   // NEW
}
```

### UI Component Change

```typescript
// src/components/transaction/TransactionCard.tsx

interface TransactionCardProps {
  transaction: TransactionSummary;
}

function renderCommunicationCount(emailCount: number, textCount: number): string {
  const parts: string[] = [];

  if (emailCount > 0) {
    parts.push(`${emailCount} ${emailCount === 1 ? 'email' : 'emails'}`);
  }

  if (textCount > 0) {
    parts.push(`${textCount} ${textCount === 1 ? 'text' : 'texts'}`);
  }

  if (parts.length === 0) {
    return 'No communications';
  }

  return parts.join(', ');
}

// In render:
<span className="communication-count">
  {renderCommunicationCount(transaction.emailCount, transaction.textCount)}
</span>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/transaction/TransactionCard.tsx` | Update UI to show separate counts |
| `electron/services/transactionService.ts` | Update query to return counts by type |
| `electron/services/db/` | Add/update query for separate counts |

## Files to Read (for context)

- `src/components/transaction/TransactionCard.tsx` - Current card implementation
- Database schema for communications table(s)
- Current query that fetches transaction list

---

## Investigation Needed

Before implementing, verify:

1. **What table stores communications?** (communications, emails, messages, or separate tables?)
2. **What column indicates type?** (channel, type, or implicit by table?)
3. **Current query location** - Where is the count fetched?

```bash
# Find communication count query
grep -rn "email_count\|emailCount\|communication" electron/services/
grep -rn "COUNT" electron/services/transactionService.ts
```

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**Test cases:**
```typescript
describe('renderCommunicationCount', () => {
  it('shows only emails when no texts', () => {
    expect(renderCommunicationCount(5, 0)).toBe('5 emails');
  });

  it('shows only texts when no emails', () => {
    expect(renderCommunicationCount(0, 3)).toBe('3 texts');
  });

  it('shows both when both exist', () => {
    expect(renderCommunicationCount(8, 4)).toBe('8 emails, 4 texts');
  });

  it('handles singular correctly', () => {
    expect(renderCommunicationCount(1, 1)).toBe('1 email, 1 text');
  });

  it('shows no communications when both zero', () => {
    expect(renderCommunicationCount(0, 0)).toBe('No communications');
  });
});

describe('getTransactionCommunicationCounts', () => {
  it('returns correct counts by type', async () => {
    // Setup: transaction with 3 emails and 2 texts
    const counts = await getTransactionCommunicationCounts('tx-1');
    expect(counts.emails).toBe(3);
    expect(counts.texts).toBe(2);
  });

  it('handles transaction with no communications', async () => {
    const counts = await getTransactionCommunicationCounts('empty-tx');
    expect(counts.emails).toBe(0);
    expect(counts.texts).toBe(0);
  });
});
```

### Manual Testing

- [ ] Transaction with only emails shows only email count
- [ ] Transaction with only texts shows only text count
- [ ] Transaction with both shows both counts correctly
- [ ] Transaction with no communications shows appropriate message
- [ ] Verify counts match actual database records
- [ ] Check performance with transactions having many linked messages

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(ui): display separate email and text counts on transaction cards`
- **Branch:** `fix/task-1032-separate-counts`
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

Investigation:
- [ ] Identified communication table(s)
- [ ] Found current count query
- [ ] Understood data model

Implementation:
- [ ] Query updated for separate counts
- [ ] UI updated to display both
- [ ] Edge cases handled
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Communication data model is more complex than expected
- Query change would require database migration
- Performance degrades by more than 20%
- Current count includes other types besides email/text
- You encounter blockers not covered in the task file

---

## SR Engineer Review Notes

**Review Date:** 2026-01-11 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after Phase 2 complete)
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1032-separate-counts

### Execution Classification
- **Parallel Safe:** Yes - Can run parallel with TASK-1031
- **Depends On:** Phase 2 completion
- **Blocks:** None

### Shared File Analysis
- Files modified: `src/components/transaction/components/TransactionCard.tsx`, database query layer
- Conflicts with: None - isolated changes

### Technical Considerations

**Current Implementation (TransactionCard.tsx line 149):**
```tsx
{transaction.total_communications_count || 0} emails
```

**Required Changes:**
1. **Database Layer:** Add query to return counts by communication type
2. **Type Definition:** Add `email_count` and `text_count` to Transaction type
3. **UI Component:** Update display logic in TransactionCard.tsx

**Query Pattern:**
```sql
SELECT
  SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) as email_count,
  SUM(CASE WHEN channel IN ('sms', 'imessage') THEN 1 ELSE 0 END) as text_count
FROM messages
WHERE transaction_id = ?
```

**UI Display Logic:**
```typescript
function renderCommunicationCount(emailCount: number, textCount: number): string {
  const parts: string[] = [];
  if (emailCount > 0) parts.push(`${emailCount} ${emailCount === 1 ? 'email' : 'emails'}`);
  if (textCount > 0) parts.push(`${textCount} ${textCount === 1 ? 'text' : 'texts'}`);
  return parts.length === 0 ? 'No communications' : parts.join(', ');
}
```

**Risk Assessment:** LOW
- Isolated UI change with no shared file conflicts
- Standard query modification
- Well-defined acceptance criteria

**Testing Notes:**
- Test singular/plural grammar ("1 email" vs "2 emails")
- Test zero counts (hide rather than show "0 emails")
- Verify query performance does not degrade transaction list loading
