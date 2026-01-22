# TASK-1110 Implementation Plan: Fix iMessage Attachments Stale ID

## Problem Statement

iMessage picture attachments show "[Attachment]" placeholder instead of displaying. Attachment records have stale `message_id` values that don't match current message records because:

1. Messages get new UUIDs on re-import (`crypto.randomUUID()`)
2. Attachments store `message_id` (internal UUID)
3. On re-import, message UUIDs change but attachment `message_id` references become stale

## Root Cause

In `storeAttachments()`, attachments are linked using the internal `message_id` which changes on every import. The `messageIdMap` only tracks messages from the current import batch. When messages are re-imported with new UUIDs, existing attachments lose their link.

## Solution: Add Stable External ID for Attachments

### Approach: Hybrid of Options A and B

1. **Add `external_message_id` column** - Store macOS message GUID (stable identifier)
2. **Update attachment queries** - Query by both `message_id` AND `external_message_id` for backward compatibility
3. **Auto-repair on query** - If `message_id` doesn't match but `external_message_id` does, return the attachment

### Why This Approach

- **No schema migration required for existing users** - Queries will work with or without `external_message_id`
- **Forward compatible** - New imports will have stable IDs
- **Backward compatible** - Existing attachments can be found via repair function or re-import
- **No data loss** - Attachment files remain intact, only DB references need fixing

## Implementation Steps

### Step 1: Schema Update

Add `external_message_id` column to attachments table in `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  external_message_id TEXT,  -- NEW: macOS message GUID for stable linking
  ...
);
```

Add index for efficient lookup:
```sql
CREATE INDEX IF NOT EXISTS idx_attachments_external_message_id ON attachments(external_message_id);
```

### Step 2: Update Import Service

In `macOSMessagesImportService.ts`:

1. **Update `storeAttachments()`** to store `external_message_id` (the macOS message GUID)
2. **Update insert statement** to include the new column
3. **Update deduplication logic** to use `external_message_id` for matching

### Step 3: Update Attachment Queries

In `getAttachmentsByMessageId()` and `getAttachmentsByMessageIds()`:

1. First try to match by `message_id` (current behavior)
2. If no match, fallback to `external_message_id` lookup
3. This ensures both old and new attachments are found

### Step 4: Migration for Database Service

In `databaseService.ts`, add migration to:

1. Add `external_message_id` column if not exists
2. Optionally populate existing records from macOS Messages DB

### Step 5: Tests

Add tests for:
- Attachment linking with external_id
- Re-import updates message_id correctly
- Attachment query returns correct results with fallback

## Files to Modify

1. `electron/database/schema.sql` - Add external_message_id column
2. `electron/services/macOSMessagesImportService.ts` - Update import and query logic
3. `electron/services/databaseService.ts` - Add migration
4. `electron/services/__tests__/macOSMessagesImportService.attachments.test.ts` - Add tests

## Risk Assessment

- **Low risk** - Schema change is additive (new column, nullable)
- **No breaking changes** - Existing queries continue to work
- **Data integrity** - Attachment files are not touched, only DB references

## Testing Plan

1. Unit tests for attachment utility functions
2. Integration test: Import messages with attachments, verify display
3. Integration test: Re-import messages, verify attachments still display
4. Manual verification with actual macOS Messages database

## Acceptance Criteria

- [ ] Picture attachments display correctly in conversation view
- [ ] No manual repair step required after import
- [ ] Existing attachment files are properly linked
- [ ] GIF attachments continue to work (no regression)
- [ ] New imports create correct attachment associations
- [ ] Re-imports don't create duplicate attachments
- [ ] All existing tests pass
- [ ] All CI checks pass
