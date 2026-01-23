# BACKLOG-411: Update Base schema.sql

**Created**: 2026-01-23
**Priority**: High
**Category**: Schema
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Update the base schema.sql file to include all columns and constraints that have been added via migrations.

## Changes

1. Add `detection_status`, `detection_confidence`, `detected_at` columns
2. Update CHECK constraints to include `archived` status
3. Add any other missing columns from migrations

## File to Modify

- `electron/database/schema.sql`

## Acceptance Criteria

- [ ] Fresh installs get complete schema
- [ ] Schema matches migrated databases
- [ ] All CHECK constraints are correct

## Related

- BACKLOG-409: Align TypeScript types
- BACKLOG-410: Add AI detection columns
- Phase 1 of schema alignment plan
