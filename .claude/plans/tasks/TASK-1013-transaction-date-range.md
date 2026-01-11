# Task TASK-1013: Transaction Date Range for Message Linking

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add transaction start/end date fields to the Audit Transaction Modal and filter message linking by date range to prevent app freeze when adding contacts with extensive message history.

## Non-Goals

- Do NOT modify existing message search or import logic
- Do NOT add complex date validation (simple before/after is sufficient)
- Do NOT migrate existing transactions to have date ranges
- Do NOT add date range filtering to email linking (messages only for now)

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/modals/AddressVerificationStep.tsx` - Add date pickers
2. Update: `src/hooks/useAuditTransaction.ts` - Add start_date/end_date to addressData
3. Update: `src/components/transactionDetailsModule/components/modals/AuditTransactionModal.tsx` - Update step title
4. Update: `electron/services/messageMatchingService.ts` - Add date filtering to autoLinkTextsToTransaction
5. Update: `electron/database/schema.sql` - Verify/add start_date, end_date columns

## Acceptance Criteria

- [ ] Step 1 renamed from "Verify Property Address" to "Transaction Details"
- [ ] Start date picker added (required field)
- [ ] End date picker added (optional field, with "Ongoing" option)
- [ ] Dates stored in transaction record
- [ ] Message linking filters by `sent_at >= start_date`
- [ ] If end_date provided, also filter `sent_at <= end_date`
- [ ] App does not freeze when adding contacts with 1000+ messages
- [ ] Existing transactions without dates continue to work (backward compatible)
- [ ] All CI checks pass

## Implementation Notes

### UI Changes (AddressVerificationStep.tsx)

```tsx
// Add date pickers after transaction type
<FormField>
  <Label>Transaction Start Date *</Label>
  <DatePicker
    value={addressData.startDate}
    onChange={(date) => updateAddressData({ startDate: date })}
    required
  />
</FormField>

<FormField>
  <Label>Transaction End Date (optional)</Label>
  <DatePicker
    value={addressData.endDate}
    onChange={(date) => updateAddressData({ endDate: date })}
    placeholder="Ongoing if not set"
  />
</FormField>
```

### Hook Changes (useAuditTransaction.ts)

Add to addressData type and state:
```typescript
interface AddressData {
  address: string;
  transactionType: 'purchase' | 'sale';
  startDate: Date;  // NEW - required
  endDate?: Date;   // NEW - optional
}
```

### Service Changes (messageMatchingService.ts)

Modify `autoLinkTextsToTransaction` to accept date range:

```typescript
export async function autoLinkTextsToTransaction(
  transactionId: string,
  contactIdentifiers: string[],
  startDate: Date,
  endDate?: Date
): Promise<LinkedMessage[]> {
  // Add date filtering to SQL query
  const dateFilter = endDate
    ? `AND sent_at >= ? AND sent_at <= ?`
    : `AND sent_at >= ?`;

  // ... existing logic with date filter
}
```

### Database Schema

Verify transactions table has:
```sql
start_date TEXT,  -- ISO8601 format
end_date TEXT     -- ISO8601 format, nullable
```

If columns don't exist, add migration.

## Integration Notes

- Imports from: `useAuditTransaction.ts` provides addressData to modal
- Exports to: `messageMatchingService.ts` receives dates for filtering
- Used by: `AuditTransactionModal.tsx`, `ContactAssignmentStep.tsx`
- Depends on: None (first in sprint)

## Do / Don't

### Do:
- Use existing date picker component if available
- Default start date to one year ago (common transaction timeframe)
- Log performance improvement (before: X messages, after: Y messages)
- Handle null dates gracefully for existing transactions

### Don't:
- Add complex date range validation (start < end is enough)
- Touch email linking code
- Modify message search functionality
- Add calendar widgets or complex date UX

## When to Stop and Ask

- If transactions table already has date columns with different names
- If the date picker component doesn't exist and needs to be created
- If message linking logic is significantly different than expected
- If existing tests make assumptions about transaction structure

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Date filtering in messageMatchingService
  - AddressData type includes dates
  - Backward compatibility with null dates
- Existing tests to update:
  - Any tests for autoLinkTextsToTransaction

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Create transaction with date range, add contact, verify filtered messages
  - Create transaction without end date, verify messages from start date onward

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): add transaction date range to prevent freeze on message linking`
- **Labels**: `bug`, `performance`, `messages`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui` + `service`

**Estimated Tokens:** ~15-20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 4-5 files | +10K |
| UI complexity | Date pickers (existing component) | +5K |
| Service logic | Simple date filtering | +3K |
| Test updates | Medium | +2K |

**Confidence:** Medium-High

**Risk factors:**
- Date picker component may not exist (need to create)
- Schema migration may be needed

**Similar past tasks:** TASK-1011 (UI modal changes, ~207K actual - but that was full redesign)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] AddressVerificationStep.tsx
- [ ] useAuditTransaction.ts
- [ ] AuditTransactionModal.tsx
- [ ] messageMatchingService.ts
- [ ] schema.sql (if needed)

Features implemented:
- [ ] Date pickers in Step 1
- [ ] Date filtering in message linking
- [ ] Backward compatibility

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~20K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
