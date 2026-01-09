# Task TASK-995: Contacts Not Pre-Populated When Editing Transaction

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

Fix the Edit Transaction modal so that existing contact assignments are pre-populated when editing a transaction. Currently, contacts must be re-selected even though they are already saved.

## Non-Goals

- Do NOT change transaction creation flow (new transactions)
- Do NOT modify contact selection UI/UX
- Do NOT change how contacts are SAVED (that's TASK-994)
- Do NOT modify the Contact model or schema
- Do NOT add new IPC handlers unless absolutely necessary

## Problem Analysis

This is a **LOAD path bug** (vs TASK-994 which is a SAVE path bug).

**What works:**
- Address field correctly pre-fills with existing transaction address
- Transaction type correctly pre-fills with existing type

**What does NOT work:**
- Contact assignment step does NOT pre-populate with saved contacts
- User must re-select all contacts even though they exist in database

**Root Cause Hypothesis:**
The `contact_assignments` are not being passed through when entering edit mode, or the edit form is not receiving/using the existing contact assignments when initializing.

## Relationship to TASK-994

| Task | Bug Type | Code Path | Key Issue |
|------|----------|-----------|-----------|
| TASK-994 | SAVE path | When clicking Save | Multiple contacts don't persist |
| TASK-995 | LOAD path | When opening Edit | Existing contacts don't pre-populate |

Both touch `EditTransactionModal` but in different flows:
- TASK-994: `handleSave()` / form submission logic
- TASK-995: Modal initialization / `useEffect` for loading data

**Can run in parallel** because they modify different code paths.

## Deliverables

1. Update: Edit modal initialization to load contact assignments
2. Update: Form state to properly initialize from existing transaction data
3. Update: Any hooks that fetch transaction details for editing
4. Add: Tests for contact pre-population in edit mode

## Acceptance Criteria

- [ ] When editing a transaction, existing contact assignments pre-populate in the form
- [ ] All roles (client, agent, lender, title, etc.) show their previously assigned contacts
- [ ] User can modify contact assignments (add/remove) from pre-populated state
- [ ] Saving preserves both unchanged and modified contact assignments
- [ ] No regression in new transaction creation flow
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Investigation Areas

1. **EditTransactionModal.tsx**: Check if `contact_assignments` are being passed to the modal
2. **Transaction detail query**: Verify the transaction query includes contact assignments
3. **Form initialization**: Check if the multi-step form properly initializes contact state from existing data
4. **State persistence**: Verify contact selections persist between form steps

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/transaction/components/EditTransactionModal.tsx` | Main edit modal |
| `src/components/transactionDetailsModule/TransactionDetailsPage.tsx` | Provides transaction data to edit |
| `src/hooks/useTransactionDetails.ts` | Transaction data fetching |
| `src/components/ContactSelectModal.tsx` | Contact selection UI |

## Implementation Notes

### Key Questions to Answer

1. Does `getTransactionById` / `getTransactionDetails` return `contact_assignments`?
2. Is the edit modal receiving the transaction object with contacts?
3. Does the form state initialize from `transaction.contact_assignments` or start empty?

### Likely Fix Pattern

```typescript
// In EditTransactionModal or similar
useEffect(() => {
  if (mode === 'edit' && transaction) {
    // Initialize form with existing data
    setFormState({
      ...formState,
      contactAssignments: transaction.contact_assignments || [],
    });
  }
}, [mode, transaction]);
```

## Integration Notes

- **Related to**: TASK-994 (same modal, different path)
- **Parallel safe**: Yes, different code paths
- **Base branch**: `feature/contact-first-attach-messages`
- **Branch name**: `fix/TASK-995-contacts-not-prepopulated`

## Do / Don't

### Do:

- Test with transactions that have multiple contacts per role
- Test with transactions that have contacts in various roles
- Verify the fix doesn't break new transaction creation
- Check that re-opening edit modal shows the SAVED state (not in-memory state)

### Don't:

- Modify the contact SAVE logic (that's TASK-994)
- Change the Contact model schema
- Break the new transaction creation flow
- Add caching that might show stale data

## When to Stop and Ask

- If `contact_assignments` field doesn't exist on transaction object
- If the edit modal doesn't receive transaction data at all
- If significant refactoring of the modal architecture is needed
- If the fix requires changes to database queries

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that edit modal initializes with existing contact assignments
  - Test that all roles populate correctly
  - Test that empty contact assignments don't cause errors

- Existing tests to update:
  - EditTransactionModal tests (if they exist)

### Coverage

- Coverage impact:
  - Must not decrease current coverage
  - New initialization logic should have test coverage

### Integration / Feature Tests

- Required scenarios:
  1. Open Edit on transaction with 1 contact -> Contact appears selected
  2. Open Edit on transaction with multiple contacts per role -> All appear
  3. Open Edit on new transaction (no contacts) -> Empty state works
  4. Modify contacts and save -> Changes persist

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(transactions): pre-populate contacts when editing transaction`
- **Labels**: `fix`, `transactions`, `contacts`
- **Base Branch**: `feature/contact-first-attach-messages`

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-4 files | +10K |
| Code volume | ~100 lines changed | +8K |
| Investigation time | Debug data flow | +7K |
| Test updates | Medium complexity | +5K |

**Confidence:** Medium

**Risk factors:**
- May need to trace data flow through multiple components
- Form state initialization may be complex

**Similar past tasks:** TASK-700 (contact selection, different but related)

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
- [ ] EditTransactionModal.tsx or equivalent
- [ ] Form initialization logic
- [ ] Tests updated

Features implemented:
- [ ] Existing contacts pre-populate in edit mode
- [ ] All roles show assigned contacts
- [ ] No regression in new transaction flow

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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~25K | ~XK | +/-X% |
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
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** feature/contact-first-attach-messages
