# BACKLOG-148: Split databaseService.ts into Domain-Specific Services

## Priority: High

## Category: refactor

## Summary

Split the monolithic `databaseService.ts` (3,877 lines) into domain-specific services following separation of concerns.

## Problem

`electron/services/databaseService.ts` at 3,877 lines is a massive monolith handling ALL database operations:
- User management
- Transaction operations
- Contact management
- Communications storage
- Session handling
- Token storage
- And more

This violates single responsibility principle and creates:
- Merge conflicts when multiple tasks touch database operations
- Difficulty testing individual domains
- Slow IDE performance
- High cognitive load for developers

**Note:** BACKLOG-058 addressed a similar issue in SPRINT-002, but the file has regrown significantly.

## Solution

Split into domain-specific services:

### Target Structure

```
electron/services/
+-- database/
    +-- index.ts                    # Re-exports all services
    +-- core/
    |   +-- databaseCore.ts         # Connection, encryption, migrations
    |   +-- types.ts                # Shared database types
    +-- domains/
    |   +-- userDbService.ts        # User CRUD operations
    |   +-- transactionDbService.ts # Transaction operations
    |   +-- contactDbService.ts     # Contact management
    |   +-- communicationDbService.ts # Email/SMS storage
    |   +-- sessionDbService.ts     # Session management
    |   +-- tokenDbService.ts       # OAuth token storage
    +-- __tests__/
        +-- userDbService.test.ts
        +-- transactionDbService.test.ts
        +-- (etc.)
```

## Implementation Phases

### Phase 1: Analysis (~1 hour)
1. Catalog all database operations in current file
2. Group by domain (user, transaction, contact, etc.)
3. Identify shared utilities and types
4. Map dependencies between domains

### Phase 2: Core Extraction (~2 hours)
1. Extract connection management to `databaseCore.ts`
2. Extract shared types to `types.ts`
3. Keep encryption logic centralized
4. Update main service to use core

### Phase 3: Domain Extraction (~4-6 hours)
1. Extract user operations to `userDbService.ts`
2. Extract transaction operations to `transactionDbService.ts`
3. Extract contact operations to `contactDbService.ts`
4. Extract communication operations to `communicationDbService.ts`
5. Extract session/token operations

### Phase 4: Integration (~1 hour)
1. Create barrel exports
2. Update all imports across codebase
3. Verify all tests pass
4. Integration testing

## Acceptance Criteria

- [ ] `databaseService.ts` reduced to <500 lines (or eliminated entirely)
- [ ] At least 5 domain services extracted
- [ ] All functionality preserved (no behavior changes)
- [ ] All existing tests pass
- [ ] New unit tests for each domain service
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Estimate | Notes |
|--------|----------|-------|
| Tokens | ~120K | Large extraction, many files |
| Duration | 1-2 days | Sequential execution recommended |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Tokens | ~60K |

## Dependencies

- None blocking
- Should be executed BEFORE tasks touching database operations to avoid conflicts

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing imports | Search/replace with verification |
| Circular dependencies | Careful dependency analysis in Phase 1 |
| Database connection state | Keep connection management in single core module |
| Race condition regressions | Integration tests for concurrent operations |

## Notes

**This item is SR Engineer sourced from architecture review (2026-01-04).**

This is a high-impact refactoring that will reduce merge conflicts in future sprints. Consider breaking into multiple TASKs:
- TASK-A: Analysis + Core extraction
- TASK-B: User + Transaction domain extraction
- TASK-C: Contact + Communication domain extraction
- TASK-D: Session/Token + Integration
