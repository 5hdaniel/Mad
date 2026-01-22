# BACKLOG-364: Remove Duplicate transaction_participants Table

**Created**: 2026-01-21
**Priority**: Critical
**Category**: Technical Debt / Data Integrity
**Status**: Pending
**Source**: SR Engineer Database Audit (ISSUE-001)

---

## Problem Statement

The schema contains TWO junction tables for linking contacts to transactions:

1. `transaction_participants` - Defined in schema but **NOT used by any service**
2. `transaction_contacts` - The actual table used by contactDbService

This creates confusion and potential data integrity issues:
- Developers may use the wrong table
- `transaction_summary` view references `transaction_participants` (line 849)
- Schema has indexes for both tables, wasting space

## Evidence

**Schema (schema.sql lines 352-385):**
```sql
CREATE TABLE IF NOT EXISTS transaction_participants (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  role TEXT CHECK (role IN (...)),
  ...
);
```

**Schema (schema.sql lines 387-409):**
```sql
CREATE TABLE IF NOT EXISTS transaction_contacts (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  role TEXT,
  role_category TEXT,
  specific_role TEXT,
  ...
);
```

**The view uses transaction_participants:**
```sql
(SELECT COUNT(*) FROM transaction_participants tp WHERE tp.transaction_id = t.id) as participant_count
```

## Required Changes

### 1. Migration Script
- Migrate any data from `transaction_participants` to `transaction_contacts` (if any exists)
- Update `transaction_summary` view to use `transaction_contacts`
- Drop `transaction_participants` table and its indexes

### 2. Schema Update
- Remove `transaction_participants` table definition
- Remove associated indexes
- Update `transaction_summary` view

### 3. Verification
- Confirm no services reference `transaction_participants`
- Confirm view works correctly after update

## Acceptance Criteria

- [ ] No `transaction_participants` table in schema
- [ ] `transaction_summary` view uses `transaction_contacts`
- [ ] Migration handles any existing data
- [ ] All existing tests pass
- [ ] No code references `transaction_participants`

## Estimation

- **Category:** database/migration
- **Estimated Tokens:** ~5K
- **Risk:** Low (table appears unused)

## Related

- BACKLOG-296 (FINDING-01): Originally identified this issue
- contactDbService.ts: Uses transaction_contacts
