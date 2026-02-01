# Task TASK-1508: Manual Test Full Flow (USER GATE)

**Sprint**: SPRINT-062
**Backlog Item**: N/A (User validation task)
**Status**: Blocked (Waiting for TASK-1506, TASK-1507)
**Execution**: User (Phase 3 Gate)

---

## Purpose

This is a USER GATE task. The user must manually verify the complete auth + licensing flow works end-to-end before final SR review.

---

## Prerequisites

Before testing, ensure:
- [ ] All Phase 1 tasks merged (TASK-1500, TASK-1501)
- [ ] All Phase 2 tasks merged (TASK-1503, TASK-1504)
- [ ] All Phase 3 tasks merged (TASK-1506, TASK-1507)
- [ ] Desktop app built with all changes
- [ ] Browser auth page deployed (or running locally)
- [ ] Supabase database has license tables

---

## Test Scenarios

### Scenario 1: New User - Complete Flow

**Setup:**
- Create new test email (or use email not in system)

**Steps:**
1. Start desktop app
2. Click "Sign In with Browser"
3. Complete OAuth with test email
4. Observe app behavior

**Expected Results:**
- [ ] Browser opens to auth page
- [ ] OAuth completes successfully
- [ ] Browser redirects to `magicaudit://callback`
- [ ] Desktop app receives callback
- [ ] Trial license created in Supabase
- [ ] Device registered in Supabase
- [ ] App shows main dashboard
- [ ] Trial banner shows "14 days remaining" (approximately)

### Scenario 2: Returning User - Valid License

**Setup:**
- Use same test account from Scenario 1

**Steps:**
1. Quit and restart desktop app
2. Sign in again

**Expected Results:**
- [ ] Auth flow completes
- [ ] Existing license used (not new one created)
- [ ] Device re-registered (or existing one updated)
- [ ] App shows main dashboard
- [ ] Trial banner still shows correct days

### Scenario 3: Expired Trial User

**Setup:**
- In Supabase, update test user:
  ```sql
  UPDATE user_licenses
  SET trial_expires_at = now() - INTERVAL '1 day'
  WHERE user_id = 'test-user-id';
  ```

**Steps:**
1. Sign out of app (if logged in)
2. Sign in again

**Expected Results:**
- [ ] Auth completes (tokens received)
- [ ] License validation fails
- [ ] Upgrade screen appears
- [ ] Cannot access main app
- [ ] "Upgrade Now" button opens pricing page
- [ ] "Sign Out" button works

### Scenario 4: Transaction Limit Reached

**Setup:**
- Reset trial expiry to future
- Set transaction count to 5:
  ```sql
  UPDATE user_licenses
  SET trial_expires_at = now() + INTERVAL '14 days',
      transaction_count = 5
  WHERE user_id = 'test-user-id';
  ```

**Steps:**
1. Sign in
2. Try to create a new transaction

**Expected Results:**
- [ ] Can sign in and see main app
- [ ] Cannot create new transaction
- [ ] Appropriate message shown when limit reached
- [ ] Upgrade prompt available

### Scenario 5: Device Limit Reached

**Setup:**
- Ensure test user has 1 device registered and active
- Use different computer OR simulate by changing device ID

**Steps:**
1. Try to sign in from "new device"

**Expected Results:**
- [ ] Auth completes (tokens received)
- [ ] Device registration fails
- [ ] Device limit screen appears
- [ ] Can see list of registered devices
- [ ] Can deactivate a device
- [ ] After deactivating, can access app

### Scenario 6: Offline Grace Period

**Setup:**
- Sign in while online (to cache license)
- Disconnect from network

**Steps:**
1. Quit app
2. Disconnect network
3. Restart app

**Expected Results:**
- [ ] App allows access (within 24 hours)
- [ ] May show "offline" indicator
- [ ] License operations that require network fail gracefully

### Scenario 7: OAuth Error Handling

**Setup:**
- Normal app state

**Steps:**
1. Click "Sign In with Browser"
2. In browser, cancel OAuth (close tab, or click cancel)
3. Or use invalid credentials

**Expected Results:**
- [ ] App shows "waiting for sign in" state
- [ ] If cancelled, app allows retry (or times out gracefully)
- [ ] If error from OAuth, shows error message
- [ ] Can click "Try Again"

### Scenario 8: Cold Start Deep Link

**Setup:**
- Quit desktop app completely
- Have a valid auth URL ready

**Steps:**
1. Ensure app is not running
2. Open terminal and run:
   ```bash
   open "magicaudit://callback?access_token=VALID_TOKEN&refresh_token=VALID_REFRESH"
   ```
   (Use actual tokens from a browser auth session)

**Expected Results:**
- [ ] App launches
- [ ] Processes the callback
- [ ] Validates license
- [ ] Shows main app (or appropriate blocked screen)

---

## Performance Checks

### Auth Flow Speed
- [ ] Browser opens within 1 second of clicking button
- [ ] After OAuth, redirect to desktop is near-instant
- [ ] License validation takes < 2 seconds
- [ ] Total time from click to dashboard < 10 seconds (excluding OAuth time)

### License Check Speed
- [ ] App startup license check < 2 seconds (online)
- [ ] Cached license check < 100ms (offline)

---

## Edge Cases

### Test if needed:
- [ ] Sign in with Google
- [ ] Sign in with Microsoft
- [ ] Switch accounts (sign out, sign in as different user)
- [ ] Network disconnects during auth callback
- [ ] Multiple rapid sign-in attempts

---

## Pass / Fail Criteria

**Sprint PASSES if:**
- [ ] All 8 scenarios pass
- [ ] No crashes or hangs
- [ ] Error states are recoverable
- [ ] Performance is acceptable

**Sprint FAILS if:**
- [ ] Auth flow doesn't complete
- [ ] License validation doesn't work
- [ ] Invalid licenses can access app
- [ ] App crashes in any scenario
- [ ] User gets stuck with no way to proceed

---

## Known Limitations (Not Bugs)

Document any expected limitations:
- Windows testing may require separate verification
- Offline mode only works if previously authenticated
- Trial limit is lifetime, not per-period

---

## Cleanup After Testing

```sql
-- Reset test user for future testing
UPDATE user_licenses
SET trial_expires_at = now() + INTERVAL '14 days',
    transaction_count = 0,
    trial_status = 'active'
WHERE user_id = 'test-user-id';

-- Or delete test user entirely
DELETE FROM device_registrations WHERE user_id = 'test-user-id';
DELETE FROM user_licenses WHERE user_id = 'test-user-id';
-- Then delete from auth.users in Supabase dashboard
```

---

## Sign-Off

**Date**: _______________
**Tested By**: _______________
**Environment**: macOS / Windows (circle one)
**Browser**: Chrome / Safari / Firefox / Edge (circle one)

**Result**: [ ] PASS / [ ] FAIL

**Issues Found:**
1. _______________
2. _______________
3. _______________

**Severity of Issues:**
- [ ] Blocking (cannot proceed to SR review)
- [ ] Non-blocking (can proceed, issues tracked for follow-up)

**Decision:**
- [ ] Proceed to TASK-1509 (SR Engineer Review)
- [ ] Fix issues and re-test
- [ ] Descope features for this sprint

---

## Notes for SR Engineer

*Document anything the SR Engineer should pay special attention to during review:*

- _______________
- _______________
