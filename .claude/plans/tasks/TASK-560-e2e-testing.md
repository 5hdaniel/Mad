# Task TASK-560: E2E Desktop Status Sync and Broker Portal Actions Testing

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Verify the full round-trip workflow between desktop app and broker portal, documenting test results and any issues found.

## Non-Goals

- Do NOT implement new features
- Do NOT write automated E2E tests (manual verification)
- Do NOT fix bugs found (create backlog items instead)

## Deliverables

1. New file: `.claude/plans/testing/SPRINT-051-e2e-results.md` - Test results documentation

## Acceptance Criteria

- [ ] All desktop status sync tests executed and documented
- [ ] All broker portal review action tests executed and documented
- [ ] Full round-trip flow verified end-to-end
- [ ] Any bugs found documented as new backlog items
- [ ] No blockers for demo

## Test Cases

### Desktop App - Status Sync

| Test | Steps | Expected | Result |
|------|-------|----------|--------|
| Submit transaction | Click "Submit for Review" | Shows "Submitted" status | |
| See submitted status | Check transaction after submit | Status = "Submitted" or "Under Review" | |
| See approval | After broker approves | Status = "Approved" | |
| See rejection | After broker rejects | Status = "Rejected" | |
| See change request | After broker requests changes | Status = "Needs Changes" | |
| See review notes | After broker adds notes | Notes visible in transaction detail | |
| Resubmit | After changes requested, resubmit | Status updates, can resubmit | |

### Broker Portal - Review Actions

| Test | Steps | Expected | Result |
|------|-------|----------|--------|
| View submission list | Login as broker | List shows submissions | |
| Filter by status | Click status filter | List filters correctly | |
| Row click navigation | Click any row | Navigates to detail | |
| View messages | Open submission detail | Messages displayed | |
| View attachments | Open submission detail | Attachments downloadable | |
| Approve submission | Click Approve | Status = "Approved" | |
| Reject submission | Click Reject, add reason | Status = "Rejected", reason saved | |
| Request changes | Click Request Changes, add notes | Status = "Needs Changes", notes saved | |

### Full Round-Trip Flow

1. Agent submits transaction from desktop
2. Broker sees it in portal dashboard
3. Broker clicks "Request Changes" with notes: "Missing inspection report"
4. Agent sees status change + notes in desktop app
5. Agent makes changes and resubmits
6. Broker approves resubmission
7. Agent sees "Approved" status in desktop app

## Implementation Notes

### Test Environment

- Desktop app: Run locally with `npm run dev`
- Broker portal: Run locally with `cd broker-portal && npm run dev`
- Use test accounts for agent and broker

### Creating Test Data

1. Create a transaction in desktop app
2. Add at least 2 messages and 1 attachment
3. Submit for review

### Documentation Format

For each test, document:
- PASS / FAIL
- Screenshot (if failure)
- Console errors (if any)
- Backlog item created (if bug found)

## Integration Notes

- Depends on: All Phase 1-4 tasks complete
- Validates: SPRINT-050 features + SPRINT-051 fixes

## Do / Don't

### Do:
- Test with real user accounts
- Document all issues found
- Create backlog items for bugs
- Take screenshots of failures

### Don't:
- Fix bugs during testing (document only)
- Skip tests
- Assume "it works on my machine"

## When to Stop and Ask

- If broker portal won't start
- If login is broken
- If submit functionality doesn't work at all
- If blockers prevent testing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this IS the testing task)

### CI Requirements

- N/A (manual testing task)

## PR Preparation

- **Title**: `docs: SPRINT-051 E2E test results documentation`
- **Labels**: `testing`, `docs`
- **Depends on**: All previous SPRINT-051 tasks

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~12K-18K (apply 0.9x test multiplier)

**Token Cap:** 72K

**Confidence:** Medium

**Risk factors:**
- Unknown current state of features
- May discover multiple bugs

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Test Results Summary

| Category | Passed | Failed | Blocked |
|----------|--------|--------|---------|
| Desktop Status Sync | | | |
| Portal Actions | | | |
| Round-Trip Flow | | | |
| **Total** | | | |

### Bugs Found

| Bug | Severity | Backlog Item |
|-----|----------|--------------|
| | | |

### Blockers

<List any blockers encountered>

### Notes

<Additional observations>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

- Test coverage adequate
- Critical paths verified
- Ready for demo: YES / NO

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
