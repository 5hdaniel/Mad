# TASK-2107: Fix backup size estimate overflow in iPhone sync progress

**Backlog:** BACKLOG-842
**Sprint:** SPRINT-110
**Status:** Pending
**Priority:** High
**Type:** fix

---

## Problem

When `bytesProcessed` exceeds `estimatedTotalBytes`, the progress UI shows misleading numbers like "10.6 GB / ~1.9 GB" at 99%. The estimate from `idevicebackup2` is inaccurate and can't be fixed upstream.

## Solution

In `src/components/iphone/SyncProgress.tsx`:

1. **Lines 157-173 (progress bar):** When `bytesProcessed > estimatedTotalBytes`, switch to indeterminate progress bar instead of showing >99%.

2. **Lines 199-201 (text display):** When `bytesProcessed > estimatedTotalBytes`, hide the `/ ~{estimatedTotalBytes}` portion and show only the transferred amount.

## Files to Modify

- `src/components/iphone/SyncProgress.tsx`
- `src/components/iphone/__tests__/iphone.test.tsx` (add test case)

## Acceptance Criteria

- [ ] When `bytesProcessed <= estimatedTotalBytes`: show determinate bar + "X GB / ~Y GB"
- [ ] When `bytesProcessed > estimatedTotalBytes`: show indeterminate bar + "X GB transferred" (no estimate)
- [ ] When `estimatedTotalBytes` is 0 or undefined: existing indeterminate/hidden behavior preserved (no regression)
- [ ] Unit test covers all three scenarios
