# Task TASK-1994: Manual Test -- Outlook Email Search Improvements

---

## WORKFLOW REQUIREMENT

This is a **manual testing task**. No code changes are expected. The user will perform testing and report results. If issues are found, new backlog items or fix tasks will be created.

---

## Goal

Verify that the email search improvements from TASK-1992 (SPRINT-083, maxResults increase + BCC filter) and TASK-1993 (SPRINT-084, server-side search + date filter + load more) work correctly in the running application with a real Outlook account.

## Test Scenarios

### A. TASK-1992 Verification (from SPRINT-083)

These verify the Outlook email search maxResults fix that was merged in SPRINT-083:

- [ ] **A1: More results returned** -- Open "Attach Emails" on a transaction where a contact has >100 emails. Verify more than 100 results appear (maxResults was increased from 100 to 500 for contact-specific searches).
- [ ] **A2: BCC'd emails included** -- Search for emails where the user was BCC'd on a message involving a specific contact. Verify these emails appear in results.
- [ ] **A3: No duplicates** -- Verify that the same email does not appear multiple times in the results.

### B. TASK-1993 Verification (from SPRINT-084)

These verify the server-side search, date filter, and load more features:

- [ ] **B1: Free text search** -- Type a word that appears in an email body (not subject or sender). Verify the email appears in results. This confirms server-side search is working (client-side search could not match body content).
- [ ] **B2: Subject search** -- Type part of an email subject. Verify matching emails appear.
- [ ] **B3: Sender search** -- Type a sender's name or email address. Verify matching emails appear.
- [ ] **B4: Date filter** -- Set a date range. Verify only emails within that range appear.
- [ ] **B5: Audit Period button** -- On a transaction with started_at and closed_at dates, click the "Audit Period" button. Verify the date inputs populate correctly and results are filtered.
- [ ] **B6: Load more** -- Clear the search, verify initial results load (100). If there are more than 100 emails, verify "Load More" fetches additional results from the provider.
- [ ] **B7: Debounce** -- Type quickly in the search box. Verify the search waits until typing stops (no request per keystroke).
- [ ] **B8: Empty results** -- Search for a nonsensical string. Verify "No emails matching your search" message appears.
- [ ] **B9: Attach flow** -- Search for emails, select some threads, click Attach. Verify they are attached to the transaction correctly.

### C. Cross-Provider (If Both Connected)

- [ ] **C1: Gmail search** -- If Gmail is connected, verify free text search works for Gmail emails too.
- [ ] **C2: Provider preference** -- If both Gmail and Outlook are connected, verify which provider is used (Gmail takes precedence per current handler logic).

## Expected Outcome

All scenarios pass, or issues are documented as new backlog items.

## Dependencies

- **Requires:** TASK-1993 merged to develop
- **Requires:** Running app connected to an Outlook account with sufficient email history

---

## PM Estimate (PM-Owned)

**Category:** `testing`

**Estimated Tokens:** ~4K (documenting results only; manual testing is human effort)

**Token Cap:** N/A (manual task)

---

## Test Results (Tester-Owned)

*Tested: <DATE>*

### Results

| Scenario | Pass/Fail | Notes |
|----------|-----------|-------|
| A1 | | |
| A2 | | |
| A3 | | |
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |
| B5 | | |
| B6 | | |
| B7 | | |
| B8 | | |
| B9 | | |
| C1 | | |
| C2 | | |

### Issues Found

*List any issues discovered during testing. Create backlog items for each.*

### Overall Assessment

**PASS / FAIL / PARTIAL**
