# BACKLOG-602: Attachment Skip Diagnostic Logging for iCloud

## Summary

During iPhone sync, 59,375 attachments were skipped vs only 14 stored. SR Engineer confirmed this is a platform limitation (iCloud storage), not a bug. Add diagnostic logging to confirm the root cause breakdown.

## Problem

When syncing iPhone messages, the vast majority of attachments are skipped. While this is expected behavior (iCloud-stored attachments aren't available locally), there's no detailed breakdown of WHY each attachment was skipped.

## Background

SR Engineer review confirmed:
- iCloud attachments are not stored locally in the backup
- This is an Apple platform limitation, not a bug in our code
- Users with iCloud Photos/Messages enabled will have most attachments unavailable

## Proposed Solution

Add diagnostic logging to `iPhoneSyncStorageService.ts` that categorizes skipped attachments:

1. **iCloud stored** - attachment path points to iCloud, file not in backup
2. **File not found** - path exists but file missing from backup
3. **Unsupported type** - file type not supported for extraction
4. **Size limit exceeded** - file exceeds size limit
5. **Extraction failed** - file exists but extraction failed

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` - Add categorized skip logging

## Acceptance Criteria

- [ ] Skipped attachments logged with reason category
- [ ] Summary log at end of sync showing breakdown by reason
- [ ] No change to actual attachment extraction behavior
- [ ] Logs are INFO level (not ERROR - this is expected)

## Priority

**LOW** - Diagnostic only, not a bug fix. Deferred to future sprint.

## Status

**DEFERRED** - Not a bug, just diagnostic improvement

## Estimated Tokens

~5K

## Created

2026-02-02 (discovered during SPRINT-068 testing)
