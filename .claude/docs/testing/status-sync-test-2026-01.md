# Status Sync Test Results - January 2026

## Test Date
2026-01-22

## Test Environment
- Desktop App Version: Run `npm run dev` from `/Users/daniel/Documents/Mad`
- Broker Portal URL: https://mad-broker-portal.vercel.app (or local: `cd broker-portal && npm run dev`)
- Test Organization: [Your test org name]
- Test Users:
  - Agent: [agent email]
  - Broker: [broker email]

---

## Pre-Test Setup

### 1. Start Desktop App
```bash
cd /Users/daniel/Documents/Mad
npm run dev
```

### 2. Start Broker Portal (if testing locally)
```bash
cd /Users/daniel/Documents/Mad/broker-portal
npm run dev
# Opens at http://localhost:3000
```

### 3. Verify Prerequisites
- [ ] Desktop app starts without errors
- [ ] Can log in as agent user
- [ ] Broker portal loads
- [ ] Can log in as broker user
- [ ] Both users are in the same organization

---

## Test Results

| Scenario | Description | Status | Notes |
|----------|-------------|--------|-------|
| 1 | Desktop -> Portal submit | ⬜ | |
| 2 | Portal -> Desktop approve | ⬜ | |
| 3 | Portal -> Desktop reject | ⬜ | |
| 4 | Portal -> Desktop changes | ⬜ | |
| 5 | Desktop -> Portal resubmit | ⬜ | |

Legend: ✅ PASS | ❌ FAIL | ⬜ NOT TESTED

---

## Detailed Test Steps

### Scenario 1: Desktop to Portal Submit

**Steps:**
1. [ ] In desktop app, create a new transaction (or use existing)
2. [ ] Add at least one contact
3. [ ] Add at least one message/communication
4. [ ] Click "Submit for Review" button
5. [ ] Note any upload progress indicators
6. [ ] Wait for submission confirmation

**Expected:**
- Transaction submits successfully
- Status changes to "Submitted" in desktop
- Success message shown

**Actual:**
- [ ] Submission successful: Yes / No
- [ ] Status updated: Yes / No
- [ ] Time to submit: ___ seconds
- Notes:

---

### Scenario 2: Portal to Desktop (Approval)

**Steps:**
1. [ ] Log into broker portal as broker user
2. [ ] Navigate to Submissions list
3. [ ] Find the transaction submitted in Scenario 1
4. [ ] Open submission details
5. [ ] Click "Approve" button
6. [ ] Return to desktop app
7. [ ] Check transaction status (may need to refresh)

**Expected:**
- Submission visible in portal
- Approve button works
- Desktop status updates to "Approved"

**Actual:**
- [ ] Submission visible in portal: Yes / No
- [ ] Approve button worked: Yes / No
- [ ] Desktop status updated: Yes / No
- [ ] Sync time: ___ seconds
- Notes:

---

### Scenario 3: Portal to Desktop (Rejection)

**Steps:**
1. [ ] Submit a NEW transaction from desktop
2. [ ] In broker portal, find the new submission
3. [ ] Click "Reject" button
4. [ ] Enter rejection notes: "Test rejection - missing documents"
5. [ ] Confirm rejection
6. [ ] Check desktop app for status update

**Expected:**
- Rejection saves with notes
- Desktop shows "Rejected" status
- Rejection notes visible in desktop

**Actual:**
- [ ] Rejection saved: Yes / No
- [ ] Notes saved: Yes / No
- [ ] Desktop status updated: Yes / No
- [ ] Notes visible in desktop: Yes / No
- Notes:

---

### Scenario 4: Portal to Desktop (Request Changes)

**Steps:**
1. [ ] Submit a NEW transaction from desktop
2. [ ] In broker portal, find the submission
3. [ ] Click "Request Changes" button
4. [ ] Enter feedback: "Please attach the inspection report"
5. [ ] Confirm request
6. [ ] Check desktop app for status and feedback

**Expected:**
- Changes Requested status in portal
- Desktop shows "Changes Requested" (or similar)
- Feedback notes visible in desktop

**Actual:**
- [ ] Request saved: Yes / No
- [ ] Feedback saved: Yes / No
- [ ] Desktop status updated: Yes / No
- [ ] Feedback visible in desktop: Yes / No
- Notes:

---

### Scenario 5: Desktop to Portal (Resubmit)

**Steps:**
1. [ ] From Scenario 4 transaction (with Changes Requested status)
2. [ ] In desktop, make the requested changes (add a document/message)
3. [ ] Click "Resubmit" button
4. [ ] Check broker portal for updated submission

**Expected:**
- Resubmit button available for Changes Requested transactions
- Portal shows new version as "Resubmitted"
- Version number incremented

**Actual:**
- [ ] Resubmit button available: Yes / No
- [ ] Resubmit successful: Yes / No
- [ ] Portal shows resubmission: Yes / No
- [ ] Version tracking works: Yes / No
- Notes:

---

## Issues Found

### Issue 1: [Title]
- **Severity**: Critical / High / Medium / Low
- **Scenario**:
- **Description**:
- **Steps to Reproduce**:
- **Expected**:
- **Actual**:
- **Backlog Item**: BACKLOG-XXX (if created)

### Issue 2: [Title]
(Copy template as needed)

---

## Sync Timing Observations

| Action | Time (seconds) |
|--------|----------------|
| Submit to cloud | |
| Approve sync to desktop | |
| Reject sync to desktop | |
| Changes Request sync | |
| Resubmit to cloud | |

**Average sync delay:** ___ seconds
**Any timeout issues:** Yes / No

---

## Recommendations

-

---

## Sign-off

- **Tester**:
- **Date**:
- **Overall Status**: PASS / FAIL / PARTIAL
