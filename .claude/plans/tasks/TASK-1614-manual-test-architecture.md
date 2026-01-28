# Task TASK-1614: Manual Test Architecture (USER GATE)

---

## WORKFLOW REQUIREMENT

**This is a USER GATE task - requires manual user testing.**

This task does NOT require engineer agent implementation. The user will manually test the refactored architecture.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

User validates that the Phase 2 architecture refactor (service layer, hooks migration, dead code removal) works correctly without regressions.

## Test Scenarios

### 1. New User Onboarding (macOS)

| Step | Expected Result | Pass? |
|------|-----------------|-------|
| Launch app (fresh install) | Login screen appears | [ ] |
| Click login | Browser opens for Supabase auth | [ ] |
| Complete login | App receives auth, shows phone type | [ ] |
| Select iPhone | Phone type saved (check logs for service call) | [ ] |
| Continue | Keychain/secure storage step | [ ] |
| Enable keychain | Database initializes (check logs) | [ ] |
| Continue | FDA permissions step | [ ] |
| Skip or enable FDA | Permissions checked | [ ] |
| Continue | Email connection step | [ ] |
| Connect Gmail | OAuth flow completes | [ ] |
| Email connected | Dashboard loads | [ ] |

### 2. New User Onboarding (Windows)

| Step | Expected Result | Pass? |
|------|-----------------|-------|
| Launch app (fresh install) | Login screen appears | [ ] |
| Click login | Browser opens for Supabase auth | [ ] |
| Complete login | App receives auth, shows phone type | [ ] |
| Select iPhone | Phone type saved | [ ] |
| Continue | Apple driver step | [ ] |
| Install/skip driver | Continues to email step | [ ] |
| Connect Outlook | OAuth flow completes | [ ] |
| Email connected | Dashboard loads | [ ] |

### 3. Returning User Flow

| Step | Expected Result | Pass? |
|------|-----------------|-------|
| Launch app (existing user) | Login screen appears | [ ] |
| Click login | Browser opens | [ ] |
| Complete login | App recognizes returning user | [ ] |
| Skip onboarding | Dashboard loads directly | [ ] |
| Existing email shown | Previously connected email visible | [ ] |
| Phone type preserved | Settings show correct phone type | [ ] |

### 4. Service Layer Verification

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Services used in contexts | AuthContext, ContactsContext, LicenseContext use service imports | [ ] |
| Services used in hooks | Migrated hooks use service imports instead of window.api | [ ] |
| Type checking passes | `npm run type-check` has no errors | [ ] |
| No runtime errors | No undefined method errors from services | [ ] |

### 5. Error Handling

| Scenario | Expected Behavior | Pass? |
|----------|-------------------|-------|
| Network offline during login | Graceful error message | [ ] |
| OAuth cancelled by user | Returns to email step, can retry | [ ] |
| Database init fails | Error shown, can retry | [ ] |

### 6. No Regressions

| Feature | Still Works? | Pass? |
|---------|--------------|-------|
| Transaction list loads | [ ] | |
| Email sync triggers | [ ] | |
| Contact lookup works | [ ] | |
| Settings accessible | [ ] | |
| Logout works | [ ] | |

## Code Verification

Verify service layer migration with grep:

### Expected (After Migration)
```bash
# Should find NO direct window.api calls in contexts
grep -r "window.api" src/contexts/AuthContext.tsx
grep -r "window.api" src/contexts/ContactsContext.tsx
grep -r "window.api" src/contexts/LicenseContext.tsx

# Should find service imports instead
grep -r "authService\|contactService\|licenseService" src/contexts/
```

### NOT Expected
```bash
# If these return results, migration is incomplete
grep -r "window.api.auth" src/contexts/AuthContext.tsx
grep -r "window.api.contacts" src/contexts/ContactsContext.tsx
grep -r "window.api.license" src/contexts/LicenseContext.tsx
```

## Pass Criteria

**Phase 2 passes if ALL of the following are true:**

- [ ] New user onboarding completes successfully (macOS)
- [ ] New user onboarding completes successfully (Windows) - or N/A if no Windows machine
- [ ] Returning user flow works correctly
- [ ] Service layer logs appear in console
- [ ] No errors related to ServiceProvider
- [ ] No regressions in existing features
- [ ] All error scenarios handled gracefully

## Fail Criteria

**Phase 2 fails if ANY of the following:**

- [ ] Onboarding flow breaks at any step
- [ ] Service methods throw unhandled exceptions
- [ ] Type errors remain after migration
- [ ] Returning users can't access their data
- [ ] Email connection fails with service-related errors
- [ ] Dashboard doesn't load after onboarding

## User Decision

After testing, user should:

1. **PASS**: All criteria met, Phase 2 complete
2. **CONDITIONAL PASS**: Minor issues noted, OK to proceed with fixes tracked
3. **FAIL**: Critical issues, must address before continuing

---

## PM Estimate (PM-Owned)

**Category:** `user-gate`

**Estimated Tokens:** ~5K (PM creates task, minimal agent involvement)

**Token Cap:** N/A (user-driven task)

---

## Test Results (User-Owned)

*Tested: <DATE>*
*Tester: <USER NAME>*
*Platform: macOS / Windows / Both*

### Test Summary

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| New User macOS | /11 | | |
| New User Windows | /8 | | N/A if not tested |
| Returning User | /6 | | |
| Service Layer | /4 | | |
| Error Handling | /3 | | |
| No Regressions | /5 | | |

### Issues Found

| Issue | Severity | Description |
|-------|----------|-------------|
| | | |

### Decision

- [ ] **PASS** - Phase 2 complete, proceed to Phase 3
- [ ] **CONDITIONAL PASS** - Proceed with tracked fixes
- [ ] **FAIL** - Must address issues before proceeding

### Notes

<User observations, suggestions, concerns>

---

## PM Notes

### Gate Status

- **Status:** READY FOR USER TESTING
- **Date Ready:** 2026-01-28
- **Blocker Cleared:** TASK-1613 (PR #663 merged)

### Prerequisites Complete

All Phase 2 tasks are now complete:
- [x] TASK-1610 - Service Layer Interface (PR #660)
- [x] TASK-1611 - Implement Electron Services (PR #661)
- [x] TASK-1612 - Migrate State Hooks to Services (PR #662)
- [x] TASK-1613 - Remove Dead Onboarding Code (PR #663)

### Gate Result

- **Status:** PENDING USER TESTING
- **Date:** -
- **Issues to Track:** -

### Next Steps

1. User performs manual testing per the test scenarios above
2. If PASS: Phase 2 complete, proceed to Phase 3 (deferred SPRINT-062 tasks)
3. If FAIL: Document issues and address before proceeding
