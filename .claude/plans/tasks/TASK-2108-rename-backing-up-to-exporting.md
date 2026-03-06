# TASK-2108: Rename "Backing up" to "Exporting" in iPhone sync UI

**Backlog:** BACKLOG-843
**Sprint:** SPRINT-110
**Status:** Pending
**Priority:** Medium
**Type:** fix

---

## Problem

The sync progress UI says "Backing up - Keep connected" which is technically accurate (idevicebackup2 creates a backup) but confusing to users who think of "exporting" their messages.

## Solution

In `src/components/iphone/SyncProgress.tsx`:

1. **Line 49:** Change `"Backing up - Keep connected"` to `"Exporting - Keep connected"`
2. Review any other "backup" / "backing up" user-facing copy in the same file and update to "export" / "exporting" terminology.

**Do NOT rename:**
- Internal variable names, types, or phases (e.g., `backing_up` phase enum stays)
- Log messages or developer-facing strings

## Files to Modify

- `src/components/iphone/SyncProgress.tsx` (user-facing strings only)

## Acceptance Criteria

- [ ] Phase title shows "Exporting - Keep connected" instead of "Backing up - Keep connected"
- [ ] Line 293 "backup completes" also updated to "export completes"
- [ ] No internal/developer-facing strings changed
- [ ] Existing tests still pass (update assertions if they check the title text)
