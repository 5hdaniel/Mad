# BACKLOG-390: Desktop - Local Schema Changes

**Priority:** P0 (Critical)
**Category:** schema / desktop
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~15K

---

## Summary

Add submission tracking fields to the local SQLite `transactions` table to track submission status, cloud reference IDs, and broker feedback.

---

## Problem Statement

The desktop app needs to track:
- Whether a transaction has been submitted for broker review
- The cloud submission ID for syncing status updates
- When the transaction was last submitted
- Broker review notes received from the cloud

Currently, transactions have no awareness of the broker review workflow.

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

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/migrations/XXXX_add_submission_tracking.sql` | New migration file |
| `electron/services/databaseService.ts` | Add migration to runner, update queries |
| `src/types/transaction.ts` or similar | Add new fields to type |
| `electron/utils/databaseSchema.ts` | Update schema version |

---

## Dependencies

- BACKLOG-387: Cloud schema should be defined first (for alignment)
- BACKLOG-388: No direct dependency, but good to have RLS ready

---

## Acceptance Criteria

- [ ] Migration creates all 4 new columns
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] TypeScript types updated with new fields
- [ ] Existing transactions get default `not_submitted` status
- [ ] Index created for status queries
- [ ] Database queries include new fields in SELECT/INSERT/UPDATE
- [ ] App starts successfully after migration

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

1. Run migration on fresh database
2. Run migration on database with existing transactions
3. Verify default values applied
4. Query transactions and verify new fields present
5. Update a transaction's submission_status
6. Restart app and verify data persisted

---

## Related Items

- BACKLOG-387: Supabase Schema (cloud equivalent)
- BACKLOG-391: Submit for Review UI (uses these fields)
- BACKLOG-395: Status Sync (reads/writes these fields)
- SPRINT-050: B2B Broker Portal Demo
