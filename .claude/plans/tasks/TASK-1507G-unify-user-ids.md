# TASK-1507G: Unify User IDs Across Local SQLite and Supabase

**Sprint:** SPRINT-062
**Backlog Item:** Follow-up to TASK-1507D, TASK-1507E, TASK-1507F
**Priority:** P0 (Blocks all licensing functionality)
**Estimated Tokens:** ~30K (reduced - core changes already implemented)
**Execution:** Sequential

---

## Current Status Assessment

**PARTIALLY IMPLEMENTED** - Core ID acceptance is done, but session handler and migration are missing.

### Already Implemented

| Component | Status | Evidence |
|-----------|--------|----------|
| `userDbService.ts` accepts optional `id` | DONE | Line 21: `userData.id \|\| crypto.randomUUID()` |
| `databaseService.ts` facade updated | DONE | Line 945: `createUser(userData: NewUser & { id?: string })` |
| Google auth passes Supabase ID | DONE | Lines 315, 448: `id: cloudUser.id` |
| Microsoft auth passes Supabase ID | DONE | Line 356: `id: cloudUser.id` |
| Shared auth passes Supabase ID | DONE | Line 130: `id: cloudUser.id` |
| Deep link passes Supabase ID | DONE | Line 177-178: `id: userData.supabaseId` |

### NOT YET Implemented

| Component | Status | Issue |
|-----------|--------|-------|
| Session restore passes Supabase ID | **MISSING** | Line 499: No `id` passed to `createUser()` |
| Existing user ID migration | **MISSING** | Users with random UUIDs need migration |
| ID mismatch detection | **MISSING** | No check comparing local vs Supabase ID |

---

## Problem Statement

The app currently has **inconsistent user ID handling**:

| Source | ID Type | Example |
|--------|---------|---------|
| Local SQLite (new auth flows) | Supabase Auth UUID | `67614fc0-1be2-474d-8c99-58305472736a` |
| Local SQLite (session restore) | Random UUID | `a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Supabase Auth | UUID assigned by Supabase | `67614fc0-1be2-474d-8c99-58305472736a` |

### The Remaining Bug (Session Restore)

In `sessionHandlers.ts` line 499, when creating a user from an existing session:

```typescript
// BUG: No ID passed! Creates user with random UUID
freshUser = await databaseService.createUser({
  email: session.user.email,
  // ... NO id: session.user.id
});
```

This causes:
1. Session has Supabase UUID as `session.user.id`
2. Local user created with random UUID
3. FK constraint failures on Supabase operations (licenses, devices)

### Migration Need

Existing users created before TASK-1507G fixes have:
- Random local UUID: `a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Supabase Auth UUID: `67614fc0-1be2-474d-8c99-58305472736a`

These users cannot use licensing features until their local ID is unified.

---

## Solution Architecture

### Principle: Supabase Auth ID is Canonical

Use Supabase Auth UUID as the user's primary key EVERYWHERE:
- Local SQLite `users_local.id` = Supabase Auth UUID
- All FK references use the same ID
- License, device, and Supabase operations work seamlessly

### Migration Strategy: Session-Based (Option C from original plan)

On session restore:
1. Detect ID mismatch (local ID != session user ID)
2. If mismatch, migrate user data to new ID
3. Update FK references in child tables
4. Delete old user record

---

## Implementation Plan

### Phase 1: Fix Session Restore (Required)

**File: `electron/handlers/sessionHandlers.ts`**

**SR Engineer Note:** Verify `session.user.id` is the Supabase Auth UUID. If the local session might contain a stale local ID, fetch from Supabase Auth first:

```typescript
// Line 499 - Add id parameter
// IMPORTANT: session.user.id should be the Supabase Auth UUID
// If uncertain, fetch the authoritative ID from Supabase session
const supabaseSession = await supabaseService.getSession();
const supabaseUserId = supabaseSession?.user?.id || session.user.id;

freshUser = await databaseService.createUser({
  id: supabaseUserId,  // Use Supabase's authoritative UUID
  email: session.user.email,
  // ... rest unchanged
});
```

### Phase 2: Add ID Mismatch Detection (Required)

**File: `electron/handlers/sessionHandlers.ts`**

After line 487 (after finding user by OAuth ID), add:

```typescript
// TASK-1507G: Check for ID mismatch - user exists but with wrong ID
if (freshUser && freshUser.id !== session.user.id) {
  await logService.info(
    "TASK-1507G: ID mismatch detected, migrating user",
    "SessionHandlers",
    {
      localId: freshUser.id.substring(0, 8) + "...",
      supabaseId: session.user.id.substring(0, 8) + "...",
    }
  );

  // Migrate user to Supabase ID
  freshUser = await migrateUserToSupabaseId(freshUser, session.user.id);
}
```

### Phase 3: Implement User Migration (Required for Existing Users)

**File: `electron/handlers/sessionHandlers.ts` (or new service)**

