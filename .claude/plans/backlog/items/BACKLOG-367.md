# BACKLOG-367: Consolidate Duplicate Export Date Columns

**Created**: 2026-01-21
**Priority**: Moderate
**Category**: Technical Debt / Schema Cleanup
**Status**: Pending
**Source**: SR Engineer Database Audit (ISSUE-004)

---

## Problem Statement

The `transactions` table has TWO columns tracking last export timestamp:

1. `last_exported_at` - In main schema.sql (line 342)
2. `last_exported_on` - Added by add_export_tracking.sql migration (line 32)

This duplication causes:
- Confusion about which column to use
- Potential data inconsistency (one updated, other not)
- Wasted storage
- Trigger complexity

## Evidence

**schema.sql (line 342):**
```sql
last_exported_at DATETIME,
```

**add_export_tracking.sql migration:**
```sql
-- Step 4: Rename export_generated_at to last_exported_on for clarity
ALTER TABLE transactions ADD COLUMN last_exported_on DATETIME;

-- Migrate existing export_generated_at data to last_exported_on
UPDATE transactions SET last_exported_on = export_generated_at WHERE export_generated_at IS NOT NULL;
```

**Also in migration (line 48-57):**
```sql
CREATE TRIGGER IF NOT EXISTS update_transaction_export_timestamp
AFTER UPDATE OF export_status ON transactions
WHEN NEW.export_status = 'exported'
BEGIN
  UPDATE transactions
  SET
    last_exported_on = CURRENT_TIMESTAMP,
    export_count = COALESCE(export_count, 0) + 1
  WHERE id = NEW.id ...
END;
```

## Required Changes

### 1. Determine Canonical Column
- **Recommendation:** Use `last_exported_at` (matches schema naming convention: `*_at` for timestamps)
- Or use `last_exported_on` if already in production with data

### 2. Migration Script
- Copy data from deprecated column to canonical column
- Update trigger to use canonical column
- Drop deprecated column

### 3. Service Updates
- Search for all references to both column names
- Update to use canonical column only

### 4. Schema Update
- Remove deprecated column definition
- Keep only one export timestamp column

## Acceptance Criteria

- [ ] Single export timestamp column in schema
- [ ] All services use the same column name
- [ ] Trigger updated to use canonical column
- [ ] Migration preserves existing data
- [ ] No code references deprecated column name

## Estimation

- **Category:** database/migration
- **Estimated Tokens:** ~4K
- **Risk:** Low (straightforward consolidation)

## Related

- add_export_tracking.sql: Migration that added duplicate
- transactionService.ts: May reference export columns
- Export services: folderExportService, pdfExportService, enhancedExportService
