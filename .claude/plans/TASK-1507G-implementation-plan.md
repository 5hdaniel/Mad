# TASK-1507G Implementation Plan: Unify User IDs

## Summary

This plan addresses the dual-ID system where local SQLite uses `crypto.randomUUID()` while Supabase Auth uses its own UUID, causing FK constraint failures when the local ID is passed to Supabase operations.

**Solution:** Use Supabase Auth ID as the canonical user ID everywhere.

---

## Current State Analysis

### 1. User ID Generation (The Problem)

**File:** `electron/services/db/userDbService.ts:15-16`
```typescript
export async function createUser(userData: NewUser): Promise<User> {
  const id = crypto.randomUUID();  // <-- PROBLEM: Ignores Supabase ID
  // ...
}
```

### 2. All `createUser()` Call Sites (7 locations)

| File | Line | Context | Has Access to Supabase ID? |
|------|------|---------|---------------------------|
| `googleAuthHandlers.ts` | 314 | `handleGoogleLogin()` - DB initialized, new user | YES - `cloudUser.id` |
| `googleAuthHandlers.ts` | 445 | `handleGoogleCompleteLogin()` - new user | YES - `cloudUser.id` |
| `microsoftAuthHandlers.ts` | 355 | `handleMicrosoftLogin()` - DB initialized, new user | YES - `cloudUser.id` |
| `sessionHandlers.ts` | 499 | `handleGetCurrentUser()` - session restore | YES - `session.user.id` (may be Supabase UUID) |
| `sharedAuthHandlers.ts` | 99 | `handleCompletePendingLogin()` - after keychain setup | YES - `cloudUser.id` |
| `main.ts` | 167 | `syncDeepLinkUserToLocalDb()` - deep link auth | YES - `userData.supabaseId` |
| `system-handlers.ts` | 260 | Pending deep link user creation | YES - `pendingUser.supabaseId` |

**Key Finding:** All call sites already have access to the Supabase Auth ID via `cloudUser.id`, `session.user.id`, or `userData.supabaseId`.

---

## Implementation Plan

### Phase A: Core Changes (REQUIRED)

#### Step 1: Modify `createUser()` Signature

**File:** `electron/services/db/userDbService.ts`

**Current:**
```typescript
export async function createUser(userData: NewUser): Promise<User> {
  const id = crypto.randomUUID();
  // ...
}
```

**Change to:**
```typescript
export async function createUser(userData: NewUser & { id?: string }): Promise<User> {
  const id = userData.id || crypto.randomUUID();
  // ...
}
```

**Rationale:**
- Optional `id` parameter allows passing Supabase Auth ID
- Fallback to `crypto.randomUUID()` for edge cases (offline mode, testing)
- Backward compatible - existing calls still work

**Type Change:**
The function signature change is sufficient. We extend `NewUser` inline with `& { id?: string }` rather than modifying the base type.

#### Step 2: Update Google Auth Handlers

**File:** `electron/handlers/googleAuthHandlers.ts`

**Location 1: `handleGoogleLogin()` line ~314**
```typescript
// Current:
localUser = await databaseService.createUser({
  email: userInfo.email,
  // ...
});

// Change to:
localUser = await databaseService.createUser({
  id: cloudUser.id,  // <-- ADD: Supabase Auth ID
  email: userInfo.email,
  // ...
});
```

**Location 2: `handleGoogleCompleteLogin()` line ~445**
```typescript
// Current:
localUser = await databaseService.createUser({
  email: userInfo.email,
  // ...
});

// Change to:
localUser = await databaseService.createUser({
  id: cloudUser.id,  // <-- ADD: Supabase Auth ID
  email: userInfo.email,
  // ...
});
```

#### Step 3: Update Microsoft Auth Handlers

**File:** `electron/handlers/microsoftAuthHandlers.ts`

