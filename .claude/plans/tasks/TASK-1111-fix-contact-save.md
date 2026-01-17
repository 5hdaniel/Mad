# Task TASK-1111: Fix Contact Changes Not Saving

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

Fix the EditContactsModal to properly save contact changes when editing a transaction. Currently, adding/modifying/removing contacts during edit does not persist after saving.

## Non-Goals

- Do NOT refactor the entire contact assignment system
- Do NOT change the contact selection UI
- Do NOT modify the ContactSelectModal component
- Do NOT add new contact fields or properties

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`
2. Possibly update: Related handlers or API calls

## Acceptance Criteria

- [ ] Adding contacts during edit persists after save
- [ ] Removing contacts during edit persists after save
- [ ] Modifying contact roles persists after save
- [ ] Existing contacts load correctly (pre-population still works)
- [ ] Error states display correctly
- [ ] Toast/notification shows on successful save
- [ ] All existing tests pass
- [ ] All CI checks pass

## Implementation Notes

### Root Cause Analysis

Looking at `EditContactsModal.tsx`, the `handleSave` function:

```typescript
const handleSave = async () => {
  setSaving(true);
  setError(null);

  try {
    // Get current assignments to determine what to delete
    const currentResult = await window.api.transactions.getDetails(transaction.id);
    const currentAssignments = currentResult.success
      ? currentResult.transaction.contact_assignments || []
      : [];

    // Build batch operations for contact assignments
    const operations: Array<{...}> = [];

    // Collect remove operations...
    // Collect add operations...

    if (operations.length > 0) {
      const batchResult = await window.api.transactions.batchUpdateContacts(
        transaction.id,
        operations
      );
      // ...
    }

    onSave();
    onClose();
  } catch (err) {
    // ...
  }
};
```

Potential issues:
1. **State not being collected correctly** - `contactAssignments` state may not reflect UI changes
2. **Comparison logic flawed** - The logic comparing current vs new assignments may be incorrect
3. **API call silently failing** - `batchUpdateContacts` may return success but not persist

### Investigation Steps

1. Add console.log to trace `contactAssignments` state when Save is clicked
2. Check if `handleAssignContact` and `handleRemoveContact` are updating state correctly
3. Verify the `operations` array contains expected add/remove operations
4. Confirm `batchUpdateContacts` API actually persists changes

### Key Code to Review

**State update handlers:**
```typescript
const handleAssignContact = (role: string, contact: {...}) => {
  setContactAssignments((prev) => ({
    ...prev,
    [role]: [...(prev[role] || []), contact],
  }));
};

const handleRemoveContact = (role: string, contactId: string) => {
  setContactAssignments((prev) => ({
    ...prev,
    [role]: (prev[role] || []).filter((c) => c.contactId !== contactId),
  }));
};
```

These look correct, but verify state is actually updating in React DevTools.

### Likely Fix Areas

1. **Check if `onSave` callback triggers parent refresh** - Similar to TASK-1109
2. **Verify `batchUpdateContacts` return value** - May be returning success without persisting
3. **Check operation building logic** - The add/remove comparison may have bugs

## Integration Notes

- Imports from: Window API, contact types
- Exports to: None
- Used by: TransactionContactsTab
- Depends on: None

## Do / Don't

### Do:

- Add debugging logs to trace state flow
- Verify each state update propagates correctly
- Test with adding, removing, and modifying contacts
- Check the database after save to confirm persistence

### Don't:

- Don't rewrite the entire save logic without understanding the bug
- Don't add workarounds like double-saving
- Don't modify unrelated contact functionality
- Don't change the contact selection modal

## When to Stop and Ask

- If the issue is in the backend `batchUpdateContacts` API
- If the fix requires changes to more than 2-3 files
- If you discover the issue is in a different component entirely
- If the state management requires significant refactoring

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test that adding contact updates state correctly
  - Test that removing contact updates state correctly
  - Test that save operation includes correct operations
- Existing tests to update:
  - Update mocks to verify API calls with correct data

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Add contact, save, reload - contact persists
  - Remove contact, save, reload - contact removed
  - Modify role, save, reload - role persists

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(contacts): persist contact changes when editing transaction`
- **Labels**: `bug`, `data-persistence`
- **Depends on**: None

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1111-contact-save

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** TASK-1112 (Phase 2 starts after Phase 1)

### Shared File Analysis
- **Primary file:** `src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx`
- **Secondary files (possible):** None expected - isolated modal component
- **Conflicts with:** None - separate modal from TASK-1109's TransactionMessagesTab

### Technical Considerations
1. **State Debugging:** Use React DevTools to verify `contactAssignments` state reflects UI changes when Save is clicked.
2. **API Verification:** Add logging to confirm `batchUpdateContacts` is called with correct operations and returns success.
3. **Database Check:** After save, query database directly to verify changes persisted (not just API response).
4. **Comparison Logic:** The add/remove operations comparison in `handleSave` is a likely bug location - verify it correctly identifies changes.
5. **Risk:** Low-Medium - state management debugging.

### Architecture Notes
- `EditContactsModal` is self-contained - loads its own data via `getDetails` and saves via `batchUpdateContacts`
- The `onSave` callback should trigger parent refresh, similar to TASK-1109's pattern
- No shared state with other components - safe to modify independently

### Debugging Checklist for Engineer
1. Add console.log in `handleSave` to print `contactAssignments` state
2. Add console.log to print `operations` array before API call
3. Verify `batchUpdateContacts` is being called (check network tab or IPC logs)
4. After save, reload page and check if contacts appear correctly

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Investigation | Trace state flow | +10K |
| Fix | State management or API | +10K |
| Testing | Unit tests for save logic | +10K |
| Complexity | Medium - state debugging | - |

**Confidence:** Medium

**Risk factors:**
- Root cause not yet confirmed
- May be state issue or API issue
- Multiple components involved in save flow

**Similar past tasks:** TASK-1038 (contacts pre-pop) was ~25K

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
- [ ] src/components/transactionDetailsModule/components/modals/EditContactsModal.tsx
- [ ] <other files>

Features implemented:
- [ ] Contact additions persist
- [ ] Contact removals persist
- [ ] Role changes persist

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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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
**Merged To:** develop
