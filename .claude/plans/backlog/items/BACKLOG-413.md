# BACKLOG-413: Remove detection_status from Filter Logic

**Created**: 2026-01-23
**Priority**: Medium
**Category**: Refactor
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Remove `detection_status` from filter logic - it's referenced but doesn't exist in SQLite (currently works by accident).

## Problem

Filter logic references `detection_status` field that doesn't exist in the database. It works by accident but is incorrect.

## Solution

1. Remove all references to `detection_status` in filter logic
2. Ensure filters work correctly without this field
3. Add proper filtering once AI detection is implemented (Phase 4)

## Files to Modify

- Filter component(s)
- Filter utility functions

## Acceptance Criteria

- [ ] No references to `detection_status` in filter logic
- [ ] Filters still work correctly
- [ ] No console errors

## Related

- BACKLOG-412: Restore "Closed" filter tab
- BACKLOG-410: Add AI detection columns (for future use)
- Phase 2 of schema alignment plan
