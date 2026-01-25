# BACKLOG-507: Database Maintenance Button in Settings

## Summary

Add a "Database Maintenance" button in Settings that allows users to manually optimize their database.

## Priority

P2 - Enhancement

## Description

We recently added performance indexes (Migration 18) to speed up queries. This feature provides users with a manual way to trigger database maintenance when they notice slowdowns. The operations include:

1. **REINDEX** - Rebuilds all indexes for optimal query performance
2. **VACUUM** - Compacts the database file by reclaiming deleted space
3. **ANALYZE** - Updates query planner statistics for better execution plans

## User Story

As a power user, I want to manually optimize my database so that I can maintain optimal performance without waiting for automatic maintenance.

## Acceptance Criteria

- [ ] "Database Maintenance" button visible in Settings under a new "Advanced" or "Storage" section
- [ ] Clicking button shows a modal with options or runs all three operations
- [ ] Progress indicator during maintenance (can take a few seconds)
- [ ] Success/failure feedback after completion
- [ ] Operations run in sequence: REINDEX -> ANALYZE -> VACUUM
- [ ] UI remains responsive during maintenance (async execution)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Technical Details

### Existing Infrastructure

The backend already has partial support:
- `electron/services/db/core/dbConnection.ts` has `vacuumDb()` function
- `electron/services/databaseService.ts` exports `vacuum()` method
- No IPC handler exposed yet

### Implementation Approach

1. **Backend (electron)**:
   - Add `reindexDb()` and `analyzeDb()` functions to `dbConnection.ts`
   - Expose all three via databaseService methods
   - Add IPC handler: `database:maintenance` or `database:optimize`

2. **Frontend (renderer)**:
   - Add button in Settings.tsx (new "Advanced" section)
   - Add `window.api.database.optimize()` call
   - Simple modal or inline progress indicator

### Files to Modify

- `electron/services/db/core/dbConnection.ts` - Add REINDEX, ANALYZE functions
- `electron/services/databaseService.ts` - Expose new methods
- `electron/handlers.ts` or `electron/database-handlers.ts` - Add IPC handler
- `electron/preload.ts` - Expose to renderer
- `src/window.d.ts` - Add type definitions
- `src/components/Settings.tsx` - Add UI button

## Estimate

~50K tokens (simple UI + backend handler)

## Dependencies

- Migration 18 (performance indexes) - Already merged

## Related Items

- Migration 18: Performance indexes for communications table
- BACKLOG-497: Move SQLite Queries to Worker Thread (future optimization)

## Sprint Assignment

To be assigned

## Notes

- This is a nice-to-have feature for power users
- Database file is encrypted with SQLCipher, these operations work normally
- VACUUM requires temporary disk space (2x database size in worst case)
