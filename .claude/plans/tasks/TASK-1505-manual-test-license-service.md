# Task TASK-1505: Manual Test License Service (USER GATE)

**Sprint**: SPRINT-062
**Backlog Item**: N/A (User validation task)
**Status**: Blocked (Waiting for TASK-1503, TASK-1504)
**Execution**: User (Phase 2 Gate)

---

## Purpose

This is a USER GATE task. The user must manually verify the license service works correctly before Phase 3 (integration) can begin.

---

## Prerequisites

Before testing, ensure:
- [ ] TASK-1503 (License Schema) is merged to `project/licensing-and-auth-flow`
- [ ] TASK-1504 (License Service) is merged to `project/licensing-and-auth-flow`
- [ ] Desktop app is running with new services
- [ ] Supabase dashboard accessible

---

## Test Checklist

### Test 1: Schema Verification (Supabase Dashboard)

**Steps:**
1. Open Supabase Dashboard
2. Go to Table Editor
3. Check for `user_licenses` table
4. Check for `device_registrations` table

**Expected:**
- [ ] `user_licenses` table exists with all columns
- [ ] `device_registrations` table exists with all columns
- [ ] RLS is enabled on both tables

### Test 2: New User License Creation

**Steps:**
1. Create a new test user in Supabase Auth (or use new email)
2. Start desktop app and log in as new user
3. Check Supabase `user_licenses` table

**Expected:**
- [ ] New row created in `user_licenses` for the user
- [ ] `license_type` = 'trial'
- [ ] `trial_status` = 'active'
- [ ] `transaction_count` = 0
- [ ] `trial_expires_at` is ~14 days from now

### Test 3: Device Registration

**Steps:**
1. With the test user logged in
2. Check Supabase `device_registrations` table

**Expected:**
- [ ] New row created for the device
- [ ] `device_id` is populated
- [ ] `platform` matches OS (macos/windows)
- [ ] `is_active` = true

### Test 4: Transaction Count Increment

**Steps:**
1. Create a new transaction in the app
2. Check `user_licenses` table in Supabase

**Expected:**
- [ ] `transaction_count` increased by 1

### Test 5: License Validation Response

**Steps:**
1. In app, trigger license validation (may need dev tools)
2. Or check console logs for license status

**Expected:**
- [ ] License status shows `isValid: true`
- [ ] `canCreateTransaction: true` (if under limit)
- [ ] `trialDaysRemaining` is approximately correct

### Test 6: Device Limit Enforcement

**Steps:**
1. Keep test user logged in on current device
2. Try to log in as same user on different device (or simulate)
3. Check if device limit error occurs

**Expected:**
- [ ] Second device registration should fail with "Device limit reached"
- [ ] (For trial user with 1 device limit)

### Test 7: Offline Grace Period

**Steps:**
1. Ensure license is validated (cached)
2. Disconnect from network
3. Restart app
4. Check if app allows access

**Expected:**
- [ ] App should allow access (within 24-hour grace period)
- [ ] Console may show "using cached license"

### Test 8: RLS Policy Test

**Steps:**
1. In Supabase SQL Editor, run as authenticated user:
   ```sql
   SELECT * FROM user_licenses WHERE user_id = 'other-user-id';
   ```

**Expected:**
- [ ] Query returns no rows (RLS blocks access to other users' data)

---

## Pass / Fail Criteria

**Phase 2 PASSES if:**
- [ ] All 8 tests above pass
- [ ] Schema is correctly set up
- [ ] License creation works for new users
- [ ] Device registration respects limits
- [ ] Offline mode works within grace period

**Phase 2 FAILS if:**
- [ ] Schema tables missing or incorrect
- [ ] License not created for new users
- [ ] Device limit not enforced
- [ ] App crashes when offline

---

## Cleanup After Testing

After testing, clean up test data:

```sql
-- In Supabase SQL Editor (as admin)
-- Delete test user's license and devices
DELETE FROM device_registrations WHERE user_id = 'test-user-id';
DELETE FROM user_licenses WHERE user_id = 'test-user-id';
```

---

## Notes for User

- The license service talks to Supabase, so network is required for initial validation
- Device ID is generated from machine hardware, should be consistent
- Trial expires 14 days from creation, not from first use
- Transaction count is total lifetime, not per-period

---

## Sign-Off

**Date**: _______________
**Tested By**: _______________
**Result**: [ ] PASS / [ ] FAIL

**Issues Found:**
- (List any issues here)

**Decision:**
- [ ] Proceed to Phase 3
- [ ] Fix issues and re-test
