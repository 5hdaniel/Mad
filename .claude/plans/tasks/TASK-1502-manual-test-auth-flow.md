# Task TASK-1502: Manual Test Auth Flow (USER GATE)

**Sprint**: SPRINT-062
**Backlog Item**: N/A (User validation task)
**Status**: Blocked (Waiting for TASK-1500, TASK-1501)
**Execution**: User (Phase 1 Gate)

---

## Purpose

This is a USER GATE task. The user must manually verify the auth flow works end-to-end before Phase 2 can begin.

---

## Prerequisites

Before testing, ensure:
- [ ] TASK-1500 (Deep Link Handler) is merged to `project/licensing-and-auth-flow`
- [ ] TASK-1501 (Browser Auth Landing Page) is merged to `project/licensing-and-auth-flow`
- [ ] Desktop app is built with deep link support
- [ ] Browser auth page is deployed (or running locally)

---

## Test Checklist

### Test 1: Deep Link Registration (macOS)

**Steps:**
1. Build the desktop app: `npm run build`
2. Open Terminal
3. Run: `open "magicaudit://callback?access_token=test&refresh_token=test"`

**Expected:**
- [ ] Magic Audit app opens (or focuses if already open)
- [ ] App shows some indication it received the callback

### Test 2: Deep Link Cold Start (macOS)

**Steps:**
1. Quit Magic Audit completely
2. Run: `open "magicaudit://callback?access_token=test&refresh_token=test"`

**Expected:**
- [ ] Magic Audit app launches
- [ ] App receives the tokens after launch

### Test 3: Full Auth Flow (Google)

**Steps:**
1. Start desktop app in dev mode: `npm run dev`
2. Open browser to auth page: `http://localhost:3000/auth/desktop`
3. Click "Continue with Google"
4. Complete Google OAuth
5. Observe redirect back to desktop

**Expected:**
- [ ] Google OAuth completes successfully
- [ ] Browser shows "Opening Magic Audit..." status
- [ ] Desktop app opens/focuses
- [ ] Desktop app shows authenticated state (or at least receives tokens)

### Test 4: Full Auth Flow (Microsoft)

**Steps:**
1. Same as Test 3, but click "Continue with Microsoft"

**Expected:**
- [ ] Microsoft OAuth completes successfully
- [ ] Same redirect behavior as Google

### Test 5: Fallback Link

**Steps:**
1. During callback, if auto-redirect didn't work immediately
2. Click the "Open Magic Audit" manual link

**Expected:**
- [ ] Manual link triggers deep link
- [ ] Desktop app receives tokens

### Test 6: Error Handling

**Steps:**
1. Navigate directly to `/auth/desktop/callback` without completing OAuth
2. Observe error handling

**Expected:**
- [ ] Error message displayed
- [ ] "Try Again" link works

---

## Pass / Fail Criteria

**Phase 1 PASSES if:**
- [ ] All 6 tests above pass
- [ ] Both Google and Microsoft OAuth work
- [ ] Deep link works for both warm start and cold start
- [ ] Error states are handled gracefully

**Phase 1 FAILS if:**
- [ ] Deep link doesn't register (app doesn't open)
- [ ] OAuth flow breaks
- [ ] Tokens don't reach desktop app
- [ ] Critical error states crash instead of showing message

---

## Notes for User

- If testing on Windows, use `start magicaudit://callback?...` instead of `open`
- The auth page may be at a different URL if deployed (check with PM)
- If Supabase OAuth is not configured, OAuth tests will fail - this is expected and needs config fix

---

## Sign-Off

**Date**: _______________
**Tested By**: _______________
**Result**: [ ] PASS / [ ] FAIL

**Issues Found:**
- (List any issues here)

**Decision:**
- [ ] Proceed to Phase 2
- [ ] Fix issues and re-test
