# TASK-1039: Fix Email Onboarding State Mismatch

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1039 |
| **Sprint** | SPRINT-034 |
| **Backlog Item** | BACKLOG-211 |
| **Priority** | HIGH |
| **Phase** | 2 |
| **Estimated Tokens** | ~35K |
| **Token Cap** | 140K |

---

## Problem Statement

When a user has a valid mailbox token but the `email_onboarding_completed` database flag is `false`, the app shows confusing/inconsistent UI:

| Component | Shows | Issue |
|-----------|-------|-------|
| Dashboard AIStatusCard | "All Caught Up" | Misleading - no emails being scanned |
| Settings | "Connected" | Correct - token exists |
| Backend | Onboarding incomplete | Only checks token IF flag is already true |

---

## Root Cause

In `electron/handlers/sessionHandlers.ts` line ~289:

```typescript
if (onboardingCompleted) {  // <-- Only checks for token IF this flag is true
  const googleToken = await databaseService.getOAuthToken(...);
```

This creates a state where:
1. User connected mailbox and token was saved
2. But `email_onboarding_completed` flag was not set (race condition, error, or flow issue)
3. App thinks onboarding is incomplete, so it doesn't scan for emails
4. User sees "All Caught Up" with no indication they need to reconnect

---

## Current Flow (Broken)

```
User connects mailbox
    |
    v
Token saved to database
    |
    v
email_onboarding_completed flag NOT SET (bug)
    |
    v
handleCheckEmailOnboarding called
    |
    v
if (onboardingCompleted) { ... }  <- FALSE, so token never checked
    |
    v
Returns completed: false
    |
    v
Dashboard shows "All Caught Up" (pendingCount === 0)
    |
    v
User confused - Settings says Connected, no emails showing
```

---

## Proposed Fix

### Option A: Backend-First (Recommended)

1. Modify `handleCheckEmailOnboarding` to check for valid token regardless of flag
2. If token exists and is valid, return `completed: true`
3. Also update the flag for consistency

```typescript
// sessionHandlers.ts
async function handleCheckEmailOnboarding() {
  // Check for token FIRST, regardless of flag
  const googleToken = await databaseService.getOAuthToken(userId, 'google');
  const microsoftToken = await databaseService.getOAuthToken(userId, 'microsoft');

  const hasValidToken = googleToken || microsoftToken;

  if (hasValidToken) {
    // Token exists - consider onboarding complete
    // Also fix the flag if it's inconsistent
    const currentFlag = await databaseService.getUserSetting('email_onboarding_completed');
    if (!currentFlag) {
      await databaseService.setUserSetting('email_onboarding_completed', 'true');
      logger.info('Fixed inconsistent email_onboarding_completed flag');
    }
    return { completed: true };
  }

  return { completed: false };
}
```

### Option B: Frontend-Aware

1. Add mailbox connection status to Dashboard state
2. Pass to AIStatusCard
3. Show "Connect your email" if not connected

```typescript
// Dashboard.tsx
const { isMailboxConnected } = useMailboxStatus();

// AIStatusCard.tsx
if (!isMailboxConnected) {
  return <ConnectEmailPrompt />;
}
if (pendingCount === 0) {
  return <AllCaughtUp />;
}
```

### Option C: Hybrid (Most Robust) - RECOMMENDED

