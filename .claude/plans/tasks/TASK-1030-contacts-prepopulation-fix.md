# TASK-1030: Fix Contacts Not Pre-Populating in Edit Transaction

**Backlog ID:** BACKLOG-210
**Sprint:** SPRINT-033
**Phase:** Phase 2 - Stability & Regression Fixes
**Branch:** `fix/task-1030-contacts-prepopulation`
**Estimated Tokens:** ~20K
**Token Cap:** 80K

---

## Objective

Fix the regression where contact assignments do not pre-populate when editing an existing transaction. This is an incomplete fix from TASK-995 (PR #357).

---

## Context

When editing an existing transaction, the contact assignments are NOT pre-populating in the edit form. The previous fix attempt (TASK-995 / PR #357) changed role priority but did not fully resolve the issue.

### What Works

- Transaction details (address, type, dates) correctly pre-fill
- The edit form renders correctly

### What Does NOT Work

- Contact assignments do NOT appear when editing a transaction
- User must re-select all contacts even though they exist in the database

### Previous Fix Attempt (TASK-995)

Changed role priority from:
```typescript
const role = assignment.specific_role || assignment.role;
```
To:
```typescript
const role = assignment.role || assignment.specific_role;
```

This was intended to align with AUDIT_WORKFLOW_STEPS constants but did not resolve the issue.

---

## Requirements

### Must Do:

1. **Investigate root cause** - Determine why contacts aren't loading:
   - Check database data (is `role` field populated in `transaction_contacts`?)
   - Check API response (does `getTransactionDetails` return `contact_assignments`?)
   - Check UI logic (does `loadContactAssignments()` correctly process data?)
2. **Fix the root cause** - Not just symptoms
3. **Verify all role types** - Buyer, seller, agents, lender, title, etc.
4. **Add tests** to prevent regression

### Must NOT Do:

- Hardcode workarounds that mask the real issue
- Break new transaction creation flow
- Modify database schema

---

## Acceptance Criteria

- [ ] When editing a transaction, existing contacts appear in their assigned roles
- [ ] All role types populate correctly (buyer, seller, agents, lender, title, etc.)
- [ ] Modifying and saving contacts works correctly
- [ ] No regression in new transaction creation
- [ ] Root cause documented in Implementation Summary
- [ ] Full test suite passes (`npm test`)

---

## Investigation Steps

### Step 1: Check Database Data

```sql
-- Check transaction_contacts for a specific transaction
SELECT tc.*, c.name as contact_name
FROM transaction_contacts tc
JOIN contacts c ON tc.contact_id = c.id
WHERE tc.transaction_id = '<known_transaction_id>'
```

Questions to answer:
- Is the `role` field populated?
- What values are stored (match AUDIT_WORKFLOW_STEPS keys)?

### Step 2: Check API Response

Add console.log in `loadContactAssignments()`:
```typescript
async function loadContactAssignments() {
  const details = await window.api.getTransactionDetails(transactionId);
  console.log('API Response - contact_assignments:', details.contact_assignments);
  // ... rest of function
}
```

Questions to answer:
- Does the response include `contact_assignments`?
- What is the structure of each assignment?
- Do role values match expected keys?

### Step 3: Check UI Grouping Logic

In `EditTransactionModal.tsx`, trace `loadContactAssignments()`:
```typescript
function loadContactAssignments() {
  // Log each step:
  // 1. Raw assignments received
  // 2. After grouping by role
  // 3. Final state being set
}
```

### Step 4: Compare Role Values

```typescript
// AUDIT_WORKFLOW_STEPS keys (expected roles)
const expectedRoles = Object.keys(AUDIT_WORKFLOW_STEPS);
console.log('Expected roles:', expectedRoles);

// Actual roles in database
const actualRoles = assignments.map(a => a.role);
console.log('Actual roles:', actualRoles);

// Find mismatches
const mismatches = actualRoles.filter(r => !expectedRoles.includes(r));
console.log('Mismatched roles:', mismatches);
```

---

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/transaction/components/EditTransactionModal.tsx` | Edit modal with `loadContactAssignments()` |
| `electron/services/transactionService.ts:1082` | `getTransactionDetails()` |
| `electron/services/db/transactionContactDbService.ts:158` | `getTransactionContactsWithRoles()` |
| `src/constants/auditWorkflow.ts` or similar | AUDIT_WORKFLOW_STEPS definition |

## Files to Read (for context)

- `src/components/transaction/` - How transaction editing works
- Previous TASK-995 PR changes (PR #357)

---

## Testing Expectations

### Unit Tests

**Required:** Yes - Prevent regression

**Test cases:**
```typescript
describe('EditTransactionModal', () => {
  it('pre-populates contacts when editing existing transaction', async () => {
    // Mock getTransactionDetails to return contact_assignments
    const mockAssignments = [
      { contact_id: '1', role: 'buyer_agent', contact: { name: 'John' } },
      { contact_id: '2', role: 'seller', contact: { name: 'Jane' } }
    ];

    // Render EditTransactionModal in edit mode
    // Verify contacts appear in correct role sections
  });

  it('handles transactions with no contacts', async () => {
    // Verify empty state renders correctly
  });

  it('handles all role types', async () => {
    // Test each role type in AUDIT_WORKFLOW_STEPS
  });
});

describe('loadContactAssignments', () => {
  it('correctly groups contacts by role', () => {
    // Unit test the grouping logic
  });

  it('handles role value mismatches gracefully', () => {
    // If role doesn't match expected keys
  });
});
```

### Manual Testing

- [ ] Create new transaction with contacts
- [ ] Edit the transaction - contacts should appear
- [ ] Add/remove contacts and save
- [ ] Verify changes persisted
- [ ] Test all role types

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(transaction): pre-populate contacts when editing transaction`
- **Branch:** `fix/task-1030-contacts-prepopulation`
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
- [ ] Checked database data
- [ ] Checked API response
- [ ] Checked UI grouping logic
- [ ] Identified root cause

Implementation:
- [ ] Fix implemented
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] Root cause documented below
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Root Cause Analysis

**Where the bug was:**
[Database / API / UI - specify]

**What was wrong:**
[Describe the actual issue]

**How the fix resolves it:**
[Describe the solution]

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
- Root cause is in the database schema
- Fix requires changes to multiple services
- The issue is related to TASK-995 in a way that suggests TASK-995 should be reverted
- Investigation takes more than 2 hours without identifying root cause
- You encounter blockers not covered in the task file

---

## SR Engineer Review Notes

**Review Date:** 2026-01-11 | **Status:** APPROVED WITH CAUTION

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after TASK-1028 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1030-contacts-prepopulation

### Execution Classification
- **Parallel Safe:** Yes - Can run parallel with TASK-1029
- **Depends On:** TASK-1028 (phase dependency)
- **Blocks:** TASK-1031 (shares transactionService.ts)

### Shared File Analysis
- Files modified: `src/components/transaction/components/EditTransactionModal.tsx`, `electron/services/transactionService.ts`
- Conflicts with: TASK-1031 (transactionService.ts)

### Technical Considerations

**Code Path Analysis:**
The `loadContactAssignments()` function (lines 101-136 of EditTransactionModal.tsx) appears correct:
```typescript
const role = assignment.role || assignment.specific_role;
```
This should properly extract the role key for grouping.

**Potential Root Causes (Investigate in Order):**
1. **API Response Missing Data:** `getDetails` may not be returning `contact_assignments`
2. **Role Key Mismatch:** Database stores different role format than `AUDIT_WORKFLOW_STEPS` keys
3. **Query Issue:** `getTransactionContactsWithRoles` may return empty for some transactions

**Investigation Steps (Before Writing Code):**
```sql
-- 1. Check transaction_contacts table directly
SELECT * FROM transaction_contacts WHERE transaction_id = '<known_id>';

-- 2. Check role values stored vs expected
SELECT DISTINCT role, specific_role FROM transaction_contacts;
```

**Time-Box:** Investigation should not exceed 2 hours. If root cause not found, escalate.

**Risk Areas:**
- This is a regression from TASK-995 (PR #357) - may need to examine that PR's changes
- If role key format changed in TASK-995, multiple components may need updates
