# BACKLOG-533: Standardize Foreign Key References to auth.users

**Created**: 2026-01-27
**Priority**: P1 - Data Integrity
**Category**: Database
**Status**: Pending

---

## Problem Statement

Inconsistent foreign key relationships across Supabase tables:

| Table | References | Should Reference |
|-------|------------|------------------|
| `licenses` | `auth.users.id` | auth.users.id (correct) |
| `devices` | `auth.users.id` | auth.users.id (correct) |
| `analytics_events` | `public.users.id` | auth.users.id |
| `api_usage` | `public.users.id` | auth.users.id |

## Data Integrity Risks

**Severity**: High

1. **Orphaned Records**: If `public.users` and `auth.users` get out of sync, FKs break
2. **Query Complexity**: Joins become inconsistent depending on which table
3. **Referential Integrity**: Cascades don't work correctly across the split
4. **Confusion**: Developers don't know which users table to use

## Root Cause

The `public.users` table was likely created as a mirror/profile table for `auth.users`, but some tables reference one and some reference the other.

## Solution

### Phase 1: Audit Current State

```sql
-- Find all tables referencing public.users.id
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users';
```

### Phase 2: Migration Strategy

For each affected table:

1. Add new column referencing `auth.users.id`
2. Populate from existing data (if `public.users.id` = `auth.users.id`)
3. Drop old FK constraint
4. Drop old column
5. Rename new column

```sql
-- Example for analytics_events
ALTER TABLE analytics_events
    ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);

UPDATE analytics_events ae
SET auth_user_id = (
    SELECT au.id FROM auth.users au
    WHERE au.id = ae.user_id::uuid
);

ALTER TABLE analytics_events DROP CONSTRAINT analytics_events_user_id_fkey;
ALTER TABLE analytics_events DROP COLUMN user_id;
ALTER TABLE analytics_events RENAME COLUMN auth_user_id TO user_id;
```

### Phase 3: Update Application Code

- Update any queries that join through `public.users`
- Update TypeScript types if needed

## Acceptance Criteria

- [ ] All user FKs reference `auth.users.id`
- [ ] No orphaned records after migration
- [ ] All application queries work correctly
- [ ] RLS policies updated if needed

## Estimated Effort

~30K tokens (migration planning, execution, code updates, testing)

## Dependencies

- Should be done during a maintenance window
- Requires data backup before migration
