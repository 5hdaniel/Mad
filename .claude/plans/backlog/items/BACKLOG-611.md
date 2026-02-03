# BACKLOG-611: New users skip keychain setup on machines with previous installs

**Category:** bug
**Priority:** critical
**Status:** pending
**Created:** 2026-02-03

## Problem

When a new user logs into Magic Audit on a Mac that previously had the app installed (by a different user or previous account), the app skips critical onboarding steps:

1. **Keychain/Secure Storage setup** - Creates local encrypted database
2. **Full Disk Access permissions** - Grants access to iMessage/Contacts

This happens because the "don't show keychain explanation again" preference is stored at the **machine level** (electron-store or similar), not per-user.

## Symptoms

- User logs in successfully (Supabase auth works)
- T&C acceptance works (writes to Supabase)
- App goes directly to dashboard or email connection
- All operations fail with "No valid user found in database":
  - Contacts sync fails
  - Messages sync fails
  - Email connection fails
  - Any DB operation fails

## Console Errors

```
[SyncOrchestrator] contacts sync failed: Error: No valid user found in database
[SyncOrchestrator] messages sync failed: Error: No valid user found in database
[useEmailHandlers] Failed to start Microsoft OAuth: No user found in database. Please log in first.
```

## Root Cause

The onboarding flow uses machine-level flags to determine which steps to show:
- `skipKeychainExplanation` - Stored in electron-store (machine-wide)
- Previous user set this to `true`
- New user inherits this setting
- Keychain step is skipped → DB never initialized → User never created

## Affected Flow

```
Expected (new user):
Login → T&C → Phone Type → Keychain Setup → Permissions → Email → Dashboard

Actual (new user on machine with previous install):
Login → T&C → Phone Type → [SKIP] → [SKIP] → Email (FAILS) → Stuck
```

## Proposed Fixes

### Option 1: Per-User Preferences (Best)
Store skip preferences with user ID:
```typescript
// Instead of:
store.get('skipKeychainExplanation')

// Use:
store.get(`users.${userId}.skipKeychainExplanation`)
```

### Option 2: Always Check Local DB (Simpler)
Before skipping any onboarding step, verify user exists in local DB:
```typescript
// In navigation/step logic:
if (skipKeychainExplanation && !userExistsInLocalDB(currentUserId)) {
  // Force keychain step even if preference says skip
  showKeychainStep = true;
}
```

### Option 3: Detect Fresh Account
Check if this Supabase user has ever used this machine:
```typescript
// Store machine-user mapping
const machineUsers = store.get('machineUsers') || [];
if (!machineUsers.includes(currentUserId)) {
  // New user on this machine - show all onboarding
  forceFullOnboarding = true;
}
```

## Recommended Fix

**Option 2** is simplest and most robust:
- Check `isDatabaseInitialized` AND `userExistsInLocalDB(currentUserId)`
- If either is false, show keychain step regardless of skip preference
- This catches all edge cases (fresh install, new user, corrupted DB)

## Acceptance Criteria

- [ ] New user on machine with previous install sees keychain setup
- [ ] New user on machine with previous install sees permissions step
- [ ] Local DB is created with user record
- [ ] Sync operations work after completing onboarding
- [ ] Returning user who already completed setup still skips as expected

## Testing

1. Install app, complete onboarding as User A
2. Log out
3. Create new Supabase account (User B)
4. Log in as User B
5. **Expected:** See keychain and permissions steps
6. **Actual (bug):** Skips to email/dashboard, everything fails

## Related

- BACKLOG-610: Update notification visibility (same release)
- Keychain explanation skip preference
- useSecureStorage hook
- useNavigationFlow step derivation
