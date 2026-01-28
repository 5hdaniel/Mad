# BACKLOG-410: Add AI Detection Columns to SQLite

**Created**: 2026-01-23
**Priority**: High
**Category**: Schema
**Status**: Pending
**Sprint**: SPRINT-053

---

## IMPORTANT: Clarification Note (Added 2026-01-23)

**SR Engineer Review Finding**: The description below is PARTIALLY OUTDATED.

After schema audit, the following columns ALREADY EXIST in `schema.sql` (lines 355-362):
- `detection_source TEXT` - already exists
- `detection_status TEXT` - already exists
- `detection_confidence REAL` - already exists
- `detection_method TEXT` - already exists

The only column that may be missing is `detected_at` (not currently in schema).

**Updated Scope**: This task should:
1. Verify which columns exist in the LIVE database (migrations may not have run)
2. Create migration ONLY for truly missing columns
3. Verify TypeScript types match schema

**See Also**: BACKLOG-413 references removing `detection_status` from filter logic, but the column DOES exist in schema.

---

## Description

Add missing AI detection columns to SQLite schema that TypeScript expects.

## Columns to Verify/Add

```sql
-- These MAY already exist - verify first!
ALTER TABLE transactions ADD COLUMN detection_status TEXT;
ALTER TABLE transactions ADD COLUMN detection_confidence REAL;
ALTER TABLE transactions ADD COLUMN detected_at TEXT;  -- This one may be truly missing
```

## Migration

Create migration file: `migrations/XXXX_add_detection_columns.sql`

## Acceptance Criteria

- [ ] Migration adds columns without data loss
- [ ] Existing transactions unaffected
- [ ] TypeScript types align with new columns

## Related

- BACKLOG-409: Align TypeScript types
- BACKLOG-411: Update base schema.sql
- Phase 1 of schema alignment plan
