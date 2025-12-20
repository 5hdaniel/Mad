# BACKLOG-082: Consolidate Database Connection Systems

## Status
- **Priority:** Medium
- **Status:** Pending
- **Sprint:** Unassigned
- **Created:** 2025-12-18
- **Type:** Tech Debt / Refactor

## Summary

Consolidate the two database connection systems into a single, unified approach. Currently there are:

1. **`DatabaseService` class** (`electron/services/databaseService.ts`) - Legacy singleton class with 3600+ lines
2. **`dbConnection.ts` module** (`electron/services/db/core/dbConnection.ts`) - Newer modular approach

These were temporarily bridged via `setSharedDb()` call, but this is a band-aid fix.

## Current State

- `DatabaseService` is the main database manager (initialization, migrations, encryption)
- `dbConnection.ts` provides helper functions (`dbGet`, `dbAll`, `dbRun`) used by newer services
- The bridge happens in `databaseService.ts:173`: `setSharedDb(this.db)`
- New LLM services use `dbConnection.ts` pattern
- Legacy handlers use `databaseService` directly

## Desired State

Single database system with:
- One source of truth for the database connection
- Consistent API for all database operations
- Clear separation between connection management and query execution
- Smaller, focused modules instead of 3600+ line monolith

## Options

### Option A: Migrate to Module Pattern
- Keep `dbConnection.ts` as the connection manager
- Refactor `DatabaseService` to use it internally
- Gradually migrate handlers to use modular db services
- Split `databaseService.ts` into focused service modules

### Option B: Enhance DatabaseService
- Remove `dbConnection.ts` module
- Add helper methods to `DatabaseService`
- Keep singleton pattern but refactor for better organization

### Option C: New Unified System
- Design new database layer from scratch
- Migrate both systems to new approach
- Higher effort but cleanest result

## Recommendation

**Option A** - Migrate to module pattern over time. This:
- Aligns with modern patterns used in LLM services
- Allows incremental migration
- Reduces the 3600+ line monolith

## Acceptance Criteria

- [ ] Single database connection source
- [ ] Remove `setSharedDb()` bridge hack
- [ ] All services use consistent database access pattern
- [ ] `databaseService.ts` split into focused modules (<300 lines each)
- [ ] No regression in functionality
- [ ] All tests passing

## Technical Notes

- Current bridge: `electron/services/databaseService.ts:173`
- New pattern example: `electron/services/db/llmSettingsDbService.ts`
- Legacy pattern: Direct `databaseService.methodName()` calls

## Dependencies

- Should be done during a low-risk period
- Requires comprehensive testing

## Related Items

- BACKLOG-058: Database architecture improvements (completed)
- LLM services use the new modular pattern
