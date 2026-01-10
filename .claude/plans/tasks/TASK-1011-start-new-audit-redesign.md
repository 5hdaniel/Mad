# TASK-1011: Redesign "Start New Audit" Flow

**Backlog ID:** BACKLOG-174
**Sprint:** SPRINT-029
**Phase:** Phase 1 - UX Flow Redesign
**Branch:** `feature/TASK-1011-start-new-audit`
**Estimated Tokens:** ~30K
**Token Cap:** 120K

---

## Objective

Redesign the "Start New Audit" flow to emphasize automated transaction detection rather than manual transaction creation. When users click "Start New Audit", they should see pending/AI-detected transactions first, with manual creation as a secondary option.

---

## Context

The automated transaction extraction is a key differentiator of Magic Audit. The current flow leads users to manual creation first, which undermines the product's core value proposition and trains users to bypass the automated workflow.

**Current Behavior:**
- Clicking "Start New Audit" opens manual transaction creation form directly

**Desired Behavior:**
1. Show list of pending/AI-detected transactions awaiting review
2. Provide button to view active transactions
3. Offer manual creation as secondary option ("Transaction not here? Add manually")

---

## Requirements

### Must Do:
1. Redirect "Start New Audit" to show pending transactions view
2. Display pending transactions list prominently
3. Provide "View Active Transactions" button
4. Add "Add Manually" button as secondary option
5. Maintain clear visual hierarchy emphasizing automated detection

### Must NOT Do:
- Remove the manual transaction creation capability entirely
- Break existing transaction creation flows
- Change how transactions are detected/created in the backend

---

## Acceptance Criteria

- [ ] "Start New Audit" button opens pending transactions view
- [ ] Pending transactions list is prominently displayed
- [ ] "View Active Transactions" button is available
- [ ] "Add Manually" button is available as secondary option
- [ ] Clear visual hierarchy emphasizing automated detection
- [ ] All existing tests pass
- [ ] New tests added for the redesigned flow

---

## Files to Modify

- `src/components/Dashboard.tsx` - Update "Start New Audit" button behavior
- Possibly `src/components/PendingTransactionsSection.tsx` - Reuse or extend
- `src/appCore/state/` - State management updates if needed
- Routing logic if adding new views

## Files to Read (for context)

- `src/components/Dashboard.tsx` - Current implementation
- `src/components/PendingTransactionsSection.tsx` - Existing pending transactions UI
- `src/components/TransactionList.tsx` - Active transactions display
- `src/components/AuditTransactionModal.tsx` - Manual transaction creation

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:** Tests for new routing/navigation logic
- **Existing tests to update:** Dashboard tests may need updates

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(dashboard): redesign Start New Audit flow to show pending transactions`
- **Branch:** `feature/TASK-1011-start-new-audit`
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
- [ ] Code complete
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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The pending transactions component needs significant architectural changes
- You discover the routing structure doesn't support the new flow easily
- Changes would impact other navigation flows
- You encounter blockers not covered in the task file
