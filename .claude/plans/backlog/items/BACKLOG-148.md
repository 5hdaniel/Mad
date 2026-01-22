# BACKLOG-148: Complete databaseService.ts Migration to db/* Services

## Priority: High

## Category: refactor

## Summary

Complete the Phase 5 migration of `databaseService.ts` (3,877 lines) by wiring delegation to the existing `db/*` domain services created in BACKLOG-058 (PR #137, Dec 2025).

## Current State (2026-01-04)

**Critical Discovery:** The db/* domain services ALREADY EXIST but are not being used.

### What Exists

| Service | Lines | Created |
|---------|-------|---------|
| `db/core/dbConnection.ts` | ~100 | PR #137 |
| `db/userDbService.ts` | 209 | PR #137 |
| `db/transactionDbService.ts` | 364 | PR #137 |
| `db/contactDbService.ts` | 520 | PR #137 |
| `db/communicationDbService.ts` | 396 | PR #137 |
| `db/sessionDbService.ts` | 90 | PR #137 |
| `db/oauthTokenDbService.ts` | 201 | PR #137 |
| `db/feedbackDbService.ts` | 118 | PR #137 |
| `db/auditLogDbService.ts` | 188 | PR #137 |
| `db/llmSettingsDbService.ts` | 213 | PR #137 |
| `db/transactionContactDbService.ts` | 350 | PR #137 |
| `db/index.ts` | - | PR #137 |

### The Problem

`databaseService.ts` (3,877 lines) contains ALL logic duplicated. Phase 5 (wire up delegation) from BACKLOG-058 was never completed.

**Evidence:**
- Only 2 methods delegate: `getOAuthTokenSyncTime`, `updateOAuthTokenSyncTime`
- 37 files still import from `databaseService.ts`
- The db/* services are barely used (1 reference in task docs)

## Solution

### Phase 5: Wire Delegation (TASK-961) - REQUIRED

Transform `databaseService.ts` from a monolithic implementation to a thin facade that delegates to `db/*` services.

**Before:**
```typescript
async createUser(user: User): Promise<void> {
  const db = this.getDb();
  const stmt = db.prepare(`INSERT INTO users ...`);
  // 20+ lines of implementation
}
```

**After:**
```typescript
async createUser(user: User): Promise<void> {
  return userDbService.createUser(user);
}
```

**Target:** Reduce `databaseService.ts` from 3,877 to <500 lines.

### Phase 6: Consumer Migration (TASK-962) - OPTIONAL

Migrate all 37 consumer files from `databaseService.ts` imports to direct `db/*` service imports.

**Recommendation:** DEFER. The facade pattern is a valid long-term architecture:
- Single import point is easier for developers
- No risk of import errors from multiple sources
- Backward compatibility with existing code

## Implementation Phases (REVISED)

### Phase 1-4: COMPLETE (PR #137, Dec 2025)
- [x] Created db/* directory structure
- [x] Created domain service files
- [x] Implemented all domain operations
- [x] Created barrel exports

### Phase 5: Wire Delegation (TASK-961) - SPRINT-023
- [ ] Document method mapping (databaseService.ts -> db/*)
- [ ] Wire all methods to delegate to db/* services
- [ ] Remove duplicate implementation code
- [ ] Verify backward compatibility

### Phase 6: Consumer Migration (TASK-962) - OPTIONAL
- [ ] Migrate 37 consumer files to direct db/* imports
- [ ] Delete databaseService.ts facade
- [ ] Update test imports

## Acceptance Criteria

### Phase 5 (Required)
- [ ] `databaseService.ts` reduced to <500 lines
- [ ] All methods delegate to db/* services
- [ ] No duplicate implementation code
- [ ] All 37 consumer files still work (backward compat)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

### Phase 6 (Optional)
- [ ] All consumers migrated to direct db/* imports
- [ ] `databaseService.ts` deleted
- [ ] No runtime import errors

## Estimated Effort (REVISED)

| Phase | Metric | Estimate | Notes |
|-------|--------|----------|-------|
| Phase 5 | Tokens | ~15-20K | Wiring only, no new code |
| Phase 6 | Tokens | ~20-25K | Import changes only |
| **Total** | **Tokens** | **~35-45K** | Reduced from original ~120K |

**Calibrated (0.5x refactor multiplier):**
| Phase | Calibrated Estimate |
|-------|---------------------|
| Phase 5 | ~15-20K |
| Phase 6 | ~20-25K |

## Dependencies

- **None for Phase 5**
- Phase 6 depends on Phase 5 completion

## Risks

| Risk | Mitigation |
|------|------------|
| Method signature mismatches | Type checking will catch |
| Missing db/* equivalents | Add to db/* services if needed |
| Circular dependencies | Already resolved in db/* |
| Consumer import breakage (Phase 6) | Keep facade as alternative |

## Notes

**History:**
- BACKLOG-058 (Dec 2025): Created db/* services (Phases 1-4)
- PR #137: Merged domain services
- 2026-01-04: Discovered Phase 5 never completed

**This backlog item is the completion of BACKLOG-058's original vision.**

The original item assumed creating the db/* structure from scratch. The revised scope recognizes that structure exists and focuses on:
1. Wiring delegation (Phase 5) - REQUIRED
2. Consumer migration (Phase 6) - OPTIONAL

## Related Items

- **BACKLOG-058**: Original database service split (Phases 1-4 complete)
- **TASK-961**: Wire delegation (SPRINT-023)
- **TASK-962**: Consumer migration (SPRINT-023 - OPTIONAL)
- **TASK-964**: Depends on TASK-961 for clean database layer
