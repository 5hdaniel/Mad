# Task TASK-1167: Team Workflow E2E Testing

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

Comprehensive end-to-end testing of the complete team workflow: creating a transaction, submitting for review, broker approve/reject/request changes, and round-trip for changes requested. This validates that the entire B2B flow works flawlessly.

## Non-Goals

- Do NOT implement new features
- Do NOT fix issues in this task (document and create backlog items)
- Do NOT test Individual license features (only Team workflow)

## Deliverables

1. New file: `.claude/docs/testing/e2e-workflow-test-2026-01.md` (comprehensive test results)
2. If issues found: Create backlog items for each issue

## Acceptance Criteria

- [ ] Happy path (submit -> approve) tested and documented
- [ ] Request changes flow tested (submit -> request -> resubmit -> approve)
- [ ] Rejection flow tested (submit -> reject with notes)
- [ ] Multiple round-trips tested (2+ request/resubmit cycles)
- [ ] All broker notes visible to agent
- [ ] Version tracking works correctly
- [ ] No critical issues blocking workflow
- [ ] Test results documented with screenshots/evidence

## Implementation Notes

### Test Scenarios

#### Scenario 1: Happy Path - Approval
```
Agent Actions:
1. Create new transaction with property details
2. Add contacts to transaction
3. Attach messages/communications
4. Submit transaction for review

Broker Actions:
5. Log into broker portal
6. View submission in list
7. Open submission details
8. Review messages and attachments
9. Approve transaction

Verification:
10. Desktop shows "Approved" status
11. Approval timestamp visible
12. Broker name visible
```

#### Scenario 2: Request Changes Flow
```
Agent Actions:
1. Create and submit transaction

Broker Actions:
2. Request changes with specific feedback:
   "Missing closing disclosure. Please attach."

Agent Actions:
3. View "Changes Requested" status in desktop
4. Read broker feedback
5. Make requested changes
6. Resubmit transaction

Broker Actions:
7. View resubmitted version in portal
8. Verify changes made
9. Approve transaction

Verification:
10. Desktop shows "Approved"
11. Both versions visible in history
```

#### Scenario 3: Rejection Flow
```
Agent Actions:
1. Create and submit transaction

Broker Actions:
2. Reject with reason:
   "Transaction missing critical documentation. Cannot approve."

Verification:
3. Desktop shows "Rejected" status
4. Rejection reason visible
5. Agent cannot resubmit (final state)
```

#### Scenario 4: Multiple Rounds
```
Round 1:
1. Agent submits
2. Broker requests changes: "Need inspection report"
3. Agent resubmits with inspection report

Round 2:
4. Broker requests more changes: "Need signed disclosure"
5. Agent resubmits with signed disclosure

Round 3:
6. Broker approves

Verification:
7. All versions tracked (v1, v2, v3)
8. All feedback visible in history
9. Final approval recorded
```

### Documentation Format

Create `.claude/docs/testing/e2e-workflow-test-2026-01.md`:

```markdown
# E2E Workflow Test Results - January 2026

## Test Date
2026-01-XX

## Test Environment
- Desktop App Version: X.X.X
- Broker Portal URL: https://...
- Test Organization: [name]
- Test Users:
  - Agent: agent@test.com
  - Broker: broker@test.com

## Test Results Summary

| Scenario | Description | Status | Duration |
|----------|-------------|--------|----------|
| 1 | Happy Path - Approval | PASS/FAIL | X min |
| 2 | Request Changes Flow | PASS/FAIL | X min |
| 3 | Rejection Flow | PASS/FAIL | X min |
| 4 | Multiple Rounds | PASS/FAIL | X min |

## Detailed Results

### Scenario 1: Happy Path - Approval

**Steps Executed:**
1. [x] Created transaction with address: 123 Test St
2. [x] Added 2 contacts (buyer, seller)
3. [x] Attached 5 email threads
4. [x] Submitted for review
5. [x] Broker viewed submission
6. [x] Broker approved

**Evidence:**
- [Screenshot: Transaction created]
- [Screenshot: Submission in portal]
- [Screenshot: Approval confirmation]
- [Screenshot: Desktop showing Approved]

**Observations:**
- Sync time: X seconds
- All data transferred correctly

### Scenario 2: Request Changes Flow
...

## Issues Found

### Issue 1: [Title]
- **Severity**: Critical/High/Medium/Low
- **Scenario**: X
- **Step**: X
- **Description**: ...
- **Expected**: ...
- **Actual**: ...
- **Backlog Item**: BACKLOG-XXX

## Performance Observations

| Metric | Value |
|--------|-------|
| Avg submit time | X sec |
| Avg sync time | X sec |
| Portal load time | X sec |

## Overall Assessment

- **Workflow Status**: Ready for Production / Needs Fixes
- **Blocking Issues**: X
- **Non-Blocking Issues**: X
- **Recommendation**: ...
```

### Test Prerequisites

1. TASK-1166 (Status Sync Test) completed successfully
2. All previous Phase 1-3 tasks merged
3. Test credentials ready
4. Test organization set up

### Evidence Collection

For each scenario, capture:
- Screenshots of key steps
- Status transitions
- Timestamps for timing analysis
- Any error messages

## Integration Notes

- Imports from: Desktop app, Broker Portal
- Exports to: Comprehensive test documentation
- Used by: Sprint completion validation
- Depends on: TASK-1166 (Status Sync must pass first)

## Do / Don't

### Do:

- Test systematically through each scenario
- Capture evidence (screenshots)
- Document timing observations
- Create backlog items for ALL issues found

### Don't:

- Don't skip scenarios
- Don't fix issues in this task
- Don't proceed if critical blockers found (report to PM)
- Don't rush through testing

## When to Stop and Ask

- If authentication is broken
- If submit functionality doesn't work at all
- If broker portal is inaccessible
- If you find more than 3 critical issues
- If status sync is fundamentally broken (TASK-1166 should have caught this)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this is E2E manual testing)

### Coverage

- Coverage impact: Not applicable

### Integration / Feature Tests

- This task IS comprehensive E2E testing
- All scenarios must be documented

### CI Requirements

This task's PR MUST pass:
- [ ] Lint / format checks (for documentation)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `docs(testing): comprehensive E2E workflow test results`
- **Labels**: `testing`, `documentation`, `sprint-051`
- **Depends on**: TASK-1166

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 comprehensive doc | +5K |
| Manual testing | 4 detailed scenarios | +15K |
| Documentation | ~500 lines with evidence | +5K |
| Issue documentation | 2-5 backlog items | +5K |

**Confidence:** Medium

**Risk factors:**
- May find issues requiring extended investigation
- Evidence collection takes time
- Complex scenarios have many steps

**Similar past tasks:** BACKLOG-429 estimated ~25K

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
Files created:
- [ ] .claude/docs/testing/e2e-workflow-test-2026-01.md

Test scenarios completed:
- [ ] Scenario 1: Happy Path - Approval
- [ ] Scenario 2: Request Changes Flow
- [ ] Scenario 3: Rejection Flow
- [ ] Scenario 4: Multiple Rounds

Evidence collected:
- [ ] Screenshots for all key steps
- [ ] Timing observations documented

Issues documented:
- [ ] All issues logged with backlog items

Verification:
- [ ] Documentation complete
- [ ] Overall assessment provided
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

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

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

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
