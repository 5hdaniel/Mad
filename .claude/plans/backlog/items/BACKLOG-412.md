# BACKLOG-412: Restore "Closed" Filter Tab

**Created**: 2026-01-23
**Priority**: Medium
**Category**: UI
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Restore the "Closed" filter tab that was removed. Users need to see historical/archived transactions.

## Problem

The "Closed" tab was removed from the transaction filter - users can't see historical transactions.

## Solution

Add "Closed" back to the filter tabs, filtering for transactions with status `closed` or `archived`.

## Files to Modify

- Transaction list/filter component
- Filter constants/types

## Acceptance Criteria

- [ ] "Closed" tab visible in filter bar
- [ ] Clicking shows closed/archived transactions
- [ ] Count badge shows correct number

## Related

- BACKLOG-413: Remove detection_status from filter logic
- BACKLOG-414: Add visual separator between status domains
- Phase 2 of schema alignment plan
