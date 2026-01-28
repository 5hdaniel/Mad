# Task TASK-1604: Manual Test Reordered Flow (USER GATE)

---

## WORKFLOW REQUIREMENT

**This is a USER GATE task - requires manual user testing.**

This task is NOT implemented by an engineer agent. Instead:

1. PM notifies user that Phase 1 is ready for testing
2. User performs manual testing on their machine
3. User reports pass/fail with notes
4. PM updates this task with results

---

## Goal

Validate that the reordered onboarding flow works correctly on both macOS and Windows, with no "Database not initialized" errors.

## Prerequisites

Before testing, these tasks MUST be completed and merged:
- [ ] TASK-1600: Store Phone Type in Supabase
- [ ] TASK-1601: Reorder macOS Flow Steps
- [ ] TASK-1602: Reorder Windows Flow Steps
- [ ] TASK-1603: Remove Pending Email State

## Test Environment

**macOS Testing:**
- [ ] Fresh install (delete app data to simulate new user)
- [ ] Test with iPhone selection
- [ ] Test with Android selection

**Windows Testing (if available):**
- [ ] Fresh install
- [ ] Test with iPhone selection (driver step)
- [ ] Test with Android selection (skip driver)

## Test Scenarios

### Scenario 1: macOS New User - iPhone

1. Delete app data to simulate fresh install
2. Open app, complete browser login
3. **Phone Type Step**: Select iPhone
   - [ ] Phone type saved without "Database not initialized" error
   - [ ] Proceeds to next step
4. **Secure Storage Step**: See Keychain explanation
   - [ ] Keychain access granted
   - [ ] DB initializes successfully
5. **Permissions Step**: Full Disk Access
   - [ ] FDA granted (or skipped if already granted)
6. **Email Connect Step**: Connect Google or Microsoft
   - [ ] OAuth flow opens in browser
   - [ ] Returns to app with email connected
   - [ ] No "Database not initialized" error
7. **Dashboard**: App ready
   - [ ] Dashboard loads
   - [ ] Email shows as connected

**Result:** PASS / FAIL

**Notes:**
```
<User enters testing notes here>
```

### Scenario 2: macOS New User - Android

1. Delete app data to simulate fresh install
2. Open app, complete browser login
3. **Phone Type Step**: Select Android
   - [ ] Phone type saved without error
   - [ ] Proceeds to next step
4. **Secure Storage Step**: See Keychain explanation
   - [ ] Keychain access granted
   - [ ] DB initializes successfully
5. **Permissions Step**: Full Disk Access
   - [ ] FDA granted (or skipped)
6. **Email Connect Step**: Connect email
   - [ ] OAuth flow works
   - [ ] No errors
7. **Dashboard**: App ready

**Result:** PASS / FAIL

**Notes:**
```
<User enters testing notes here>
```

### Scenario 3: Windows New User - iPhone (if testable)

1. Fresh install on Windows
2. Complete browser login
3. **Phone Type Step**: Select iPhone
   - [ ] Saved without error
4. **Apple Driver Step**: Shows driver installation
   - [ ] Step displays correctly
   - [ ] DB initializes
5. **Email Connect Step**: Connect email
   - [ ] OAuth works
   - [ ] No "Database not initialized" error
6. **Dashboard**: Ready

**Result:** PASS / FAIL / NOT TESTED

**Notes:**
```
<User enters testing notes here>
```

### Scenario 4: Windows New User - Android (if testable)

1. Fresh install on Windows
2. Complete browser login
3. **Phone Type Step**: Select Android
   - [ ] Saved without error
4. **Apple Driver Step**: Should be SKIPPED for Android
   - [ ] Step skipped automatically
5. **Email Connect Step**: Connect email
   - [ ] OAuth works
   - [ ] No errors
6. **Dashboard**: Ready

**Result:** PASS / FAIL / NOT TESTED

**Notes:**
```
<User enters testing notes here>
```

### Scenario 5: Returning User (existing data)

1. Use existing user account (don't delete data)
2. Re-open app or re-authenticate
3. **Verify:**
   - [ ] Phone type loaded from Supabase
   - [ ] Dashboard loads directly (no re-onboarding)
   - [ ] Email still connected

**Result:** PASS / FAIL

**Notes:**
```
<User enters testing notes here>
```

## Pass Criteria

**Phase 1 passes if:**
- [ ] All tested scenarios pass (mark NOT TESTED for unavailable platforms)
- [ ] No "Database not initialized" errors during onboarding
- [ ] Email OAuth completes successfully
- [ ] Phone type persists across sessions

## Fail Criteria

**Phase 1 fails if:**
- Any tested scenario fails
- "Database not initialized" errors occur
- Email OAuth fails with DB-related errors
- Phone type lost between sessions

## Reporting

### Test Date: ________

### Tested By: ________

### Overall Result: PASS / FAIL

### Summary:

| Scenario | Result | Notes |
|----------|--------|-------|
| macOS iPhone | | |
| macOS Android | | |
| Windows iPhone | | |
| Windows Android | | |
| Returning User | | |

### Issues Found:

```
<List any issues discovered during testing>
```

### Recommendations:

```
<Any recommendations before proceeding to Phase 2>
```

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-28
**Reviewer:** SR Engineer

### Architecture Validation

**APPROVED** - This is a USER GATE task, not an implementation task.

### Technical Verification Checklist for PM

Before notifying user for testing, PM should verify:

- [ ] TASK-1600 PR merged and verified (phone type Supabase storage)
- [ ] TASK-1601 PR merged and verified (macOS flow reorder)
- [ ] TASK-1602 PR merged and verified (Windows flow reorder)
- [ ] TASK-1603 PR merged and verified (pending email state removed)
- [ ] `npm run build` succeeds on develop branch
- [ ] App launches without errors

### Expected Flow Order After All Tasks Complete

**macOS:**
1. Phone Type Selection (Supabase save, no DB required)
2. Secure Storage (Keychain explanation, DB init)
3. Permissions (Full Disk Access)
4. Email Connect (DB ready, clean OAuth)

**Windows iPhone:**
1. Phone Type Selection (Supabase save)
2. Apple Driver (DB init)
3. Email Connect (DB ready)

**Windows Android:**
1. Phone Type Selection (Supabase save)
2. ~~Apple Driver~~ (skipped)
3. Email Connect (DB ready)

### Key Regression Checks

The user should specifically look for:

1. **NO "Database not initialized" errors** in console during onboarding
2. **Phone type persists** across app restart (from Supabase)
3. **Email OAuth completes** without fallback to pending API
4. **Console logs show** `window.api.auth.googleConnectMailbox` (not `Pending` variant)

### Status: APPROVED

This USER GATE is properly structured. User testing should proceed after all prerequisite tasks are merged.

---

## PM Notes

**Gate Status:** PENDING / PASSED / FAILED

**Date Tested:** <DATE>

**Decision:**
- [ ] Proceed to Phase 2
- [ ] Fix issues first (create new tasks)
- [ ] Reassess Phase 1 scope

**Follow-up Tasks Created:**
- <List any bug fix tasks if needed>