Combine both approaches:
1. Backend fix (Option A) - source of truth
2. Plus defensive UI check in AIStatusCard

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/handlers/sessionHandlers.ts` | Check token before checking flag |
| `src/components/dashboard/AIStatusCard.tsx` | Add mailbox connection awareness |
| `src/components/Dashboard.tsx` | Pass mailbox status to AIStatusCard |
| `electron/services/db/databaseService.ts` | No changes expected |

---

## Additional Investigation

### When is `email_onboarding_completed` set?

Find all places that update this flag:

```bash
grep -r "email_onboarding_completed" --include="*.ts"
```

### Potential Race Condition

Check if there's a timing issue where:
1. OAuth flow completes
2. Token is saved
3. UI navigates away before flag update completes
4. Flag update fails silently

---

## Acceptance Criteria

- [ ] `handleCheckEmailOnboarding` returns `completed: true` if valid mailbox token exists (regardless of flag)
- [ ] If no valid mailbox token exists, Dashboard shows appropriate prompt (not "All Caught Up")
- [ ] "All Caught Up" only displays when mailbox is connected AND no pending items
- [ ] Settings and Dashboard states are consistent
- [ ] Inconsistent flag state is auto-corrected
- [ ] Root cause of flag not being set is documented

---

## Testing Requirements

### Unit Tests

```typescript
describe('handleCheckEmailOnboarding', () => {
  it('returns completed: true if Google token exists', () => {});
  it('returns completed: true if Microsoft token exists', () => {});
  it('returns completed: false if no token exists', () => {});
  it('fixes flag if token exists but flag is false', () => {});
  it('handles expired tokens appropriately', () => {});
});
```

### Integration Tests

| Scenario | Expected |
|----------|----------|
| Token exists, flag false | Returns completed: true, fixes flag |
| Token expired, flag true | Handles gracefully |
| No token, flag false | Returns completed: false |
| No token, flag true | Returns completed: false, fixes flag |

### Manual Testing

1. Clear `email_onboarding_completed` flag in database
2. Keep valid token
3. Open app
4. Verify Dashboard does NOT show "All Caught Up" incorrectly
5. Verify appropriate prompt shown OR emails are scanned

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1039-email-onboarding-state

---

## Implementation Summary

### Root Cause Found
The `handleCheckEmailOnboarding` function in `sessionHandlers.ts` only checked for valid mailbox tokens IF the `email_onboarding_completed` flag was already true. This created a chicken-and-egg problem where:
1. User connected mailbox and token was saved
2. But flag wasn't set due to race condition, error, or interrupted flow
3. On next app load, handler sees `flag=false`, skips token check
4. Returns `completed=false` even though token exists
5. Dashboard shows "All Caught Up" (misleading - no emails being scanned)

### Changes Made
1. **Token-first logic**: Modified `handleCheckEmailOnboarding` to check for valid mailbox tokens FIRST, regardless of the flag. Token is now the source of truth.
2. **Auto-correction**: When token exists but flag is false, automatically correct the flag by calling `completeEmailOnboarding()`.
3. **Improved logging**: Added distinct log messages for different inconsistent states:
   - "Auto-correcting inconsistent email onboarding state: token exists but flag was false"
   - "Email onboarding flag is true but no valid mailbox token found"

### Files Modified
- `electron/handlers/sessionHandlers.ts` - Core fix: token-first logic and auto-correction
- `electron/__tests__/auth-handlers.test.ts` - Updated tests and added new test cases:
  - Added `completeEmailOnboarding` to mock
  - Added `debug` to logService mock (pre-existing bug)
  - Fixed `initializeDatabase` test to expect `debug` instead of `info`
  - Added TASK-1039 specific tests for token-first logic and auto-correction

### Tests Added
- `should return completed=true and auto-correct flag when token exists but flag is false (TASK-1039)`
- `should check tokens before checking flag (TASK-1039)`
- Updated existing test expectations to reflect new behavior

### Manual Testing Done
- All auth-handlers tests pass (68 tests)
- Type check passes
- Lint passes for modified files

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
| BACKLOG-211 | Email Onboarding State Mismatch | Source backlog item |
| BACKLOG-139 | Database Init Gate | Similar state coordination pattern |

---

## User Verification

| Test | Result | Date |
|------|--------|------|
| Email status shows accurate state | **PASS** | 2025-01-12 |

**Verified by:** User during SPRINT-034 testing session

**Enhancement Request:** Add similar status indicator for text messages (iMessage import status). See BACKLOG-223.

---

## Notes

- This is a state synchronization bug, not a feature issue
- The fix should be defensive - handle inconsistent state gracefully
- Consider adding monitoring/logging for state inconsistencies
- Similar pattern to BACKLOG-139 (Database Init Gate) - may want to audit for other state mismatches
