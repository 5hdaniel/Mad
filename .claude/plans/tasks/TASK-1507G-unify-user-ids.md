# TASK-1507G: Unify User IDs Across Local SQLite and Supabase

**Sprint:** SPRINT-062
**Backlog Item:** Follow-up to TASK-1507D, TASK-1507E, TASK-1507F
**Priority:** P0 (Blocks all licensing functionality)
**Estimated Tokens:** ~50K (significant architectural change)
**Execution:** Sequential

---

## Problem Statement

The app currently uses **TWO different user IDs**:

| Source | ID Type | Example |
|--------|---------|---------|
| Local SQLite | Random UUID via `crypto.randomUUID()` | `a1b2c3d4-...` |
| Supabase Auth | UUID assigned by Supabase | `d5283d52-f612-4ab4-9e85-f3a5adc01bea` |

This dual-ID system causes **FK constraint failures** when the local ID is used for Supabase operations (licenses, devices, etc.) because Supabase expects its own UUID.

### Root Cause

```typescript
// electron/services/db/userDbService.ts:16
export async function createUser(userData: NewUser): Promise<User> {
  const id = crypto.randomUUID();  // <-- PROBLEM: Random ID, not Supabase ID
  // ...
}
```

When we call Supabase license APIs with the local random UUID, Supabase rejects it because:
1. Supabase Auth has its own UUID for the user
2. License/device tables have FK constraints to `auth.users(id)`
3. The random local UUID doesn't exist in `auth.users`

---

## Solution: Industry Best Practice

**Use Supabase Auth ID as the canonical user ID EVERYWHERE.**

This is the standard approach for apps using Supabase Auth:
- Local SQLite stores Supabase Auth UUID as the user's primary key
- All FK references use the same ID
- License, device, and other Supabase operations work seamlessly

---

## Scope of Changes

### 1. User Creation Flow (Core Change)

**File: `electron/services/db/userDbService.ts`**

Current:
```typescript
export async function createUser(userData: NewUser): Promise<User> {
  const id = crypto.randomUUID();  // Random!
  // ...
}
```

Required:
```typescript
export async function createUser(userData: NewUser & { id?: string }): Promise<User> {
  const id = userData.id || crypto.randomUUID();  // Use provided ID if available
  // ...
}
```

### 2. Auth Handler Updates

All auth handlers must pass the Supabase Auth ID when creating local users.

**File: `electron/handlers/googleAuthHandlers.ts`**
```typescript
// In handleGoogleAuthCallback or similar:
await createUser({
  id: supabaseUser.id,  // <-- ADD THIS: Use Supabase Auth ID
  email: supabaseUser.email,
  display_name: supabaseUser.user_metadata?.full_name,
  // ...
});
```

**File: `electron/handlers/microsoftAuthHandlers.ts`**
- Same pattern as Google auth

**File: `electron/main.ts`**
- Deep link handler already has access to `user.id` from Supabase
- Ensure it passes this ID to `syncDeepLinkUserToLocalDb()`

### 3. Session Restore

**File: `electron/handlers/sessionHandlers.ts`**

When restoring session for existing users, ensure any user creation uses Supabase ID:
```typescript
// In handleGetCurrentUser or session:restore:
if (!localUser) {
  await createUser({
    id: session.user.id,  // <-- Use Supabase Auth ID
    email: session.user.email,
    // ...
  });
}
```

### 4. Migration for Existing Users

**CRITICAL:** Existing users have random local IDs. We need to migrate them.

**Migration Strategy:**

Option A: **In-place ID update** (Complex, risky)
- Update `users_local.id` to Supabase UUID
- Update all FK references in other tables
- Requires careful transaction handling

Option B: **Soft migration** (Safer, recommended)
- Add `supabase_id` column to `users_local`
- Use `supabase_id` for Supabase operations
- Keep local `id` for internal FK references
- Gradually migrate FK references in future sprints

Option C: **Session-based migration** (Simplest, recommended for MVP)
- On next login, detect ID mismatch
- Create new local user with Supabase ID
- Migrate data from old user to new user
- Delete old user record

**Recommendation:** Option C for MVP, Option B for long-term

### 5. Affected Local SQLite Tables

| Table | FK Column | Action Required |
|-------|-----------|-----------------|
| `users_local` | `id` (PK) | Use Supabase Auth ID |
| `emails` | `user_id` | FK update needed |
| `communications` | `user_id` | FK update needed |
| `llm_settings` | `user_id` | FK update needed |
| `sessions` | `user_id` | FK update needed |
| `audit_logs` | `user_id` | FK update needed |
| `oauth_tokens` | `user_id` | FK update needed |
| `contacts` | `user_id` | FK update needed |
| `transactions` | `user_id` | FK update needed |
| `transaction_contacts` | `user_id` | FK update needed |
| `submissions` | `user_id` | FK update needed |

---

## Implementation Plan

### Phase A: Core ID Change (Required)

1. **Modify `createUser()` to accept optional ID parameter**
   - File: `electron/services/db/userDbService.ts`
   - Change function signature to accept `id?: string`
   - Use provided ID or fallback to `crypto.randomUUID()`

