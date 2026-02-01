# BACKLOG-429: Team Workflow E2E Testing

## Summary

Comprehensive end-to-end testing of the complete team workflow: creating a transaction, submitting for review, broker approve/reject/request changes, and round-trip for changes requested.

## Category

Testing / QA

## Priority

P0 - Critical (User explicitly requested flawless workflow)

## Description

### Problem

The B2B broker workflow was implemented in SPRINT-050 but needs comprehensive testing to ensure:
- Complete flow works flawlessly
- Status sync between desktop and portal is reliable
- Broker actions (approve/reject/request changes) work correctly
- Agent can respond to change requests

### Test Scenarios

#### Scenario 1: Happy Path - Approval
1. Agent creates transaction in desktop app
2. Agent submits transaction for review
3. Transaction appears in broker portal
4. Broker approves transaction
5. Desktop app shows "Approved" status

#### Scenario 2: Request Changes Flow
1. Agent creates and submits transaction
2. Broker selects "Request Changes"
3. Broker enters feedback notes
4. Agent sees "Changes Requested" status in desktop
5. Agent sees broker's notes
6. Agent makes changes and resubmits
7. Transaction appears as "Resubmitted" in portal
8. Broker approves
9. Desktop shows "Approved"

#### Scenario 3: Rejection Flow
1. Agent creates and submits transaction
2. Broker rejects with reason
3. Desktop shows "Rejected" status with broker notes

#### Scenario 4: Multiple Rounds
1. Agent submits -> Broker requests changes -> Agent resubmits
2. Broker requests more changes -> Agent resubmits again
3. Broker approves
4. Verify all history preserved

### Test Points

| Step | Desktop Action | Expected Portal | Expected Desktop |
|------|----------------|-----------------|------------------|
| Create | New transaction | - | Transaction saved |
| Submit | Click Submit | Submission appears | Status: Submitted |
| Review | - | Broker sees details | - |
| Approve | - | Status: Approved | Status: Approved |
| Reject | - | Status: Rejected | Status: Rejected |
| Request | - | Status: Changes | Status: Changes |
| Resubmit | Click Resubmit | Version 2 appears | Status: Resubmitted |

### Known Issues to Verify

From SPRINT-051 planning, these issues were flagged:
- [ ] Review actions (Approve/Reject/Request Changes) may be broken
- [ ] BACKLOG-422: Portal review actions not working
- [ ] Status sync timing/reliability
- [ ] Broker notes display in desktop

## Acceptance Criteria

- [ ] Happy path (submit -> approve) works end-to-end
- [ ] Request changes flow works (submit -> request -> resubmit -> approve)
- [ ] Rejection flow works with broker notes visible
- [ ] Multiple round-trips work with version tracking
- [ ] Status sync is reliable (desktop reflects portal changes)
- [ ] Broker notes visible to agent in desktop app
- [ ] All existing test cases pass

## Estimated Effort

~25K tokens

## Dependencies

- License system working (BACKLOG-426, 427, 428)
- Review actions working (BACKLOG-422 if needed)

## Related Items

- BACKLOG-422: Broker Portal Review Actions Not Working
- BACKLOG-425: Test Desktop Status Sync and Broker Portal Actions
- SPRINT-050: B2B Broker Portal Demo
