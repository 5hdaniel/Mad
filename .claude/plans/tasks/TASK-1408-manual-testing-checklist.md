# Task TASK-1408: Manual Testing Checklist (USER GATE)

---

## USER GATE - REQUIRES MANUAL VERIFICATION

**This task is a USER GATE - it requires manual testing by the user/QA before proceeding.**

The engineer should:
1. Prepare the test environment
2. Document steps for manual testing
3. Wait for user confirmation that testing passed

---

## Goal

Verify all SPRINT-061 fixes through manual testing before final merge to develop. This is a quality gate requiring human verification.

## Non-Goals

- Do NOT auto-pass this task
- Do NOT skip any test scenarios
- Do NOT proceed without user confirmation

## Deliverables

1. Update: This task file with testing results
2. Prepare: Test environment (if needed)
3. Document: Any issues found during testing

## Acceptance Criteria

- [ ] **USER VERIFIED**: Email counters show correct values
- [ ] **USER VERIFIED**: Text thread counters show correct values
- [ ] **USER VERIFIED**: Contact names display correctly (not "unknown")
- [ ] **USER VERIFIED**: No duplicate threads appear in UI
- [ ] **USER VERIFIED**: Re-sync does not create duplicates
- [ ] All issues documented (if any)

---

## Manual Test Scenarios

### Test 1: Email Counter Accuracy (BACKLOG-510)

**Pre-conditions:**
- Have a transaction with linked emails
- Know the expected count (check database if needed)

**Steps:**
1. Navigate to Dashboard
2. Find the transaction card
3. Verify email counter shows correct number

**Expected:**
- Counter displays actual number of linked emails
- Counter is visible (not hidden)

**Result:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

**Notes:**
```
<Document any issues or observations>
```

---

### Test 2: Text Thread Counter Accuracy (BACKLOG-510)

**Pre-conditions:**
- Have a transaction with linked text threads
- Know the expected count

**Steps:**
1. Navigate to Dashboard
2. Find the transaction card
3. Verify text thread counter shows correct number

**Expected:**
- Counter displays actual number of linked text threads
- Counter is visible (not hidden)

**Result:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

**Notes:**
```
<Document any issues or observations>
```

---

### Test 3: Contact Name Resolution (BACKLOG-513)

**Pre-conditions:**
- Have contacts imported with phone numbers
- Have text messages from those contacts

**Steps:**
1. Link a text thread from a known contact to a transaction
2. Open the transaction details
3. Navigate to Messages tab
4. Check the contact name display

**Expected:**
- Contact name shows (not "unknown")
- Name matches the contact in your contacts list

**Result:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

**Notes:**
```
<Document any issues or observations>
```

---

### Test 4: Thread Deduplication - Initial Import (BACKLOG-514)

**Pre-conditions:**
- Fresh database or clean state

**Steps:**
1. Import messages from macOS
2. Link a text thread to a transaction
3. Note the thread count

**Expected:**
- Each conversation appears once
- No duplicate threads visible

**Result:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

**Notes:**
```
<Document any issues or observations>
```

---

### Test 5: Thread Deduplication - Re-sync (BACKLOG-514)

**Pre-conditions:**
- Messages already imported
- Transaction with linked threads

**Steps:**
1. Re-run message import/sync
2. Check the linked transaction
3. Verify thread count hasn't changed

**Expected:**
- Same number of threads as before
- No duplicate threads created

**Result:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

**Notes:**
```
<Document any issues or observations>
```

---

### Test 6: Zero Count Display

**Pre-conditions:**
- Transaction with NO linked communications

**Steps:**
1. Find or create a transaction without linked emails/texts
2. Check the TransactionCard display

**Expected:**
- Counter shows "0" or is hidden gracefully
- No errors or NaN displayed

**Result:** [ ] PASS / [ ] FAIL / [ ] BLOCKED

**Notes:**
```
<Document any issues or observations>
```

---

## Overall Testing Result

**Tested by:** <name>
**Test date:** <date>
**Environment:** <dev / staging / production>

### Summary

| Test | Result |
|------|--------|
| Email Counter | [ ] PASS / [ ] FAIL |
| Text Thread Counter | [ ] PASS / [ ] FAIL |
| Contact Name | [ ] PASS / [ ] FAIL |
| Thread Dedup (Initial) | [ ] PASS / [ ] FAIL |
| Thread Dedup (Re-sync) | [ ] PASS / [ ] FAIL |
| Zero Count | [ ] PASS / [ ] FAIL |

### Issues Found

| # | Description | Severity | BACKLOG Created? |
|---|-------------|----------|------------------|
| 1 | <description> | <Critical/High/Medium/Low> | <Yes/No - ID> |

### User Approval

- [ ] **All tests passed - APPROVED to proceed to SR Engineer review**
- [ ] **Tests failed - Requires fixes before proceeding**

**User signature:** ____________________
**Date:** ____________________

---

## PM Estimate (PM-Owned)

**Category:** `testing`

**Estimated Tokens:** ~5K (task prep only - manual testing is user time)

**Note**: This is primarily a USER GATE, not an engineer task. The engineer prepares the environment, but the user performs the actual testing.

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist

```
Preparation:
- [ ] Test environment ready
- [ ] Test data verified
- [ ] User notified testing is ready

User Testing:
- [ ] User performed all tests
- [ ] Results documented above
- [ ] User approval obtained
```

### Notes

<Any environment setup notes or issues>
