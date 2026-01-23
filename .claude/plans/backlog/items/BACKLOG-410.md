# BACKLOG-410: Add AI Detection Columns to SQLite

**Created**: 2026-01-23
**Priority**: High
**Category**: Schema
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Add missing AI detection columns to SQLite schema that TypeScript expects.

## Columns to Add

```sql
ALTER TABLE transactions ADD COLUMN detection_status TEXT;
ALTER TABLE transactions ADD COLUMN detection_confidence REAL;
ALTER TABLE transactions ADD COLUMN detected_at TEXT;
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