**Location: `handleMicrosoftLogin()` line ~355**
```typescript
// Current:
localUser = await databaseService.createUser({
  email: userInfo.email,
  // ...
});

// Change to:
localUser = await databaseService.createUser({
  id: cloudUser.id,  // <-- ADD: Supabase Auth ID
  email: userInfo.email,
  // ...
});
```

#### Step 4: Update Shared Auth Handlers

**File:** `electron/handlers/sharedAuthHandlers.ts`

**Location: `handleCompletePendingLogin()` line ~99**
```typescript
// Current:
localUser = await databaseService.createUser({
  email: userInfo.email,
  // ...
});

// Change to:
localUser = await databaseService.createUser({
  id: cloudUser.id,  // <-- ADD: Supabase Auth ID
  email: userInfo.email,
  // ...
});
```

#### Step 5: Update Deep Link User Creation

**File:** `electron/main.ts`

**Location: `syncDeepLinkUserToLocalDb()` line ~167**
```typescript
// Current:
await databaseService.createUser({
  email: userData.email,
  display_name: userData.displayName || userData.email.split("@")[0],
  // ...
});

// Change to:
await databaseService.createUser({
  id: userData.supabaseId,  // <-- ADD: Supabase Auth ID
  email: userData.email,
  display_name: userData.displayName || userData.email.split("@")[0],
  // ...
});
```

**File:** `electron/system-handlers.ts`

**Location: Pending deep link user creation line ~260**
```typescript
// Current:
await databaseService.createUser({
  email: pendingUser.email,
  // ...
});

// Change to:
await databaseService.createUser({
  id: pendingUser.supabaseId,  // <-- ADD: Supabase Auth ID
  email: pendingUser.email,
  // ...
});
```

#### Step 6: Update Session Restore (Session Handlers)

**File:** `electron/handlers/sessionHandlers.ts`

**Location: `handleGetCurrentUser()` line ~499**

This is the most complex case. The session may have been created before this fix, so `session.user.id` could be either:
- A random local UUID (old users)
- A Supabase Auth UUID (new users after this fix)

**Current code creates user with random ID:**
```typescript
freshUser = await databaseService.createUser({
  email: session.user.email,
  // ...
  oauth_id: session.user.oauth_id || session.user.id,
  // ...
});
```

**Analysis:**
- If `session.user.id` is already the Supabase UUID (from deep link auth or new flow), we should use it
- The `oauth_id` field may contain the Supabase ID
- We need to determine the "canonical" Supabase ID

**Strategy for Session Restore:**

The session stores the user object. After this fix, new sessions will have `user.id` = Supabase UUID. For retroactive compatibility:

1. If `session.user.id` looks like a Supabase UUID (check if it exists in Supabase), use it
2. Otherwise, use `session.user.oauth_id` if it's a UUID
3. Fallback: Don't pass an ID (random generation for legacy)

**Simplified approach (recommended for MVP):**
```typescript
// Pass the session.user.id directly - for new sessions this will be Supabase UUID
// For old sessions, this creates a new local user (acceptable for migration)
freshUser = await databaseService.createUser({
  id: session.user.id,  // <-- Use session user ID directly
  email: session.user.email,
  // ...
});
```

This works because:
- New sessions (after this fix): `session.user.id` is Supabase UUID
- Old sessions: `session.user.id` is the old local UUID, which we pass through

Wait - this doesn't solve the problem for old sessions. Let me reconsider.

**Better approach for session restore:**

The session file (`~/.magic-audit/session.json`) stores the full user object including `oauth_id`. For users who authenticated via Supabase deep link, the `session.user.id` IS the Supabase UUID.

Looking at the session save code in `googleAuthHandlers.ts`:
```typescript
await sessionService.saveSession({
  user: localUser,  // This is the LOCAL user object
  sessionToken,
  // ...
});
```

So `session.user.id` is the LOCAL SQLite user ID, not the Supabase ID. The Supabase ID isn't directly stored in the session.

