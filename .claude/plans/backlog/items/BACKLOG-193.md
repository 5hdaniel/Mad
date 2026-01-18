# BACKLOG-193: Refactor databaseService.ts (1,223 Lines)

## Summary

Split `electron/services/databaseService.ts` (1,223 lines) into focused modules: QueryService, MigrationService, and ConnectionService.

## Problem

`databaseService.ts` is the largest service file in the codebase and handles too many concerns:
- Database connection management
- Migration execution
- Query building and execution
- Transaction management
- Schema validation

This violates single responsibility principle and makes the code:
- Hard to navigate and understand
- Difficult to test in isolation
- Risky to modify (changes may have unintended side effects)

## Current State

```
electron/services/databaseService.ts - 1,223 lines
├── Connection setup and encryption (~200 lines)
├── Migration system (~300 lines)
├── Query methods (~500 lines)
├── Transaction helpers (~150 lines)
└── Schema utilities (~75 lines)
```

## Proposed Decomposition

| New File | Responsibility | Est. Lines |
|----------|---------------|------------|
| `databaseConnectionService.ts` | Connection, encryption, initialization | ~200 |
| `databaseMigrationService.ts` | Schema migrations, version tracking | ~300 |
| `databaseQueryService.ts` | Generic query execution, transaction helpers | ~200 |
| `databaseService.ts` | Orchestrator, public API | ~250 |
| Domain query files (existing) | Entity-specific queries | As-is |

### Architecture After Refactor

```
databaseService.ts (orchestrator)
├── databaseConnectionService.ts (connection pool, encryption)
├── databaseMigrationService.ts (migrations, schema)
├── databaseQueryService.ts (query execution)
└── Domain services (contactQueries, transactionQueries, etc.)
```

## Acceptance Criteria

- [ ] `databaseService.ts` reduced to <300 lines
- [ ] 3 new focused service files created
- [ ] All existing functionality preserved
- [ ] All existing tests pass
- [ ] No changes to public API (consumers don't need updates)
- [ ] Each new module has clear single responsibility

## Priority

**HIGH** - Large file is a maintainability risk

## Estimate

~80K tokens (refactor category x0.5 adjustment = ~40K effective)

## Category

refactor

## Impact

- Improved code maintainability
- Easier to test individual components
- Clearer separation of concerns
- Reduced risk when modifying database code

## Dependencies

- Consider adding tests first (BACKLOG-191) to ensure refactor doesn't break anything

## Related Items

- BACKLOG-058: Split databaseService.ts (previous split, already completed)
- BACKLOG-082: Database service architecture (related planning)

## Notes

BACKLOG-058 was completed in SPRINT-002 and reduced the file significantly. However, the file has grown back to 1,223 lines and needs another round of extraction.
