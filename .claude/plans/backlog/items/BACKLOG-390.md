# BACKLOG-390: Desktop - Local Schema Changes + Auth Migration

**Priority:** P0 (Critical)
**Category:** schema / desktop / auth
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~20K

---

## Summary

Two changes to desktop app infrastructure:
1. Add submission tracking fields to local SQLite `transactions` table
2. Migrate auth to use Supabase Auth (signInWithIdToken after direct OAuth)

---

## Problem Statement

### Part 1: Submission Tracking
The desktop app needs to track:
- Whether a transaction has been submitted for broker review
- The cloud submission ID for syncing status updates
- When the transaction was last submitted
- Broker review notes received from the cloud

Currently, transactions have no awareness of the broker review workflow.

### Part 2: Auth Migration
The desktop app currently uses:
- Direct Google/Microsoft OAuth (handles flow itself)
- Service key to access Supabase (bypasses all RLS)

For B2B, we need:
- Supabase Auth session so RLS policies work
- `auth.uid()` returns the user's ID in database queries
- Same OAuth flow, but tell Supabase about the token after

---

## Proposed Solution

Add four new columns to the local `transactions` table:

```sql
ALTER TABLE transactions ADD COLUMN submission_status TEXT DEFAULT 'not_submitted';
-- Values: not_submitted, submitted, under_review, needs_changes, resubmitted, approved, rejected

ALTER TABLE transactions ADD COLUMN submission_id TEXT;
-- UUID reference to transaction_submissions in Supabase

ALTER TABLE transactions ADD COLUMN submitted_at TEXT;
-- ISO timestamp of last submission

ALTER TABLE transactions ADD COLUMN last_review_notes TEXT;
-- Most recent broker feedback (synced from cloud)
```

### Migration File

Create `electron/migrations/XXXX_add_submission_tracking.sql`:

```sql
-- Migration: Add submission tracking fields
-- Purpose: Track broker review workflow for B2B portal
-- Date: 2026-01-XX
-- Sprint: SPRINT-050

-- Check if columns exist before adding (SQLite doesn't support IF NOT EXISTS for columns)
-- This will be handled in the migration runner with try/catch

ALTER TABLE transactions ADD COLUMN submission_status TEXT DEFAULT 'not_submitted';
ALTER TABLE transactions ADD COLUMN submission_id TEXT;
ALTER TABLE transactions ADD COLUMN submitted_at TEXT;
ALTER TABLE transactions ADD COLUMN last_review_notes TEXT;

-- Create index for filtering by submission status
CREATE INDEX IF NOT EXISTS idx_transactions_submission_status 
ON transactions(submission_status);
```

### TypeScript Types

Update transaction types in `src/types/`:

```typescript
// Add to Transaction interface
export interface Transaction {
  // ... existing fields ...
  
  // Submission tracking (B2B)
  submission_status: SubmissionStatus;
  submission_id: string | null;
  submitted_at: string | null;
  last_review_notes: string | null;
}

export type SubmissionStatus = 
  | 'not_submitted'
  | 'submitted'
  | 'under_review'
  | 'needs_changes'
  | 'resubmitted'
  | 'approved'
  | 'rejected';
```

### Part 2: Auth Migration

Update the auth flow to create a Supabase session after direct OAuth:

```typescript
// In electron/services/supabaseService.ts or auth service

// Current: Direct OAuth with Google/Microsoft
const tokens = await googleOAuth.getTokens(); // or microsoftOAuth

// NEW: Tell Supabase about this user (creates session + JWT)
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'google', // or 'azure' for Microsoft
  token: tokens.id_token,
});

if (error) {
  console.error('Supabase auth failed:', error);
  // Fall back to service key for now, but log warning
}

// Now supabase queries include JWT, RLS works
// auth.uid() returns user's ID
```

**Key Points:**
- Keep existing OAuth flow unchanged (user experience same)
- Add one call after OAuth completes
- Supabase validates the ID token cryptographically (secure)
- Creates user in `auth.users` if first login
- Triggers `on_auth_user_created` → creates profile
- RLS policies now work with `auth.uid()`

**For Microsoft OAuth:**
```typescript
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'azure',
  token: microsoftTokens.id_token,
});
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/migrations/XXXX_add_submission_tracking.sql` | New migration file |
| `electron/services/databaseService.ts` | Add migration to runner, update queries |
| `electron/services/supabaseService.ts` | Add signInWithIdToken after OAuth |
| `electron/services/authService.ts` | Update to call Supabase after OAuth |
| `src/types/transaction.ts` or similar | Add new fields to type |
| `electron/utils/databaseSchema.ts` | Update schema version |

---

## Dependencies

- BACKLOG-387: Cloud schema should be defined first (for alignment)
- BACKLOG-388: No direct dependency, but good to have RLS ready

---

## Acceptance Criteria

### Schema Changes
- [ ] Migration creates all 4 new columns
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] TypeScript types updated with new fields
- [ ] Existing transactions get default `not_submitted` status
- [ ] Index created for status queries
- [ ] Database queries include new fields in SELECT/INSERT/UPDATE
- [ ] App starts successfully after migration

### Auth Migration
- [ ] After Google OAuth, `signInWithIdToken` is called
- [ ] After Microsoft OAuth, `signInWithIdToken` is called (provider: 'azure')
- [ ] User is created in Supabase `auth.users` on first login
- [ ] Profile is auto-created via trigger
- [ ] Supabase client has valid session after login
- [ ] Graceful fallback if Supabase auth fails (log warning, continue with service key)
- [ ] Existing login UX unchanged (same popups, same flow)

---

## Technical Notes

### SQLite Migration Handling

SQLite doesn't support `IF NOT EXISTS` for `ALTER TABLE ADD COLUMN`. The migration runner should:
1. Check if column exists before adding
2. Or wrap in try/catch and ignore "duplicate column" errors

```typescript
// In migration runner
try {
  db.exec('ALTER TABLE transactions ADD COLUMN submission_status TEXT DEFAULT "not_submitted"');
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}
```

### Backward Compatibility

- New columns have defaults, so existing data works
- UI should handle null/undefined for new fields gracefully
- Don't break exports that serialize transactions

### Status Sync Pattern

Status updates come from cloud to local:
1. Desktop polls `transaction_submissions` for status changes
2. Matches by `submission_id` 
3. Updates local `submission_status` and `last_review_notes`

---

## Testing Plan

### Schema Changes
1. Run migration on fresh database
2. Run migration on database with existing transactions
3. Verify default values applied
4. Query transactions and verify new fields present
5. Update a transaction's submission_status
6. Restart app and verify data persisted

### Auth Migration
1. Login with Google - verify user created in Supabase auth.users
2. Login with Microsoft - verify user created in Supabase auth.users
3. Check Supabase dashboard: profile auto-created with 14-day trial
4. Verify `supabase.auth.getUser()` returns valid user after login
5. Test logout and re-login
6. Test with network offline - should fall back gracefully

---

## Related Items

- BACKLOG-387: Supabase Schema (cloud equivalent)
- BACKLOG-391: Submit for Review UI (uses these fields)
- BACKLOG-395: Status Sync (reads/writes these fields)
- SPRINT-050: B2B Broker Portal Demo
