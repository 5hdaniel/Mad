# BACKLOG-370: Add Unique Constraint for Thread-Based Communication Links

**Created**: 2026-01-21
**Priority**: Moderate
**Category**: Data Integrity
**Status**: Pending
**Source**: SR Engineer Database Audit (ISSUE-009)

---

## Problem Statement

The `communications` table supports thread-based linking (TASK-1114), but there's no uniqueness constraint to prevent duplicate links of the same thread to the same transaction.

**Current State:**
- `thread_id` column exists for thread-based linking
- Indexes exist: `idx_communications_thread_id`, `idx_communications_thread_txn`
- **No UNIQUE constraint on (thread_id, transaction_id)**

This allows:
```sql
-- Both inserts succeed, creating duplicates
INSERT INTO communications (id, thread_id, transaction_id, ...) VALUES ('1', 'thread-abc', 'txn-123', ...);
INSERT INTO communications (id, thread_id, transaction_id, ...) VALUES ('2', 'thread-abc', 'txn-123', ...);
```

## Impact

Without the constraint:
1. **Duplicate thread links** - Same thread linked multiple times to same transaction
2. **Incorrect counts** - Communication counts inflated
3. **Performance degradation** - More rows to process
4. **Unlink issues** - May not remove all duplicate links

## Evidence

**Schema (lines 728-732):**
```sql
-- TASK-1114: Thread-based linking (SPRINT-042)
thread_id TEXT,
```

**Existing Indexes (lines 780-782):**
```sql
CREATE INDEX IF NOT EXISTS idx_communications_thread_id ON communications(thread_id);
CREATE INDEX IF NOT EXISTS idx_communications_thread_txn ON communications(thread_id, transaction_id);
```

**Missing:**
```sql
-- Should exist to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_thread_txn_unique
  ON communications(thread_id, transaction_id)
  WHERE thread_id IS NOT NULL;
```

## Required Changes

### 1. Add Unique Constraint (Partial Index)
```sql
-- Only enforce uniqueness when thread_id is set
-- This allows multiple message_id based links without thread_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_thread_txn_unique
  ON communications(thread_id, transaction_id)
  WHERE thread_id IS NOT NULL AND transaction_id IS NOT NULL;
```

### 2. Migration to Handle Existing Duplicates
Before adding constraint:
1. Identify duplicate (thread_id, transaction_id) pairs
2. Keep most recent link, delete duplicates
3. Then add constraint

### 3. Update Services
- Ensure link operations use INSERT OR IGNORE or handle constraint violations
- communicationService.ts: Update linkThreadToTransaction()

## Acceptance Criteria

- [ ] Unique constraint added for (thread_id, transaction_id)
- [ ] Migration handles existing duplicate data
- [ ] Services handle constraint violations gracefully
- [ ] No duplicate thread links possible after migration
- [ ] Existing functionality unchanged (tests pass)

## Estimation

- **Category:** database/migration
- **Estimated Tokens:** ~4K
- **Risk:** Low-Medium (need to check for existing duplicates)

## Technical Notes

### SQLite Partial Index Syntax
```sql
CREATE UNIQUE INDEX idx_name ON table(col1, col2) WHERE condition;
```

### Why Partial Index?
- Some communications use message_id linking (not thread-based)
- Those records have NULL thread_id
- We only want to enforce uniqueness for thread-based links

## Related

- TASK-1114: Thread-based linking implementation
- TASK-1115/1116: Thread-based linking refinements
- communicationService.ts: Service that manages links
