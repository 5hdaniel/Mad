# BACKLOG-221: iMessage Attachments Not Displaying (Stale message_id)

## Type
Bug / Data Integrity

## Priority
High

## Description
iMessage picture attachments are not displaying in conversation views. GIF attachments work, but regular images show "[Attachment]" placeholder. Root cause: attachment records in database have stale `message_id` values that don't match current message records.

## Symptoms
- Pictures show "[Attachment]" placeholder
- GIFs display correctly (some records have matching IDs)
- Debug logs show "0 attachments" returned for queries
- Attachment files exist on disk (29K+ files in storage directory)

## Root Cause
Attachment records were created during a previous import with old message_id values. When messages were re-imported, they received new UUIDs, but existing attachment records still reference the old message_ids.

## Workarounds Available
1. **Repair function** - `await window.api.messages.repairAttachments()` in dev console
2. **Re-import** - Full iMessage re-import creates fresh attachment associations

## Permanent Fix Needed
Consider one of:
1. Store `external_id` (iMessage GUID) in attachments table for reliable lookup
2. Always re-create attachment records on import (not just when content is new)
3. Run repair function automatically after import

## Acceptance Criteria
- [ ] Picture attachments display in conversation view
- [ ] No manual repair step required after import
- [ ] Existing attachment files are properly linked

## Related
- TASK-1012 (Attachment display feature)
- SPRINT-034

## Created
2025-01-12