**Recommended fix:**
1. Do NOT change the session restore code for existing users
2. The session restore creates a local user if one doesn't exist
3. For new users going forward, they'll have the correct ID from the start
4. Existing users keep their old local ID (not broken, just not aligned)

**This is acceptable for MVP because:**
- New users get the correct unified ID
- Existing users continue to work (their local ID is still valid for local operations)
- We can add migration for existing users in a follow-up task

---

### Phase B: Existing User Migration (OPTIONAL for MVP)

For existing users who have a local ID that differs from their Supabase ID:

**Option 1: No migration (Recommended for MVP)**
- Existing users keep their local ID
- New users get Supabase ID
- Works but IDs don't match

**Option 2: Session-based migration (Future)**
- On login, detect ID mismatch
- Create new user with Supabase ID
- Migrate child records (emails, contacts, transactions, etc.)
- Delete old user

**Option 3: Add `supabase_id` column (Alternative)**
- Add `supabase_id` column to `users_local`
- Use `supabase_id` for Supabase operations
- Keep local `id` for FK references

**Recommendation:** Option 1 for MVP, consider Option 2 for follow-up.

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/db/userDbService.ts` | Accept optional `id` parameter |
| `electron/handlers/googleAuthHandlers.ts` | Pass `cloudUser.id` to `createUser()` (2 locations) |
| `electron/handlers/microsoftAuthHandlers.ts` | Pass `cloudUser.id` to `createUser()` (1 location) |
| `electron/handlers/sharedAuthHandlers.ts` | Pass `cloudUser.id` to `createUser()` (1 location) |
| `electron/main.ts` | Pass `userData.supabaseId` to `createUser()` (1 location) |
| `electron/system-handlers.ts` | Pass `pendingUser.supabaseId` to `createUser()` (1 location) |

**NOT modifying (for MVP):**
- `electron/handlers/sessionHandlers.ts` - Session restore handles legacy users

---

## Order of Changes

1. **First:** Modify `userDbService.ts` to accept optional `id` parameter
2. **Then:** Update all `createUser()` call sites to pass Supabase ID
3. **Last:** Test all auth flows

This order ensures:
- No breaking changes during implementation
- Each step can be tested independently
- Rollback is straightforward

---

## Testing Plan

### Unit Tests

1. **`userDbService.test.ts`**
   - Test: `createUser()` uses provided ID when given
   - Test: `createUser()` falls back to random UUID when no ID provided

### Integration Tests

2. **Auth flow tests (manual)**
   - New user via Google OAuth: Verify `users_local.id` = Supabase Auth UUID
   - New user via Microsoft OAuth: Same verification
   - New user via deep link: Same verification
   - Existing user login: Works without errors

### Manual Verification

3. **Post-implementation check:**
   ```sql
   -- After new user signup, verify IDs match
   SELECT id FROM users_local WHERE email = 'test@example.com';
   -- Compare with Supabase user ID in logs
   ```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing users with mismatched IDs | Don't migrate for MVP; they continue to work locally |
| Test failures from hardcoded UUIDs | Update tests to use provided IDs |
| Session restore creates duplicate users | Check by email before creating (already done) |

---

## Success Criteria

1. New users created via any auth path have `users_local.id` = Supabase Auth UUID
2. License operations succeed (same ID in local and Supabase)
3. Device registration succeeds
4. No FK constraint failures in Supabase
5. All existing tests pass
6. Existing users continue to work

---

## Estimated Effort

- **Core changes (Phase A):** ~30-40K tokens
- **Testing:** ~10K tokens
- **Total:** ~40-50K tokens

Within the ~50K estimate from the task file.

---

## Questions for SR Engineer Review

1. **Confirm MVP scope:** Is it acceptable to NOT migrate existing users in this task?
2. **Type safety:** Should we create a separate type like `NewUserWithId = NewUser & { id?: string }` or inline it?
3. **Session restore:** Should we add the ID to session restore, or leave it for a follow-up task?
