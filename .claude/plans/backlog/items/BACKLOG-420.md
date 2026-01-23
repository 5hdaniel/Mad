# BACKLOG-420: Broker Portal - Attachments Not Displaying

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P1 (High)
**Category**: Bug Fix
**Sprint**: SPRINT-050
**Estimate**: ~15K tokens

---

## Problem

Attachments are not displaying at all on the broker portal when viewing a submission.

## Expected Behavior

- Attachments uploaded with the submission should be visible
- Broker should be able to view/download attachments

## Investigation Needed

1. Are attachments being uploaded to Supabase Storage? (Check BACKLOG-393)
2. Are attachment records being created in `submission_attachments` table?
3. Is the portal querying attachments correctly?
4. Is there an RLS policy blocking access?

## Related

- BACKLOG-393: Desktop - Attachment Upload Service
- BACKLOG-401: Portal - Message & Attachment Viewer
- BACKLOG-419: Audit and Restore RLS Policies

## Acceptance Criteria

- [ ] Attachments visible on broker portal submission detail
- [ ] Broker can view/download attachments
