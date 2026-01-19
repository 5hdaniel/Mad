# BACKLOG-083: Fix schema_version Migration Warning

## Status
- **Priority:** Low
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-18
- **Type:** Bug / Tech Debt

## Summary

Database initialization logs a migration error for missing `schema_version` table, but then reports success. This is confusing and should be cleaned up.

## Current Behavior

```
ERROR [DatabaseService] Migration failed
{
  "error": "no such table: schema_version",
  ...
}
INFO  [DatabaseService] Database initialized successfully with encryption
```

The error is logged but doesn't prevent initialization, suggesting it's a non-fatal check that should be handled gracefully.

## Expected Behavior

- No error logged if `schema_version` table doesn't exist (expected for fresh databases)
- Create `schema_version` table if it doesn't exist
- Or remove the check if it's no longer needed

## Root Cause

The `_runAdditionalMigrations` method in `databaseService.ts` tries to query `schema_version` table without first checking if it exists.

## Acceptance Criteria

- [ ] No false-positive migration errors in logs
- [ ] `schema_version` table created if missing
- [ ] Existing databases with `schema_version` continue to work
- [ ] Clean log output during initialization

## Technical Notes

- Error occurs in: `DatabaseService._runAdditionalMigrations` (databaseService.ts:895)
- Called from: `DatabaseService.runMigrations` (databaseService.ts:297)
- Should check table existence before querying

## Dependencies

- None

## Related Items

- BACKLOG-082: Consolidate Database Connection Systems
