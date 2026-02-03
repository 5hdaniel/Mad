# BACKLOG-588: Windows Attachments Not Imported

**Priority:** High
**Category:** Bug (Platform Parity)
**Source:** SPRINT-068 testing
**Related PR:** #716

## Problem

On Windows, message attachments are not being imported. macOS imports message attachments to the `attachments` table and copies files to local storage, but Windows only stores attachment count in metadata with no actual file storage.

Users cannot view media/pictures or click on attachments when using Windows.

## Root Cause

The Windows import service (`iPhoneSyncStorageService.ts`) only tracks attachment metadata but doesn't:
1. Extract attachment files from iPhone backup
2. Copy files to local storage
3. Create entries in `attachments` table with `storage_path`

## macOS Reference

`macOSMessagesImportService.ts` lines 1012-1282 implement:
- Attachment extraction from chat.db
- File copying to `~/Library/Application Support/Magic Audit/attachments/`
- `attachments` table entries with `storage_path`

## Windows Gap

`iPhoneSyncStorageService.ts` lines 283-290 only:
- Count attachments in metadata
- Store count in message record
- No file extraction or storage

## Deliverables

1. Implement attachment extraction from iPhone backup on Windows
2. Copy attachment files to app data directory
3. Create `attachments` table entries with `storage_path`
4. Ensure attachment viewing works the same as macOS

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` - Add attachment extraction logic
- Potentially create new `windowsAttachmentService.ts` for clarity

## Files to Reference

- `electron/services/macOSMessagesImportService.ts` (lines 1012-1282)

## Estimate

~40K tokens (significant new functionality)

## User Impact

High - Users cannot view any message attachments on Windows.
