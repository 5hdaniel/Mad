# TASK-2093: Allow Deselecting Contacts in New Audit Contact Selection

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

**Backlog ID:** BACKLOG-819
**Sprint:** SPRINT-106
**Branch:** `fix/task-2093-contact-deselect-toggle`
**Estimated Tokens:** ~15K

---

## Objective

Enable toggle-deselect behavior in the "Audit New Transaction" flow's Step 2 (Select Contacts). Currently, once a contact is selected, clicking it again does not deselect it. This should be standard multi-select UX: click to select, click again to deselect.

---

## Context

In the New Audit wizard (Step 2: Select Contacts), the user selects contacts to associate with the transaction. The current implementation only supports adding contacts to the selection -- there is no way to remove one without going back. This is a basic UX gap.

---

## Requirements

### Must Do:
1. Make contact items toggleable -- clicking a selected contact deselects it
2. Ensure visual feedback clearly distinguishes selected vs unselected state
3. Ensure the contact count / selection state updates immediately on deselect
4. Preserve all existing select behavior (no regression)

### Must NOT Do:
- Do NOT change the data model or how contacts are saved to the transaction
- Do NOT modify the contact search/filter behavior
- Do NOT change the step navigation (Next/Back buttons)

---

## Acceptance Criteria

- [ ] Users can click a selected contact to deselect it
- [ ] Visual feedback clearly distinguishes selected vs unselected contacts
- [ ] Deselecting updates the contact count / selection state immediately
- [ ] No regression in the existing select flow
- [ ] All existing tests pass
- [ ] All CI checks pass

---

## Files to Modify

- `src/components/` -- Find the contact selection component used in Step 2 of the New Audit flow (likely in `src/components/transactions/` or `src/components/audit/`)
- The component responsible for rendering selectable contact items in the wizard

## Files to Read (for context)

- `src/components/transactions/` -- New Audit wizard steps
- The step component for "Select Contacts" (Step 2)

---

## Testing Expectations

### Unit Tests
- **Required:** Only if existing tests cover the select behavior
- **Existing tests to update:** Update any test that asserts selection-only behavior to also test deselection

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(ui): allow deselecting contacts in New Audit contact selection`
- **Branch:** `fix/task-2093-contact-deselect-toggle`
- **Target:** `develop`

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
- [ ] Contact selection component (identify during implementation)

Features implemented:
- [ ] Toggle deselect on contact click
- [ ] Visual feedback for selected/unselected state
- [ ] Immediate count update on deselect

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~15K vs Actual ~XK

### Notes

**Deviations from plan:**
<If you deviated, explain what and why>

**Issues encountered:**
<Document any challenges>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

---

## Guardrails

**STOP and ask PM if:**
- The contact selection component uses a shared selection pattern that other components depend on
- The change requires modifying the wizard step navigation logic
- You encounter blockers not covered in the task file
