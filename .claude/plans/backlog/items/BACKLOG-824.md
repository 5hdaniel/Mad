# BACKLOG-824: Message Import Progress Bar Jumps from 67% to 100%

**Type:** Bug
**Area:** UI
**Priority:** Low
**Status:** Pending
**Created:** 2026-02-27

## Description

During message import, the progress bar jumps from ~67% directly to 100%. This happens because the attachments phase (Phase 3 of message import) only reports progress every 500 attachments.

Most users have fewer than 500 attachments, so the attachments phase never reports intermediate progress — it goes from "messages complete" (~67%) straight to "done" (100%).

## Root Cause

In `electron/services/macOSMessagesImportService.ts` (around line 1182), the attachment processing loop has a progress reporting interval of 500:

```typescript
if (i % 500 === 0) {
  // report progress
}
```

For users with < 500 attachments, this condition is never true during the loop, so no progress is reported between the end of message processing and the completion callback.

## Proposed Fix

Reduce the reporting interval to something more granular (e.g., 50 or 100), or use a percentage-based approach that reports at every 5% or 10% increment regardless of total count.

## Acceptance Criteria

- [ ] Progress bar shows smooth increments through the attachments phase
- [ ] Works correctly for users with both small (< 100) and large (> 1000) attachment counts
- [ ] No performance regression from more frequent progress reporting
