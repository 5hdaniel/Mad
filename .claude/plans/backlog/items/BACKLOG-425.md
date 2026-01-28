# BACKLOG-425: Test Desktop Status Sync and Broker Portal Actions

**Created**: 2026-01-23
**Priority**: High
**Category**: Testing
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Verify the full round-trip workflow between desktop app and broker portal. These features were implemented in SPRINT-050 but deferred for testing until transaction status alignment is complete.

---

## Test Cases

### Desktop App - Status Sync

| Test | Expected Result |
|------|-----------------|
| Submit transaction → Check status | Shows "Submitted" or "Under Review" |
| After broker approves → Check status | Shows "Approved" |
| After broker rejects → Check status | Shows "Rejected" |
| After broker requests changes → Check status | Shows "Needs Changes" |
| See broker's review notes | Notes visible in transaction detail |
| Resubmit after changes requested | Can resubmit, status updates |

### Broker Portal - Review Actions

| Test | Expected Result |
|------|-----------------|
| Filter submissions by status | List filters correctly |
| Approve a submission | Status changes to "Approved" |
| Reject a submission with reason | Status changes to "Rejected", reason saved |
| Request changes with notes | Status changes to "Needs Changes", notes saved |

### Full Round-Trip Flow

1. Agent submits transaction from desktop
2. Broker sees it in portal dashboard
3. Broker clicks "Request Changes" with notes
4. Agent sees status update + notes in desktop app
5. Agent makes changes and resubmits
6. Broker approves resubmission
7. Agent sees "Approved" status in desktop app

---

## Dependencies

- Transaction status alignment (if separate backlog item)
- SPRINT-050 features deployed and working

---

## Acceptance Criteria

- [ ] All desktop status sync tests pass
- [ ] All broker portal review action tests pass
- [ ] Full round-trip flow works end-to-end
- [ ] No console errors during workflow

---

## Related

- SPRINT-050: B2B Broker Portal Demo (implementation)
- BACKLOG-395: Desktop - Status Sync + Review Notes Display
- BACKLOG-400: Portal - Review Actions
