# TASK-1507E: Fix Existing Users Missing Local SQLite User

**Sprint:** SPRINT-062
**Backlog Item:** Follow-up to TASK-1507D
**Priority:** P0 (Blocking user)
**Estimated Tokens:** ~30K
**Execution:** Sequential

---

## Context

After TASK-1507D was merged, the FK constraint failures are STILL happening for the user. Investigation revealed:

1. **TASK-1507D fix only works for NEW auth flows** - It creates the local SQLite user during deep link auth callback
2. **User authenticated BEFORE the fix was deployed** - Their local SQLite user was never created
3. **The fix does NOT retroactively create users** - Existing sessions have no local user

### Symptoms Reported

| Issue | Status | Notes |
|-------|--------|-------|
| Email connection: OAuth popup works | Broken | UI doesn't show "connected" state |
| Email connection: Red disconnect button | Missing | Never appears after OAuth |
| Messages import | FK failure | `FOREIGN KEY constraint failed` |
| Contacts import | FK failure | `FOREIGN KEY constraint failed` |
| Google Places API | Error | "No Google Maps API key configured" (separate issue) |

### User Environment

- Branch: `fix/task-1507d-local-sqlite-user` (has the fix commit)
- User ID (Supabase): `d5283d52-f612-4ab4-9e85-f3a5adc01bea`
- Authenticated via deep link BEFORE TASK-1507D fix was deployed

---

## Root Cause Analysis

### Primary Issue: No Retroactive User Creation

TASK-1507D handles creating users during auth, but doesn't handle:
1. **Existing sessions** - User already has valid Supabase session, won't re-authenticate
2. **App restart** - When app restarts with valid session, it doesn't re-run deep link flow
3. **Session restore** - `session:restore` path doesn't create local user

### Code Path Analysis

```
TASK-1507D Fix Location:
  electron/main.ts -> handleDeepLinkCallback() -> syncDeepLinkUserToLocalDb()

Problem: This only runs during deep link callback.

Existing User Flow (NOT FIXED):
  App Start -> session:restore -> (no local user creation) -> FAIL

Needed Fix Location:
  electron/handlers/sessionHandlers.ts -> session:restore handler
  OR
  electron/handlers/sharedAuthHandlers.ts -> session:get-current-user
```

### Secondary Issue: Google Places API

The "No Google Maps API key configured" error is **separate** from the FK constraint issue:

```typescript
// electron/services/addressVerificationService.ts:76
this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || null;
```

This is the same env var issue that TASK-1508B addresses for other env vars. However, TASK-1508B only fixes SUPABASE_URL. Google Maps API key is not embedded at build time.

---

## Investigation Tasks

### Task 1: Verify Root Cause

1. Check if user exists in local SQLite:
```sql
SELECT * FROM users WHERE email = '<user-email>';
SELECT * FROM users WHERE oauth_id = 'd5283d52-f612-4ab4-9e85-f3a5adc01bea';
```

2. If no user exists, that confirms the root cause

### Task 2: Identify Fix Location

The fix should be added to one of these locations (analyze which is best):

**Option A: session:restore handler**
- Location: `electron/handlers/sessionHandlers.ts`
- Pros: Runs on every app start with existing session
- Cons: May run before DB is initialized (need pending pattern)

**Option B: session:get-current-user handler**
- Location: `electron/handlers/sharedAuthHandlers.ts` or similar
- Pros: Runs when frontend requests user
- Cons: May be called multiple times

**Option C: AuthContext initialization**
- Location: Frontend `AuthContext.tsx`
- Pros: Runs after successful session validation
- Cons: Frontend can't create DB users directly

**Option D: Database initialization hook**
- Location: `electron/system-handlers.ts` (already has pending user pattern)
- Pros: Already handles pending users
- Cons: Need way to detect "user needs creation"

### Task 3: Implement Fix

Based on analysis, implement the fix that:
1. Detects when user has valid Supabase session but no local SQLite user
2. Creates the local user using data from Supabase session
3. Uses same field mapping as TASK-1507D (license type -> subscription tier, etc.)

---

## Proposed Solution

