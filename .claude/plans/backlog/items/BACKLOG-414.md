# BACKLOG-414: Add Visual Separator Between Status Domains

**Created**: 2026-01-23
**Priority**: Low
**Category**: UI
**Status**: Pending
**Sprint**: SPRINT-051

---

## Description

Add visual separator in the filter tabs between different status domains (Local vs Submission).

## Problem

Filter tabs mix local transaction statuses (All, Active, Closed) with submission statuses (Submitted, Under Review, Needs Changes, Approved) without clear separation.

## Solution

Add a visual divider or grouping between:
- Local statuses: All | Active | Closed
- Submission statuses: Submitted | Under Review | Needs Changes | Approved

## Mockup

```
[All] [Active] [Closed] | [Submitted] [Under Review] [Needs Changes] [Approved]
                        ^
                     separator
```

## Acceptance Criteria

- [ ] Visual separator between status domains
- [ ] Clear grouping of related statuses
- [ ] Maintains existing filter functionality

## Related

- BACKLOG-412: Restore "Closed" filter tab
- BACKLOG-413: Remove detection_status from filter logic
- Phase 2 of schema alignment plan
