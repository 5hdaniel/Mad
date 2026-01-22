# TASK-1037: Investigate/Fix Auto-Link Regression

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1037 |
| **Sprint** | SPRINT-034 |
| **Backlog Item** | BACKLOG-214 |
| **Priority** | HIGH |
| **Phase** | 2 |
| **Estimated Tokens** | ~30K |
| **Token Cap** | 120K |

---

## Problem Statement

User reports that after adding contacts to a transaction, communications (emails and text messages) are NOT automatically linked. TASK-1031 (PR #407) was supposed to implement this functionality but may have a regression or incomplete implementation.

---

## Symptoms

- Add contact to transaction
- **Expected:** Related emails and iMessages should auto-link
- **Actual:** No communications are linked
- User must manually go to Messages tab and attach chats

---

## Investigation Steps

### Step 1: Verify Implementation Is Being Called

Check that auto-link code is actually executed:

```typescript
// transactionService.ts - assignContactToTransaction
// Should call autoLinkCommunicationsForContact() after contact save

// Add logging:
console.log('Contact assigned, calling auto-link...');
const linked = await autoLinkCommunicationsForContact(transactionId, contactId);
console.log('Auto-link result:', linked);
```

### Step 2: Check for Silent Failures

The auto-link may be running but silently failing:

```typescript
try {
  await autoLinkCommunications(...);
} catch (e) {
  // Is error being swallowed here?
  console.error('Auto-link failed:', e);
}
```

### Step 3: Verify Query Results

Check if the query finds matching communications:

```typescript
// Log the search parameters and results
console.log('Searching for communications:', {
  email: contact.email,
  phone: contact.phone,
  dateRange: { start, end }
});

const results = await findCommunications(contact);
console.log('Found communications:', results.length);
```

### Step 4: Test Phone Number Normalization

Phone numbers may not match due to format differences:

| Stored Format | Contact Format | Would Match? |
|--------------|----------------|--------------|
| `+15551234567` | `555-123-4567` | No (without normalization) |
| `(555) 123-4567` | `5551234567` | No (without normalization) |

```typescript
// Verify normalization is applied
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}
```

### Step 5: Check Email Case Sensitivity

```typescript
// Should be case-insensitive
const query = `
  SELECT * FROM communications
  WHERE LOWER(sender_email) = LOWER(?) OR LOWER(recipient_email) = LOWER(?)
`;
```

### Step 6: Review PR #407 Changes

Compare implementation against requirements:

```bash
git show origin/feature/task-1031-auto-link-communications --stat
git diff develop...origin/feature/task-1031-auto-link-communications
```

---

## Test Scenarios

| Scenario | Expected | To Verify |
|----------|----------|-----------|
| Add contact with email | Emails linked | Check after contact add |
| Add contact with phone | Messages linked | Check after contact add |
| Add contact with both | Both linked | Check after contact add |
| Contact with no communications | Nothing linked (not error) | No error thrown |
| Multiple email addresses | All emails linked | Check all addresses |
| Multiple phone numbers | All messages linked | Check all numbers |

---

## Potential Root Causes

| Cause | Likelihood | Investigation |
|-------|------------|---------------|
| Auto-link not wired up at call site | Medium | Check assignContactToTransaction() |
| Query returns no results (date range) | Medium | Log query results |
| Phone number format mismatch | HIGH | Check normalization |
| Email case sensitivity | Medium | Check LOWER() in query |
| Error swallowed in try/catch | Medium | Add error logging |
| IPC handler not returning results | Low | Check renderer callback |
| Transaction date range too restrictive | Medium | Check date filtering |

---

## Files to Investigate/Modify

| File | Purpose |
|------|---------|
| `electron/services/transactionService.ts` | Contact assignment and auto-link trigger |
| `electron/services/autoLinkService.ts` | Auto-link implementation (if exists) |
| `electron/services/db/transactionDbService.ts` | Database queries |
| `electron/handlers/transactionHandlers.ts` | IPC handlers |

---

## Acceptance Criteria

- [ ] When contact is added to transaction, related emails auto-link
- [ ] When contact is added to transaction, related iMessages auto-link
- [ ] User notification shows count of linked communications
- [ ] Works for contacts with multiple email addresses
- [ ] Works for contacts with multiple phone numbers
- [ ] Phone number matching handles various formats
- [ ] Email matching is case-insensitive
- [ ] Root cause documented
- [ ] Diagnostic logging added for future debugging

---

## Testing Requirements

### Unit Tests

```typescript
describe('autoLinkCommunications', () => {
  it('links emails matching contact email', () => {});
  it('links messages matching contact phone', () => {});
  it('handles multiple contact email addresses', () => {});
  it('handles multiple contact phone numbers', () => {});
  it('normalizes phone number formats', () => {});
  it('matches emails case-insensitively', () => {});
  it('returns count of linked communications', () => {});
  it('does not error when no communications found', () => {});
});
```

### Integration Tests

- Add contact to transaction
- Verify communications appear in transaction detail
- Verify count matches actual communications

### Manual Testing

1. Create transaction with date range
2. Add contact with known email
3. Verify emails in that date range are linked
4. Check notification shows count

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1037-auto-link-regression

---

## Implementation Summary

### Root Cause Found

**The auto-link email query was searching the wrong table.**

The `findEmailsByContactEmails()` function in `autoLinkService.ts` was querying the `messages` table for emails with columns `sender` and `recipients`. However:

1. **Emails are stored in the `communications` table**, not the `messages` table
2. The `messages` table is used for iMessages/SMS only
3. The `messages` table doesn't have `sender` or `recipients` columns - it has `participants` (JSON) and `participants_flat`

The query was silently returning zero results because it was looking for non-existent columns in the wrong table.

### Changes Made

1. **Fixed `findEmailsByContactEmails()`** to query the `communications` table instead of `messages` table:
   - Changed `FROM messages m` to `FROM communications c`
   - Changed `channel = 'email'` to `communication_type = 'email'`
   - Fixed column references (`c.sender`, `c.recipients` instead of `m.sender`, `m.recipients`)
   - Removed the `duplicate_of` check (not applicable to communications table)
   - Removed the sub-query check against communications (we're already querying communications)

2. **Added `linkExistingCommunication()` helper function**:
   - For emails already in the communications table, we update their `transaction_id` directly
   - Unlike text messages (which need `createCommunicationReference` to copy from messages table to communications table)

3. **Updated email linking logic** in `autoLinkCommunicationsForContact()`:
   - Emails now use `linkExistingCommunication()` which updates existing records
   - Text messages continue using `createCommunicationReference()` which creates new records

4. **Added diagnostic logging** for debugging:
   - Debug logs show found email IDs and contact emails
   - Debug logs show found message IDs and contact phones

### Files Modified

| File | Changes |
|------|---------|
| `electron/services/autoLinkService.ts` | Fixed email query to use `communications` table; added `linkExistingCommunication()` helper; added debug logging |
| `electron/services/__tests__/autoLinkService.test.ts` | Updated tests to reflect new behavior (emails use `dbRun` for UPDATE, not `createCommunicationReference`) |

### Tests Added/Updated

- Updated existing tests to verify emails are linked via `dbRun` (UPDATE) instead of `createCommunicationReference`
- Updated mock to handle the new query pattern (`FROM communications` with `communication_type = 'email'`)
- Updated "already linked" test to use new mock behavior
- All 10 tests pass

### Manual Testing Done

- Type-check passes
- All 558 auto-link and transaction tests pass
- Pre-existing lint error in unrelated file (ContactSelectModal.tsx - missing ESLint plugin)
- Pre-existing test failure in unrelated file (auth-handlers.test.ts - mock issue)

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1035 | Must complete before this (Phase 1) |
| TASK-1036 | Must complete before this (Phase 1) |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-214 | Auto-Link Not Working | Source backlog item |
| BACKLOG-207 | Original auto-link feature request | Original request |
| TASK-1031 | Auto-link implementation | May have regression |
| PR #407 | Auto-link PR | To review |

---

## User Verification

| Test | Result | Date |
|------|--------|------|
| Auto-link implementation | **PASS** | 2025-01-12 |
| Unlink/remove communications UI | **FAIL** | 2025-01-12 |

**Verified by:** User during SPRINT-034 testing session

**Issue Found:** When trying to remove/unlink a communication from a transaction, nothing happens in the UI. Backend logs show the operation succeeds, but UI doesn't refresh. See BACKLOG-220.

---

## Notes

- This may be the same root cause as TASK-1038 (contacts pre-population)
- If root cause is shared, consider combining fixes
- Add comprehensive logging to help debug future issues
