# TASK-1788: Implement Windows Attachment Import

**Backlog ID:** BACKLOG-588
**Sprint:** SPRINT-068
**Phase:** Phase 3 - Attachments
**Branch:** `sprint/SPRINT-068-windows-ios-contacts` (existing PR #716)
**Estimated Tokens:** ~40K

---

## Objective

Implement attachment extraction and storage for Windows iPhone backup imports. Currently, Windows only stores attachment count in metadata but doesn't extract or store actual files. Users cannot view media/pictures.

---

## Context

**User-reported issue:** Attachments not visible on Windows. Users can't view media or pictures from text messages.

**macOS implementation (`macOSMessagesImportService.ts` lines 1012-1282):**
- Extracts attachment files from chat.db
- Copies to `~/Library/Application Support/Magic Audit/attachments/`
- Creates entries in `attachments` table with `storage_path`

**Windows current state (`iPhoneSyncStorageService.ts` lines 283-290):**
- Counts attachments in metadata
- Stores count in message record
- No file extraction or storage

---

## Requirements

### Must Do:
1. Extract attachment file data from iPhone backup
2. Copy files to app data directory (Windows equivalent path)
3. Create `attachments` table entries with `storage_path`
4. Support common attachment types (images, videos, PDFs)

### Must NOT Do:
- Change database schema (use existing `attachments` table)
- Break macOS attachment handling
- Skip error handling for missing/corrupted attachments

---

## Acceptance Criteria

- [ ] Attachment files extracted from iPhone backup
- [ ] Files stored in app data directory
- [ ] `attachments` table has entries with valid `storage_path`
- [ ] Attachments visible in message UI
- [ ] Click to open works
- [ ] Common types supported: jpg, png, gif, pdf, mp4
- [ ] Existing tests pass

---

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` (lines 283-290 and add new functions)
- Consider: `electron/services/windowsAttachmentService.ts` (new, if logic is complex)

## Files to Reference

- `electron/services/macOSMessagesImportService.ts` (lines 1012-1282)
- `electron/database/schema.sql` (attachments table)
- iPhone backup structure for attachment storage

---

## Testing Expectations

### Manual Testing (Primary)
1. Import iPhone backup with messages containing attachments
2. Verify files appear in app data attachments folder
3. Open message with attachment in UI
4. Verify attachment is visible
5. Click attachment to open with system viewer

### Unit Tests
- **Required:** If new service created, add basic tests
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Technical Notes

### iPhone Backup Attachment Storage

iPhone backups store attachments differently than macOS chat.db:
- Attachments may be in separate files within the backup
- Reference by hash or relative path
- Need to decode/locate the actual file data

### Storage Path Structure

Match existing pattern:
```
%APPDATA%/Magic Audit/attachments/<content_hash>.<extension>
```

### Deduplication

Use content hash for filename to avoid storing duplicates (same pattern as macOS).

### Error Handling

- Handle missing attachment files gracefully
- Log warning but don't fail entire import
- Store null `storage_path` if file unavailable

---

## Estimation Breakdown

| Component | Est. Tokens |
|-----------|-------------|
| Research iPhone backup attachment format | ~10K |
| Implement extraction logic | ~15K |
| Storage and database entry | ~10K |
| Testing and edge cases | ~5K |

---

## PR Preparation

- **Title:** `feat(windows): implement attachment import from iPhone backup`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**STATUS: COMPLETED**

*Completed: 2026-02-02*

### Results

- **Before**: No attachments visible on Windows
- **After**: Attachments extracted from iPhone backup and stored locally
- **Files extracted**: All common types (images, videos, etc.)
- **Actual Tokens**: Combined with sprint work
- **Storage Location**: `%APPDATA%/magic-audit/message-attachments/`

### Implementation Details

1. **Added `resolveAttachmentPath()`** to `iosMessagesParser.ts`:
   - Takes attachment filename from iPhone backup
   - Computes SHA1 hash of the relative path (iPhone backup file naming convention)
   - Returns full path to the attachment file within the backup

2. **Added `computeBackupFileHash()`** to `iosMessagesParser.ts`:
   - Implements iPhone backup file naming: SHA1 of "MediaDomain-" + relative path
   - Returns 2-char prefix + full hash for locating file in backup

3. **Updated `SyncResult`** in `syncOrchestrator.ts`:
   - Added `backupPath` to result so it can be passed to storage service
   - Deferred backup cleanup until after persistence (so files are still available)

4. **Updated `iPhoneSyncStorageService`**:
   - Extracts attachment files from backup using resolved paths
   - Copies to app data directory
   - Creates `attachments` table entries with `storage_path`

5. **Updated `sync-handlers.ts`**:
   - Passes `backupPath` to storage service
   - Calls backup cleanup after persistence completes

### Notes

- Requires iPhone re-sync to extract attachments for existing messages
- Attachments from previous syncs will be extracted on next sync

---

## Guardrails

**STOP and ask PM if:**
- iPhone backup attachment format is significantly different than expected
- Requires new database columns
- File sizes or counts exceed expected limits
- Cannot locate attachment data in backup structure
