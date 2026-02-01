# Task TASK-1166: Test Desktop Status Sync

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

Test and verify that status sync between the desktop app and broker portal is working correctly. This is a prerequisite for the full E2E workflow testing.

## Non-Goals

- Do NOT implement new sync functionality (should already exist from SPRINT-050)
- Do NOT fix issues found (document them for separate tasks)
- Do NOT test the complete workflow (that's TASK-1167)

## Deliverables

1. New file: `.claude/docs/testing/status-sync-test-2026-01.md` (test results documentation)
2. If fixes needed: Create backlog items for issues found

## Acceptance Criteria

- [ ] Status sync from desktop to portal verified
- [ ] Status sync from portal to desktop verified
- [ ] All status transitions tested (submitted, under_review, approved, rejected, needs_changes, resubmitted)
- [ ] Broker notes display verified in desktop
- [ ] Test results documented
- [ ] Any issues found documented as backlog items

## Implementation Notes

### Test Scenarios

#### Scenario 1: Desktop to Portal
1. Create transaction in desktop
2. Submit for review
3. Verify transaction appears in broker portal
4. Verify status shows as "Submitted"

#### Scenario 2: Portal to Desktop (Approval)
1. From Scenario 1, broker approves in portal
2. Check desktop app
3. Verify status updates to "Approved"

#### Scenario 3: Portal to Desktop (Rejection)
1. Submit new transaction from desktop
2. Broker rejects in portal with notes
3. Check desktop app
4. Verify status shows "Rejected"
5. Verify broker notes are visible

#### Scenario 4: Portal to Desktop (Request Changes)
1. Submit new transaction from desktop
2. Broker requests changes in portal with feedback
3. Check desktop app
4. Verify status shows "Changes Requested"
5. Verify broker feedback is visible

#### Scenario 5: Desktop to Portal (Resubmit)
1. From Scenario 4, agent makes changes
2. Agent resubmits in desktop
3. Verify portal shows new version with "Resubmitted" status

### Documentation Format

Create `.claude/docs/testing/status-sync-test-2026-01.md`:

```markdown
# Status Sync Test Results - January 2026

## Test Date
2026-01-XX

## Test Environment
- Desktop App Version: X.X.X
- Broker Portal URL: https://...
- Test Users: agent@test.com, broker@test.com

## Test Results

| Scenario | Description | Status | Notes |
|----------|-------------|--------|-------|
| 1 | Desktop -> Portal submit | PASS/FAIL | Details... |
| 2 | Portal -> Desktop approve | PASS/FAIL | Details... |
| 3 | Portal -> Desktop reject | PASS/FAIL | Details... |
| 4 | Portal -> Desktop changes | PASS/FAIL | Details... |
| 5 | Desktop -> Portal resubmit | PASS/FAIL | Details... |

## Issues Found

### Issue 1: [Title]
- **Severity**: Critical/High/Medium/Low
- **Description**: ...
- **Steps to Reproduce**: ...
- **Expected**: ...
- **Actual**: ...
- **Backlog Item**: BACKLOG-XXX (if created)

## Sync Timing Observations
- Average sync delay: X seconds
- Any timeout issues: Yes/No

## Recommendations
- ...
```

### Known Issues to Watch For

From SPRINT-051 planning:
- BACKLOG-422: Broker Portal Review Actions Not Working
- Status sync timing/reliability
- Broker notes display in desktop

### Test Prerequisites

1. Ensure BACKLOG-422 is fixed (review actions working)
2. Have test user credentials ready:
   - Agent user in organization
   - Broker user in same organization
3. Both desktop and portal accessible

## Integration Notes

- Imports from: Desktop app and Broker Portal
- Exports to: Test documentation
- Used by: TASK-1167 (E2E testing depends on this)
- Depends on: TASK-1163 (License UI), TASK-1164 (RLS Policies)

## Do / Don't

### Do:

- Document ALL findings, including passing tests
- Note sync timing observations
- Create backlog items for any issues found
- Test with real user credentials

### Don't:

- Don't fix issues in this task (document only)
- Don't skip scenarios due to time pressure
- Don't assume sync is working without verification

## When to Stop and Ask

- If review actions are not working (BACKLOG-422 must be resolved first)
- If authentication is broken
- If you can't access the broker portal
- If major issues are blocking all scenarios

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this is manual testing)

### Coverage

- Coverage impact: Not applicable

### Integration / Feature Tests

- This task IS integration testing
- Document results for all scenarios

### CI Requirements

This task's PR MUST pass:
- [ ] Lint / format checks (for documentation)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `docs(testing): status sync test results`
- **Labels**: `testing`, `documentation`, `sprint-051`
- **Depends on**: TASK-1163, TASK-1164

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 documentation file | +3K |
| Files to modify | 0 | +0K |
| Manual testing | 5 scenarios | +5K |
| Documentation | ~200 lines | +2K |

**Confidence:** Medium

**Risk factors:**
- May find issues requiring investigation
- Sync timing may require multiple attempts

**Similar past tasks:** BACKLOG-425 originally estimated ~10K

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
- [ ] .claude/docs/testing/status-sync-test-2026-01.md

Test scenarios completed:
- [ ] Scenario 1: Desktop -> Portal submit
- [ ] Scenario 2: Portal -> Desktop approve
- [ ] Scenario 3: Portal -> Desktop reject
- [ ] Scenario 4: Portal -> Desktop changes
- [ ] Scenario 5: Desktop -> Portal resubmit

Issues documented:
- [ ] All issues logged with backlog items (if any)

Verification:
- [ ] Documentation complete
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

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
