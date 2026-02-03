# BACKLOG-603: iCloud Attachment Limitation UX Message

## Summary

Users don't know why most attachments from their iPhone are unavailable after sync. Add an info box to the sync completion screen explaining the iCloud limitation.

## Problem

After iPhone sync, users see very few attachments stored (e.g., 14 out of 59,375). Without explanation, users may think:
- The sync failed
- There's a bug in the app
- They need to try again

In reality, this is an Apple platform limitation - attachments stored in iCloud are not available in local backups.

## Proposed Solution

Add an informational message to the sync completion screen in `SyncProgress.tsx`:

```
-------------------------------------------
[i] About iPhone Attachments

Most iPhone attachments are stored in iCloud and aren't
included in local backups. To view more attachments:
- Disable iCloud Photos
- Wait for photos to download to device
- Create a new backup and sync again

This is a limitation of how Apple stores data, not a
bug in Magic Audit.
-------------------------------------------
```

## Conditions to Show

Only show when:
1. Platform is Windows (iPhone backup sync)
2. Attachments were processed during sync
3. Skip ratio is high (e.g., >90% skipped)

## Files to Modify

- `src/components/sync/SyncProgress.tsx` - Add conditional info box

## Acceptance Criteria

- [ ] Info box appears after iPhone sync with high skip ratio
- [ ] Message clearly explains iCloud limitation
- [ ] User understands this is Apple limitation, not app bug
- [ ] Info box doesn't appear for macOS sync or low skip ratio
- [ ] Styling consistent with other info boxes in app

## Priority

**MEDIUM** - User awareness/education

## Estimated Tokens

~8K

## Created

2026-02-02 (discovered during SPRINT-068 testing)
