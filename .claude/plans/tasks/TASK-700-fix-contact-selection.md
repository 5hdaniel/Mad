# Task TASK-700: Fix Contact Selection Issue

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

Investigate and fix the contact selection bug that users are experiencing. This involves reproducing the issue, identifying root cause, and implementing a fix.

## Non-Goals

- Do NOT refactor contact-related components beyond the fix
- Do NOT add new contact features
- Do NOT change the contact selection UI design
- Do NOT modify database schema

## Deliverables

1. **Investigation Report**: Document reproduction steps and root cause
2. **Fix**: Update affected component(s) to resolve the issue
3. **Tests**: Add/update tests to prevent regression

## Investigation Checklist

Before implementing, reproduce and document:

- [ ] Test contact selection in `AuditTransactionModal` (creating new transaction)
- [ ] Test contact selection in `EditTransactionModal` (editing existing transaction)
- [ ] Test single-select vs multi-select modes in `ContactSelectModal`
- [ ] Check for state synchronization issues (selected contacts not persisting)
- [ ] Check for filtering issues (contacts not appearing when they should)
- [ ] Test with various contact counts (0, 1, 10, 100+)

## Files to Review

| File | Purpose |
|------|---------|
| `src/components/ContactSelectModal.tsx` | Main contact selection modal |
| `src/components/AuditTransactionModal.tsx` | Transaction creation/edit modal (verify - may contain edit functionality) |
| `src/components/transaction/components/EditTransactionModal.tsx` | Transaction edit modal (verify if this exists or if edit is in AuditTransactionModal) |
| `src/components/transactionDetailsModule/components/TransactionContactsTab.tsx` | Contact display in details |

**SR Engineer Note:** Verify which modal handles editing - it may be `AuditTransactionModal.tsx` rather than a separate `EditTransactionModal.tsx`. The codebase may use `AuditTransactionModal` for both create and edit flows.

## Acceptance Criteria

- [ ] Bug reproduction steps documented
- [ ] Root cause identified and documented
- [ ] Fix implemented
- [ ] Existing tests still pass
- [ ] New test(s) added for the specific bug scenario
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Common Contact Selection Issues

1. **State not updating**: Check if `selectedIds` state is properly managed
2. **Filter excluding valid contacts**: Check `excludeIds` prop usage
3. **Multi-select accumulation**: Check toggle logic in `handleToggleContact`
4. **Callback not firing**: Check `onSelect` prop and `handleConfirm` function

### Key Code Patterns

```typescript
// ContactSelectModal selection logic
const handleToggleContact = (contactId: string) => {
  if (multiple) {
    setSelectedIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  } else {
    setSelectedIds([contactId]);
  }
};
```

## Do / Don't

### Do:

- Document exact reproduction steps before implementing fix
- Add test case that would have caught this bug
- Keep fix minimal and focused
- Test in both single and multi-select modes

### Don't:

- Don't assume the issue without reproducing it
- Don't refactor unrelated code
- Don't change component API without updating all consumers
- Don't remove existing tests

## When to Stop and Ask

- If you cannot reproduce the bug after following investigation checklist
- If the fix requires changes to database schema
- If multiple components need significant refactoring
- If the issue is in third-party code

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test case for the specific bug scenario once identified
  - Test selection state persistence
- Existing tests to update:
  - Any tests that touch affected code paths

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Full flow: open modal -> select contact(s) -> confirm -> verify selection

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(contacts): resolve contact selection issue`
- **Labels**: `bug`, `contacts`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ui` (bug fix)

**Estimated Totals:**
- **Turns:** 4-8
- **Tokens:** ~25K-40K
- **Time:** ~45-90m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Investigation | Reproduce bug, identify cause | +2-3 |
| Files to modify | 1-2 files (scope: small) | +1-2 |
| Code volume | ~20-50 lines changed | +1 |
| Test complexity | Low (focused test case) | +1-2 |

**Confidence:** Medium (depends on bug complexity)

**Risk factors:**
- Bug may be harder to reproduce than expected
- Root cause may span multiple components

**Similar past tasks:** Bug fixes in SPRINT-009 averaged 2-4 turns

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Investigation Report

**Reproduction Steps:**
<Document exact steps to reproduce the bug>

**Root Cause:**
<Explain what causes the bug>

**Fix Approach:**
<Explain the fix>

### Checklist

```
Files modified:
- [ ] <file 1>
- [ ] <file 2>

Bug fix verified:
- [ ] Bug no longer reproducible
- [ ] Related functionality still works

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Investigation | X | ~XK | X min |
| Implementation | X | ~XK | X min |
| Testing | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any challenges>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Investigation | 2-3 turns | X | +/- X | <reason> |
| Files to modify | 1-2 | X | +/- X | <reason> |
| Test complexity | Low | Low/Med/High | - | <reason> |

**Total Variance:** Est 4-8 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<Explanation>

**Suggestion for similar tasks:**
<Recommendation>

---

## SR Engineer Review Notes (Pre-Implementation)

**Reviewed:** 2025-12-28
**Reviewer:** SR Engineer

### Technical Corrections

1. **File Path Clarification:**
   - Verify that the edit modal is `AuditTransactionModal.tsx`, not a separate `EditTransactionModal.tsx`
   - The codebase may use a single modal for both create and edit operations

2. **Execution Recommendation:**
   - **Parallel Safe:** Yes - this task modifies contact selection components only
   - Can run in parallel with TASK-701 and TASK-705

3. **Dependencies:**
   - None identified

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

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