### Approach: Add user sync to session:restore

```typescript
// In session:restore handler (sessionHandlers.ts):

// After successful Supabase session restore...
if (session && session.user) {
  // Check if local user exists
  const localUser = await databaseService.getUserByEmail(session.user.email);

  if (!localUser) {
    // Create local user from Supabase session (same pattern as TASK-1507D)
    await databaseService.createUser({
      email: session.user.email,
      display_name: session.user.user_metadata?.full_name || session.user.email.split("@")[0],
      avatar_url: session.user.user_metadata?.avatar_url,
      oauth_provider: session.user.app_metadata?.provider || "google",
      oauth_id: session.user.id,
      subscription_tier: "free", // Default, will be updated after license check
      subscription_status: "trial",
      is_active: true,
    });
    log.info("[Session] Created local user from existing Supabase session");
  }
}
```

### Handle DB Not Initialized

If `session:restore` is called before DB is initialized:
1. Use the same `setPendingDeepLinkUser()` pattern from TASK-1507D
2. User will be created after DB init

---

## Acceptance Criteria

- [ ] Users who authenticated before TASK-1507D can use the app normally
- [ ] Mailbox connection (OAuth) works and shows "connected" state
- [ ] Messages import succeeds (no FK constraint error)
- [ ] Contacts import succeeds (no FK constraint error)
- [ ] Fix does not break new user auth flow (TASK-1507D path still works)
- [ ] Fix handles case where DB is not initialized yet

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `electron/handlers/sessionHandlers.ts` | Modify | Add user sync in session:restore |
| `electron/services/databaseService.ts` | Verify | Ensure `isInitialized()` and `getUserByEmail()` work |

---

## Out of Scope

- **Google Places API key** - Separate issue, should be tracked as TASK-1508C or similar
- **License validation for existing users** - Already handled by existing license flow

---

## Testing

### Manual Test Steps

1. **With existing broken user:**
   - Start app (should restore session)
   - Check logs for "Created local user from existing Supabase session"
   - Connect email (OAuth should work)
   - Verify "disconnect" button appears
   - Import messages (should succeed)
   - Import contacts (should succeed)

2. **With new user (regression test):**
   - Sign out completely
   - Delete local database (ensure clean state)
   - Sign in via deep link
   - Verify auth flow still works end-to-end

### Automated Tests

- [ ] Unit test: session:restore creates user when missing
- [ ] Unit test: session:restore does not duplicate user
- [ ] Unit test: handles DB not initialized (pending pattern)

---

## Branch Information

**Branch From:** `project/licensing-and-auth-flow`
**Branch Into:** `project/licensing-and-auth-flow`
**Branch Name:** `fix/task-1507e-existing-user-local-db`

---

## Implementation Summary

### Changes Made
- [x] Added local user sync to `handleGetCurrentUser()` in sessionHandlers.ts
- [x] When session validation succeeds but no local user found:
  1. First tries `getUserById(session.user.id)` (existing behavior)
  2. Falls back to `getUserByEmail(session.user.email)`
  3. Falls back to `getUserByOAuthId(session.provider, session.user.oauth_id)`
  4. If still not found, creates local user from session data
- [x] Error handling: user creation failure logged but doesn't fail auth
- [x] Consistent pattern with TASK-1507D `syncDeepLinkUserToLocalDb()`

### Files Modified
- [x] `electron/handlers/sessionHandlers.ts` - Added user sync logic to `handleGetCurrentUser()`

### Testing Performed
- [x] Type check passes (`npm run type-check`)
- [x] Lint passes (only pre-existing warnings in other files)
- [x] Session tests pass: 70 tests (4 suites)
- [x] Auth tests pass: 183 tests (7 suites)
- [x] User database tests pass: 162 tests (7 suites)

### Technical Notes
- The fix handles the case where `session.user.id` is a Supabase UUID (not local user ID)
- Multiple lookup strategies ensure we find existing users created via different auth paths
- Fallback user creation uses same field mapping as TASK-1507D for consistency

### Agent ID
- Engineer: session-user-sync-1507e
- SR Engineer: _(record on PR review)_