2. **Update auth handlers to pass Supabase ID**
   - File: `electron/handlers/googleAuthHandlers.ts`
   - File: `electron/handlers/microsoftAuthHandlers.ts`
   - File: `electron/main.ts` (deep link handler)
   - File: `electron/handlers/sessionHandlers.ts`

### Phase B: Existing User Migration (Required for MVP)

3. **Detect ID mismatch on session restore**
   - In `handleGetCurrentUser()` or `session:restore`
   - Compare `localUser.id` with `session.user.id` (Supabase)
   - If different, trigger migration

4. **Implement user data migration**
   - Create new user with Supabase ID
   - Copy user preferences/settings
   - Update FK references in child tables
   - Or add `supabase_id` column for mapping

### Phase C: Cleanup (Optional, Future Sprint)

5. **Remove fallback `crypto.randomUUID()` usage**
   - Enforce Supabase ID is always provided
   - Add validation to prevent random ID creation

---

## Acceptance Criteria

### Core Functionality
- [ ] `createUser()` accepts optional `id` parameter
- [ ] Google auth passes Supabase ID to `createUser()`
- [ ] Microsoft auth passes Supabase ID to `createUser()`
- [ ] Deep link auth passes Supabase ID to `createUser()`
- [ ] Session restore passes Supabase ID when creating user

### Supabase Integration
- [ ] License operations work (same ID in local and Supabase)
- [ ] Device registration works
- [ ] No more FK constraint failures in Supabase

### Migration
- [ ] Existing users can still use the app
- [ ] Migration happens transparently on next login
- [ ] User data is preserved during migration
- [ ] FK references in child tables are updated

### Regression Tests
- [ ] New user auth flow works end-to-end
- [ ] Email connection works after auth
- [ ] Messages import works
- [ ] Contacts import works
- [ ] Audit logs are created correctly

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `electron/services/db/userDbService.ts` | Modify | Accept optional `id` parameter |
| `electron/handlers/googleAuthHandlers.ts` | Modify | Pass Supabase ID to `createUser()` |
| `electron/handlers/microsoftAuthHandlers.ts` | Modify | Pass Supabase ID to `createUser()` |
| `electron/handlers/sessionHandlers.ts` | Modify | Pass Supabase ID, add migration logic |
| `electron/main.ts` | Modify | Ensure deep link uses Supabase ID |
| `electron/system-handlers.ts` | Verify | Check pending user handling |

### Migration Files (if Option B chosen)

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/XXXXXXXX_add_supabase_id.sql` | Create | Add `supabase_id` column |
| `electron/services/db/userDbService.ts` | Modify | Add `getUserBySupabaseId()` |
| `electron/services/userMigrationService.ts` | Create | Handle ID migration logic |

---

## Testing

### Manual Test Steps

1. **New user with unified ID:**
   - Delete local database
   - Sign in via Google OAuth
   - Verify local user ID matches Supabase Auth ID
   - Connect mailbox - should work
   - Check Supabase: `user_licenses.user_id` matches local `users_local.id`

2. **Existing user migration:**
   - Start with existing user (random local ID)
   - Sign out and sign back in
   - Verify migration happened (logs should show)
   - Verify all operations work (emails, contacts, transactions)

3. **License operations:**
   - Create license for user
   - Verify no FK constraint errors
   - Verify license status queryable

### Automated Tests

- [ ] Unit test: `createUser()` uses provided ID when given
- [ ] Unit test: `createUser()` falls back to random UUID when no ID
- [ ] Integration test: Auth flow creates user with Supabase ID
- [ ] Integration test: Session restore handles ID mismatch
- [ ] Migration test: User data preserved during ID migration

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| TASK-1507D | After | Creates local SQLite user (current approach) |
| TASK-1507E | After | Handles existing users (current approach) |
| TASK-1507F | After | Fixes ID mismatch in renderer (temporary fix) |
| TASK-1508 | Blocks | User Gate testing |

**Note:** This task supersedes TASK-1507F's approach. Instead of sending the "correct" ID after the fact, we ensure the correct ID is used from the start.

---

## Branch Information

**Branch From:** `project/licensing-and-auth-flow`
**Branch Into:** `project/licensing-and-auth-flow`
**Branch Name:** `feature/task-1507g-unify-user-ids`

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Medium | High | Backup user data before migration, test thoroughly |
| FK cascade failures | Medium | High | Use transactions, test on dev DB first |
| Existing sessions break | Low | Medium | Session restore handles gracefully |
| Migration takes too long | Low | Medium | Run in background, show progress |

---

## Technical Notes

### Why Not Store Both IDs?

Adding a `supabase_id` column (Option B) is cleaner long-term but:
- Requires DB migration
- Adds complexity to every query
- Still need to migrate FK references eventually

Using Supabase ID as the primary key from the start is simpler.

### Why Random UUID Fallback?

The fallback `crypto.randomUUID()` exists for:
- Offline-first scenarios (no Supabase)
- Testing (no real auth)
- Edge cases where Supabase ID unavailable

For MVP, we require Supabase ID and can remove the fallback later.

### Performance Considerations

- User creation: No change (still single INSERT)
- Session restore: Add ID comparison (negligible)
- Migration: One-time cost per user, can be async

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
- [ ] Manual flow tested

### Agent ID
- Engineer:
- SR Engineer:
