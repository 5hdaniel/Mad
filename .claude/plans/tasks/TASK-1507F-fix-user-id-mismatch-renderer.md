# TASK-1507F: Fix User ID Mismatch in Renderer Callback

**Sprint:** SPRINT-062
**Backlog Item:** Follow-up to TASK-1507D, TASK-1507E
**Priority:** P0 (Blocking user)
**Estimated Tokens:** ~15K
**Execution:** Sequential

---

## Context

TASK-1507D creates the local SQLite user correctly during deep link auth, but the `sendToRenderer()` call sends the **wrong user ID** to the frontend:

- **Sends:** Supabase UUID (e.g., `d5283d52-f612-4ab4-9e85-f3a5adc01bea`)
- **Should send:** Local SQLite user ID

When the renderer stores the Supabase UUID as `currentUser.id`, all subsequent operations fail because:
1. The local database uses a different ID system
2. FK constraints reference the local user ID, not Supabase UUID
3. Operations like mailbox connection, audit logs, and contacts fail

---

## Root Cause Location

`electron/main.ts` in `handleDeepLinkCallback()` around lines 342-354:

```typescript
// TASK-1507: Step 6 - Success! Send all data to renderer
log.info("[DeepLink] Auth complete, sending success event for user:", user.id);
sendToRenderer("auth:deep-link-callback", {
  accessToken,
  refreshToken,
  userId: user.id,       // <-- BUG: This is Supabase UUID!
  user: {
    id: user.id,         // <-- BUG: This is Supabase UUID!
    email: user.email,
    name: user.user_metadata?.full_name,
  },
  provider: user.app_metadata?.provider,
  licenseStatus,
  device: deviceResult.device,
});
```

**Timeline:**
1. Line 332: `syncDeepLinkUserToLocalDb(deepLinkUserData)` creates local user
2. Lines 342-354: `sendToRenderer()` uses `user.id` (Supabase UUID) instead of local user ID

---

## Fix Required

After `syncDeepLinkUserToLocalDb()` creates the local user, retrieve the local user ID and send THAT in the callback:

```typescript
// After syncDeepLinkUserToLocalDb() completes...

// Get the LOCAL user ID to send to renderer
const localUser = await databaseService.getUserByEmail(user.email || "");
const localUserId = localUser?.id || user.id; // Fallback to Supabase ID if lookup fails

sendToRenderer("auth:deep-link-callback", {
  accessToken,
  refreshToken,
  userId: localUserId,        // Use local ID
  user: {
    id: localUserId,          // Use local ID
    email: user.email,
    name: user.user_metadata?.full_name,
  },
  supabaseUserId: user.id,    // Keep Supabase ID for license operations
  provider: user.app_metadata?.provider,
  licenseStatus,
  device: deviceResult.device,
});
```

### Important: Handle Both Code Paths

The local user is created in TWO possible paths:
1. **DB initialized:** `syncDeepLinkUserToLocalDb()` runs immediately (line 332)
2. **DB not initialized:** User stored via `setPendingDeepLinkUser()` (line 337)

For path 2, the local user ID won't be available until after DB initialization. Options:
- **Option A:** Wait for DB init before sending callback (complicates flow)
- **Option B:** Send Supabase UUID, let renderer handle lookup later
- **Option C:** Send Supabase UUID for pending case, renderer uses `getUserByEmail()` on load

**Recommendation:** Option C - Keep current behavior for pending case, but always look up local user when DB is initialized.

---

## Acceptance Criteria

- [ ] When DB is initialized: `sendToRenderer()` uses local SQLite user ID
- [ ] When DB is NOT initialized: `sendToRenderer()` uses Supabase UUID (acceptable, will be reconciled on session restore)
- [ ] Renderer receives correct user ID for all subsequent operations
- [ ] FK constraint errors no longer occur after deep link auth
- [ ] Regression: New user deep link auth still works end-to-end
- [ ] Regression: Existing users (TASK-1507E path) still work

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `electron/main.ts` | Modify | Update `sendToRenderer()` in `handleDeepLinkCallback()` |

---

## Testing

### Manual Test Steps

1. **New user deep link auth (DB initialized):**
   - Sign out completely
   - Delete local database
   - Start app, wait for "ready"
   - Sign in via deep link
   - Verify `currentUser.id` matches local SQLite user ID
   - Connect mailbox - should work without FK errors

2. **Verify local user ID in logs:**
   - Check electron logs for `[DeepLink] Auth complete, sending success event for user: <ID>`
   - Check that `<ID>` is NOT a UUID format if local user was created

3. **Regression test for existing users:**
   - User with existing session (TASK-1507E path)
   - Restart app
   - Verify operations work without FK errors

### Automated Tests

- [ ] Unit test: `handleDeepLinkCallback` sends local user ID when DB initialized
- [ ] Unit test: `handleDeepLinkCallback` sends Supabase UUID when DB not initialized
- [ ] Integration test: Full deep link flow results in correct user ID in renderer

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| TASK-1507D | After | Creates local SQLite user |
| TASK-1507E | After | Handles existing users |
| TASK-1508 | Blocks | User Gate testing |

---

## Branch Information

**Branch From:** `project/licensing-and-auth-flow`
**Branch Into:** `project/licensing-and-auth-flow`
**Branch Name:** `fix/task-1507f-user-id-mismatch`

---

## Implementation Summary

*To be filled in by engineer after implementation*

### Changes Made
- [ ]

### Files Modified
- [ ]

### Testing Performed
- [ ] Type check passes
- [ ] Lint passes
- [ ] Related tests pass

### Agent ID
- Engineer:
- SR Engineer:

