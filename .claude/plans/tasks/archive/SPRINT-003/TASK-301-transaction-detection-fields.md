# Task TASK-301: Add Detection Fields to Transactions Table

## Goal

Add database columns to the existing `transactions` table to support AI detection tracking, including source, status, confidence, and suggested contacts storage.

## Non-Goals

- Do NOT create a separate `detected_transactions` table
- Do NOT modify existing columns in the transactions table
- Do NOT add UI components in this task
- Do NOT implement the detection logic itself

## Deliverables

1. Update: `electron/services/databaseService.ts` - Add Migration 008 (partial)
2. Update: `electron/types/models.ts` - Add detection fields to Transaction interface

## Acceptance Criteria

- [ ] Migration adds 7 columns to transactions table with proper defaults
- [ ] Existing transactions unaffected (detection_source='manual', detection_status='confirmed')
- [ ] TypeScript Transaction interface updated with all new fields
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] npm run type-check passes
- [ ] npm run lint passes

## Implementation Notes

### Migration SQL

Add to `_runAdditionalMigrations()` in databaseService.ts:

```typescript
// Migration 008: AI Detection Fields (Part 1 - Transactions)
if (currentVersion < 8) {
  // Check if columns already exist (idempotent)
  const tableInfo = db.pragma('table_info(transactions)');
  const existingColumns = tableInfo.map((col: any) => col.name);

  if (!existingColumns.includes('detection_source')) {
    db.exec(`
      ALTER TABLE transactions ADD COLUMN detection_source TEXT DEFAULT 'manual'
        CHECK (detection_source IN ('manual', 'auto', 'hybrid'));
    `);
  }
  if (!existingColumns.includes('detection_status')) {
    db.exec(`
      ALTER TABLE transactions ADD COLUMN detection_status TEXT DEFAULT 'confirmed'
        CHECK (detection_status IN ('pending', 'confirmed', 'rejected'));
    `);
  }
  if (!existingColumns.includes('detection_confidence')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN detection_confidence REAL;`);
  }
  if (!existingColumns.includes('detection_method')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN detection_method TEXT;`);
  }
  if (!existingColumns.includes('suggested_contacts')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN suggested_contacts TEXT;`);
  }
  if (!existingColumns.includes('reviewed_at')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN reviewed_at DATETIME;`);
  }
  if (!existingColumns.includes('rejection_reason')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN rejection_reason TEXT;`);
  }

  // Note: Don't increment version yet - wait for all Phase 1 tasks
}
```

### TypeScript Interface Update

In `electron/types/models.ts`, update the Transaction interface:

```typescript
export interface Transaction {
  // ... existing fields ...

  // AI Detection fields (Migration 008)
  detection_source?: 'manual' | 'auto' | 'hybrid';
  detection_status?: 'pending' | 'confirmed' | 'rejected';
  detection_confidence?: number;
  detection_method?: string;  // 'pattern' | 'llm' | 'hybrid'
  suggested_contacts?: string;  // JSON string
  reviewed_at?: string;
  rejection_reason?: string;
}
```

### Important Details

- All new columns are nullable or have defaults to preserve existing data
- `detection_source` defaults to 'manual' for backwards compatibility
- `detection_status` defaults to 'confirmed' so existing transactions remain valid
- `suggested_contacts` stores JSON array of suggested contact assignments
- Migration version increment deferred to TASK-305 after all schema tasks complete

## Integration Notes

- Imports from: None (modifies existing service)
- Exports to: None (schema only)
- Used by: TASK-305 (Migration Testing), future detection services
- Depends on: None (can start immediately)

## Do / Don't

### Do:
- Use `ALTER TABLE` for each column separately (SQLite limitation)
- Check if column exists before adding (idempotent)
- Use CHECK constraints for enum-like fields
- Follow existing migration patterns in databaseService.ts

### Don't:
- Don't use single ALTER TABLE with multiple columns (SQLite doesn't support)
- Don't increment schema_version yet (wait for TASK-305)
- Don't add indexes yet (can be added later if needed)
- Don't modify existing column definitions

## When to Stop and Ask

- If the transactions table structure differs significantly from expected
- If there are existing detection-related columns with different names
- If the migration pattern in databaseService.ts is different than documented
- If CHECK constraints cause issues with existing data

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (migration testing in TASK-305)
- New tests to write: None for this task
- Existing tests to update: None

### Coverage

- Coverage impact: No change (SQL migrations not covered by Jest)

### Integration / Feature Tests

- Required scenarios: Covered by TASK-305

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (npm run type-check)
- [ ] Lint / format checks (npm run lint)

**Note:** Full migration testing deferred to TASK-305.

## PR Preparation

- **Branch**: `feature/TASK-301-transaction-detection-fields`
- **Title**: `feat(db): add detection fields to transactions table`
- **Labels**: `database`, `ai-mvp`, `sprint-004`
- **Depends on**: None

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files modified:
- [ ] electron/services/databaseService.ts (Migration 008 partial)
- [ ] electron/types/models.ts (Transaction interface)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] App starts without errors (npm run dev)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any deviations, explain what and why. Use "DEVIATION:" prefix>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything reviewer should pay attention to>

---

## SR Engineer Review Notes

**Review Date:** 2025-12-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** int/schema-foundation
- **Suggested Branch Name:** feature/TASK-301-transaction-detection-fields

### Execution Classification
- **Parallel Safe:** Yes (with TASK-302, TASK-303, TASK-304)
- **Depends On:** None
- **Blocks:** TASK-305 (Migration Testing)

### Shared File Analysis
- Files modified:
  - `electron/services/databaseService.ts` (Migration 008 partial)
  - `electron/types/models.ts` (Transaction interface)
- Conflicts with:
  - TASK-302: Both modify `databaseService.ts` (Migration 008) - **MERGE ORDER CRITICAL**
  - TASK-303: Both modify `databaseService.ts` (Migration 008) - **MERGE ORDER CRITICAL**
  - TASK-302, TASK-303: All modify `models.ts` - Additive, low conflict risk

### Technical Considerations
- Migration 008 is partial - version increment deferred to TASK-305
- All columns are nullable or have defaults, preserving existing data
- CHECK constraints for enum fields (detection_source, detection_status)
- SQLite requires separate ALTER TABLE for each column
- Must check if columns exist before adding (idempotent)
- **Merge Order:** Can merge in any order with 301-304, but must resolve databaseService.ts conflicts during integration merge

### Integration Branch Note
- Integration branch `int/schema-foundation` must be created from `develop` before parallel execution begins
- All Phase 1 parallel tasks (301-304) merge to this integration branch
- SR Engineer will create the branch when sprint execution begins
