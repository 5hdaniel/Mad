# BACKLOG-409: Align TypeScript Types with SQLite Schema

**Created**: 2026-01-23
**Priority**: High
**Category**: Schema
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Align TypeScript type definitions with actual SQLite schema to fix schema drift issues.

## Problem

TypeScript types reference fields that don't exist in SQLite:
- `detection_status` referenced in filter logic but doesn't exist
- `archived` exists in TypeScript but not in SQLite CHECK constraint

## Solution

1. Audit all TypeScript interfaces against SQLite schema
2. Remove or add fields to align
3. Update CHECK constraints if needed

## Files to Modify

- `src/types/database.ts`
- `src/types/transaction.ts`
- Related service files

## Acceptance Criteria

- [ ] TypeScript types match SQLite schema exactly
- [ ] No runtime errors from missing fields
- [ ] Type-check passes

## Related

- BACKLOG-410: Add AI detection columns to SQLite
- BACKLOG-411: Update base schema.sql
- Phase 1 of schema alignment plan
