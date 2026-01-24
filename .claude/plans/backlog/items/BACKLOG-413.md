# BACKLOG-413: Remove detection_status from Filter Logic

**Created**: 2026-01-23
**Priority**: Medium
**Category**: Refactor
**Status**: Pending
**Sprint**: SPRINT-054

---

## IMPORTANT: Clarification Note (Added 2026-01-23)

**SR Engineer Review Finding**: The description below is INACCURATE.

The `detection_status` column DOES exist in `schema.sql` (lines 356-362):
```sql
detection_status TEXT DEFAULT 'confirmed' CHECK (detection_status IN ('pending', 'confirmed', 'rejected'))
```

**Updated Scope**: This task should:
1. Investigate WHY filter logic "works by accident" - the column exists
2. Determine if the issue is:
   - Filter queries not matching schema column name
   - Migration not applied to some databases
   - Filter referencing wrong status domain (transaction status vs detection status)
3. Fix the actual issue once root cause is identified

**Possible Real Issue**: Filter tabs may be conflating `detection_status` (AI detection result) with `status` (transaction lifecycle) or `submission_status` (broker review). The fix may be to clarify which status domain each filter tab uses.

**See Also**: BACKLOG-410 also references detection columns - the column DOES exist.

---

## Description

~~Remove `detection_status` from filter logic - it's referenced but doesn't exist in SQLite (currently works by accident).~~

**UPDATED**: Investigate and fix filter logic's use of `detection_status`. The column exists; the issue is likely domain confusion between different status fields.

## Problem

~~Filter logic references `detection_status` field that doesn't exist in the database. It works by accident but is incorrect.~~

**UPDATED**: Filter logic may be incorrectly mixing status domains (transaction status vs detection status vs submission status).

## Solution

1. ~~Remove all references to `detection_status` in filter logic~~ **UPDATED**: Investigate actual issue
2. Clarify which status domain each filter tab uses:
   - `status`: Transaction lifecycle (pending, active, closed, rejected)
   - `detection_status`: AI detection result (pending, confirmed, rejected)
   - `submission_status`: Broker review (not_submitted, submitted, under_review, etc.)
3. Ensure filter queries match the correct column for their purpose

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