```typescript
/**
 * Migrate user from old random ID to Supabase Auth ID
 * Updates all FK references in child tables
 */
async function migrateUserToSupabaseId(
  oldUser: User,
  newSupabaseId: string
): Promise<User> {
  // SR Engineer: Check if user with Supabase ID already exists (edge case 3)
  const existingUser = await databaseService.getUserById(newSupabaseId);
  if (existingUser) {
    // User already migrated or created correctly - just return existing
    await logService.info(
      "TASK-1507G: User with Supabase ID already exists, skipping migration",
      "SessionHandlers",
      { supabaseId: newSupabaseId.substring(0, 8) + "..." }
    );
    return existingUser;
  }

  const db = databaseService.getRawDatabase();

  // Transaction to ensure atomicity
  const migrate = db.transaction(() => {
    // 1. Create new user with Supabase ID (copy all data)
    db.prepare(`
      INSERT INTO users_local (
        id, email, first_name, last_name, display_name, avatar_url,
        oauth_provider, oauth_id, subscription_tier, subscription_status,
        trial_ends_at, terms_accepted_at, terms_version_accepted,
        privacy_policy_accepted_at, privacy_policy_version_accepted,
        email_onboarding_completed_at, mobile_phone_type, timezone, theme,
        license_type, ai_detection_enabled, organization_id,
        created_at, updated_at
      )
      SELECT
        ?, email, first_name, last_name, display_name, avatar_url,
        oauth_provider, oauth_id, subscription_tier, subscription_status,
        trial_ends_at, terms_accepted_at, terms_version_accepted,
        privacy_policy_accepted_at, privacy_policy_version_accepted,
        email_onboarding_completed_at, mobile_phone_type, timezone, theme,
        license_type, ai_detection_enabled, organization_id,
        created_at, CURRENT_TIMESTAMP
      FROM users_local WHERE id = ?
    `).run(newSupabaseId, oldUser.id);

    // 2. Update FK references in all child tables (SR Engineer verified complete list)
    const tables = [
      'sessions',
      'oauth_tokens',
      'contacts',
      'transactions',
      'communications',
      'emails',
      'messages',
      'llm_settings',
      'audit_logs',
      'classification_feedback',  // SR Engineer: Added
      'audit_packages',           // SR Engineer: Added
      'ignored_communications',   // SR Engineer: Added
    ];

    for (const table of tables) {
      try {
        db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`)
          .run(newSupabaseId, oldUser.id);
      } catch (e) {
        // Table may not exist or have user_id column - ignore
      }
    }

    // 3. Delete old user record
    db.prepare('DELETE FROM users_local WHERE id = ?').run(oldUser.id);
  });

  migrate();

  // Return the migrated user
  const migratedUser = await databaseService.getUserById(newSupabaseId);
  if (!migratedUser) {
    throw new Error('User migration failed - could not find migrated user');
  }

  await logService.info(
    "TASK-1507G: User migration complete",
    "SessionHandlers",
    { newId: newSupabaseId.substring(0, 8) + "..." }
  );

  return migratedUser;
}
```

---

## Affected Tables for Migration

*SR Engineer verified complete list from schema.sql*

| Table | FK Column | Notes |
|-------|-----------|-------|
| `users_local` | `id` (PK) | Create with new ID, delete old |
| `sessions` | `user_id` | UPDATE to new ID |
| `oauth_tokens` | `user_id` | UPDATE to new ID |
| `contacts` | `user_id` | UPDATE to new ID |
| `transactions` | `user_id` | UPDATE to new ID |
| `communications` | `user_id` | UPDATE to new ID |
| `emails` | `user_id` | UPDATE to new ID |
| `messages` | `user_id` | UPDATE to new ID |
| `llm_settings` | `user_id` | UPDATE to new ID |
| `audit_logs` | `user_id` | UPDATE to new ID |
| `classification_feedback` | `user_id` | UPDATE to new ID (SR Engineer: Added) |
| `audit_packages` | `user_id` | UPDATE to new ID (SR Engineer: Added) |
| `ignored_communications` | `user_id` | UPDATE to new ID (SR Engineer: Added) |

---

## Files to Modify

| File | Action | Lines | Notes |
|------|--------|-------|-------|
| `electron/handlers/sessionHandlers.ts` | Modify | 499 | Add `id: session.user.id` |
| `electron/handlers/sessionHandlers.ts` | Add | After 487 | ID mismatch detection |
| `electron/handlers/sessionHandlers.ts` | Add | New function | `migrateUserToSupabaseId()` |

---

## Acceptance Criteria

### Phase 1: Session Restore Fix
- [ ] `handleGetCurrentUser()` passes `session.user.id` to `createUser()`
- [ ] New sessions create users with Supabase Auth ID

### Phase 2: ID Mismatch Detection
- [ ] Existing users with wrong ID are detected
- [ ] Mismatch logged for debugging
- [ ] Migration triggered automatically

### Phase 3: Migration
- [ ] User data preserved during migration
- [ ] All FK references updated in child tables
- [ ] Old user record deleted
- [ ] Migration is atomic (transaction)
- [ ] License operations work after migration

### Integration Tests
- [ ] New user auth flow uses Supabase ID
- [ ] Existing user session restore migrates ID
- [ ] Email connection works (no FK errors)
- [ ] License validation works
- [ ] Device registration works

---

## Testing

### Manual Test: New User (Verify ID Unity)

1. Delete local database (`rm ~/Library/Application\ Support/magic-audit/mad.db`)
2. Sign in via Google/Microsoft OAuth
3. Run SQL: `SELECT id FROM users_local`
4. Compare with Supabase Auth user ID
5. **Expected:** IDs match exactly

### Manual Test: Existing User Migration

1. Create user with old random ID (modify `userDbService.ts` temporarily)
2. Sign out
3. Sign back in
4. Check logs for "TASK-1507G: ID mismatch detected"
5. Verify `users_local.id` now matches Supabase ID
6. Verify contacts, transactions, etc. still work

### Manual Test: License Operations

1. After migration, validate license
2. Register device
3. **Expected:** No FK constraint errors

---

## Branch Information

**Branch From:** `project/licensing-and-auth-flow`
**Branch Into:** `project/licensing-and-auth-flow`
**Branch Name:** `feature/task-1507g-unify-user-ids`

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during migration | Low | High | Use transaction, test thoroughly |
| FK cascade failures | Low | Medium | Handle missing tables gracefully |
| Migration performance | Low | Low | Single user, small data set |
| Existing sessions invalidated | Low | Medium | Session token unchanged |

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| TASK-1507D | After | Complete - basic local user creation |
| TASK-1507E | After | Complete - existing user handling |
| TASK-1507F | After | Complete - ID in renderer callback |
| Licensing schema | Requires | Must exist in Supabase |

---

## Technical Notes

### Why Transaction for Migration?

Migration updates multiple tables. If any UPDATE fails:
- Without transaction: Partial state, broken FKs
- With transaction: Atomic rollback, no partial state

### Why Delete-and-Recreate vs UPDATE?

SQLite doesn't support updating primary keys directly. We must:
1. INSERT new row with new ID
2. UPDATE child table FKs
3. DELETE old row

### Session Token Unchanged

The session token remains valid because it's stored in `sessions` table.
We update `sessions.user_id` to point to the new user ID.

---

## Implementation Summary

### Changes Made
- [x] **Phase 1 (Session Restore Fix):** Modified `handleGetCurrentUser()` to pass `id: supabaseUserId` to `createUser()` when creating local user from session
- [x] **Phase 2 (ID Mismatch Detection):** Added check after finding user by OAuth ID to detect when local ID differs from Supabase ID, triggers migration
- [x] **Phase 3 (Migration Function):** Implemented `migrateUserToSupabaseId()` function with:
  - Existence check (returns existing user if Supabase ID already exists)
  - Atomic transaction for migration
  - INSERT new user with Supabase ID (copy all columns)
  - UPDATE all 12 child tables (sessions, oauth_tokens, contacts, transactions, communications, emails, messages, llm_settings, audit_logs, classification_feedback, audit_packages, ignored_communications)
  - DELETE old user record
  - Truncated ID logging (8 chars + "...")
- [x] Added `getAuthUserId()` mock to test mocks for `supabaseService`

### Files Modified
- [x] `electron/handlers/sessionHandlers.ts` - Main implementation (Phase 1, 2, 3)
- [x] `electron/__tests__/auth-handlers.integration.test.ts` - Added `getAuthUserId` mock
- [x] `electron/__tests__/auth-handlers.test.ts` - Added `getAuthUserId` mock

### Testing Performed
- [x] Type check passes (`npm run type-check`)
- [x] Lint passes (only pre-existing warnings, no new issues)
- [x] Related tests pass (72/72 auth-related tests pass)
- [ ] Manual flow tested (requires packaged app)

### Agent ID
- Engineer: (auto-captured)
- SR Engineer: a042f03

---

## SR Engineer Review Notes

**Review Date:** 2026-01-27 | **Status:** APPROVED WITH CHANGES (changes incorporated above)

### Branch Information
- **Branch From:** project/licensing-and-auth-flow
- **Branch Into:** project/licensing-and-auth-flow
- **Suggested Branch Name:** feature/task-1507g-unify-user-ids

### Execution Classification
- **Parallel Safe:** Yes (no shared files with other SPRINT-062 tasks)
- **Depends On:** TASK-1507D, TASK-1507E, TASK-1507F (all complete)
- **Blocks:** All licensing functionality

### Technical Considerations (Incorporated)
1. ✅ **Tables to update (complete list):** Added classification_feedback, audit_packages, ignored_communications
2. ✅ **Source of Supabase UUID:** Added note to verify/fetch from Supabase session
3. ✅ **Existence check required:** Added check before migration
4. ✅ **Logging:** Only log truncated IDs (8 chars + "...")

### Risk Areas
- Migration atomicity is handled via transaction (safe)
- FK cascade is safe because we UPDATE before DELETE
- Session token unchanged - no re-auth required
