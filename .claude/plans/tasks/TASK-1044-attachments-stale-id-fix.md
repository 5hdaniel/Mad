# TASK-1044: Fix iMessage Attachments Stale ID

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1044 |
| **Sprint** | SPRINT-035 |
| **Backlog Item** | BACKLOG-221 |
| **Priority** | HIGH |
| **Phase** | 2 |
| **Estimated Tokens** | ~45K |
| **Token Cap** | 180K |

---

## Problem Statement

iMessage picture attachments are not displaying in conversation views. GIF attachments work, but regular images show "[Attachment]" placeholder. The root cause is that attachment records in the database have stale `message_id` values that don't match current message records.

**29K+ attachment files exist on disk but aren't displaying because the ID references are broken.**

---

## Current Behavior

1. Pictures show "[Attachment]" placeholder in conversation view
2. GIFs display correctly (some records have matching IDs)
3. Debug logs show "0 attachments" returned for queries
4. Attachment files exist on disk (29K+ files in storage directory)

---

## Expected Behavior

1. All picture attachments display in conversation view
2. No "[Attachment]" placeholder for images that exist
3. Attachments load correctly after import
4. No manual repair step required

---

## Root Cause

Attachment records were created during a previous import with old `message_id` values. When messages were re-imported (possibly via Force Re-import), they received new UUIDs, but existing attachment records still reference the old `message_id` values.

```
Initial Import:
  message_1 (UUID: abc-123) -> attachment_1 (message_id: abc-123)

Re-import:
  message_1 (UUID: xyz-789) -> attachment_1 still has (message_id: abc-123)  // STALE!
```

---

## Workarounds (Currently Available)

1. **Repair function** - `await window.api.messages.repairAttachments()` in dev console
2. **Full re-import** - Creates fresh attachment associations

**Goal:** Make these workarounds unnecessary by fixing the root cause.

---

## Technical Approach

### Option A: Store External ID for Reliable Lookup (Recommended)

Store the iMessage GUID in the attachments table for reliable lookup:

```sql
-- Add external_id column to attachments table
ALTER TABLE attachments ADD COLUMN external_id TEXT;
CREATE INDEX idx_attachments_external_id ON attachments(external_id);
```

```typescript
// During import, store the iMessage attachment GUID
interface Attachment {
  id: string;          // Internal UUID
  message_id: string;  // Internal message UUID
  external_id: string; // iMessage attachment GUID - RELIABLE
  file_path: string;
  // ...
}

// Lookup can use external_id instead of message_id
const attachments = await db.query(
  'SELECT * FROM attachments WHERE external_id = ?',
  [imessageAttachmentGuid]
);
```

### Option B: Re-create Attachment Records on Import

Always rebuild attachment records during import:

```typescript
// During import
async function importMessages(messages: iMessage[]) {
  for (const msg of messages) {
    const messageId = await insertOrUpdateMessage(msg);

    // Always re-create attachment associations
    await deleteAttachmentsForMessage(messageId);
    for (const attachment of msg.attachments) {
      await createAttachment(messageId, attachment);
    }
  }
}
```

**Cons:** May lose attachment-specific metadata if we had any.

### Option C: Run Repair Automatically After Import

```typescript
// After import completes
async function importMessages() {
  // ... import logic
  await repairAttachments();
}
```

**Cons:** Band-aid fix, doesn't address root cause.

---

## Recommended Approach: Option A

Store `external_id` (iMessage GUID) in attachments table:

1. **Migration:** Add `external_id` column
2. **Import Update:** Store external_id during attachment creation
3. **Lookup Update:** Use external_id when available for reliable matching
4. **Repair Logic:** Use external_id to match orphaned attachments to messages

---

## Implementation Plan

### Step 1: Database Migration

```typescript
// Migration: Add external_id to attachments
export async function up(db: Database) {
  await db.exec(`
    ALTER TABLE attachments ADD COLUMN external_id TEXT;
    CREATE INDEX idx_attachments_external_id ON attachments(external_id);
  `);
}
```

### Step 2: Update Import Service

```typescript
// macOSMessagesImportService.ts
async function importAttachment(messageId: string, attachment: iMessageAttachment) {
  await db.run(`
    INSERT INTO attachments (id, message_id, external_id, file_path, ...)
    VALUES (?, ?, ?, ?, ...)
  `, [uuid(), messageId, attachment.guid, attachment.path, ...]);
}
```

### Step 3: Update Attachment Lookup

```typescript
// When fetching attachments for display
async function getAttachmentsForMessage(messageId: string) {
  return await db.all(`
    SELECT * FROM attachments WHERE message_id = ?
  `, [messageId]);
}
```

### Step 4: Repair Existing Data

```typescript
// One-time repair for existing data
async function repairExistingAttachments() {
  // Match attachments to messages using iMessage GUID
  // Update message_id references
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/db/migrations/` | New migration for external_id column |
| `electron/services/macOSMessagesImportService.ts` | Store external_id during import |
| `electron/services/db/messageDbService.ts` | Update attachment queries |
| `electron/handlers/message-handlers.ts` | Update repair function |

---

## Acceptance Criteria

- [ ] Picture attachments display in conversation view
- [ ] No "[Attachment]" placeholder for images that exist on disk
- [ ] New imports correctly associate attachments
- [ ] Re-imports don't break existing attachments
- [ ] No manual repair step required after import
- [ ] Existing 29K+ attachment files become displayable
- [ ] GIF attachments still work (no regression)
- [ ] Migration runs successfully

---

## Testing Requirements

### Unit Tests

```typescript
describe('Attachment External ID', () => {
  it('stores external_id during import', async () => {
    // Import message with attachment
    // Assert: attachment record has external_id set
  });

  it('returns attachments for message', async () => {
    // Setup: Message with attachment
    // Action: Query attachments
    // Assert: Correct attachment returned
  });

  it('handles re-import without breaking attachments', async () => {
    // Setup: Import message with attachment
    // Action: Re-import same message (gets new UUID)
    // Assert: Attachment still resolves correctly
  });
});
```

### Integration Tests

1. Import iMessages with attachments
2. Verify attachments display
3. Force re-import
4. Verify attachments still display

### Manual Testing

1. Start with clean database
2. Import iMessages with pictures
3. Verify pictures display
4. Force re-import from Settings
5. Verify pictures still display
6. For existing data:
   - Run repair function
   - Verify 29K+ attachments become visible

---

## Migration Strategy

Since this affects existing data:

1. **Migration adds column** - Safe, non-destructive
2. **New imports use new column** - Immediate benefit
3. **Repair function for existing** - One-time fix for legacy data
4. **Consider running repair automatically** - After migration completes

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1044-attachments-stale-id

---

## Implementation Summary

*To be completed by engineer after implementation.*

### Changes Made
-

### Files Modified
-

### Tests Added
-

### Manual Testing Done
-

---

## Dependencies

| Task | Relationship |
|------|-------------|
| TASK-1042 | Must complete Phase 1 first |
| TASK-1043 | Must complete Phase 1 first |

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-221 | iMessage Attachments Stale ID | Source backlog item |
| TASK-1012 | Original attachment import | Original implementation |
| TASK-1035 | Binary plist fix | Related iMessage fix |

---

## Notes

- 29K+ files exist on disk - this is a data recovery task as much as a fix
- The repair function exists and works - goal is to make it unnecessary
- Consider if migration should auto-run repair, or if user should trigger
- Test with various image types: .jpg, .jpeg, .png, .gif, .heic
- GIFs working suggests some records have correct IDs - investigate why
