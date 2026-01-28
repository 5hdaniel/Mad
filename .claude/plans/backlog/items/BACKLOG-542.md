# BACKLOG-542: Merge SMS and iMessage threads from same contact

**Type:** Bug
**Priority:** P2 (confusing UX, same contact appears multiple times)
**Status:** Pending
**Sprint:** -
**Created:** 2026-01-27
**Category:** Data/Import

---

## Problem Statement

On iPhone, SMS and iMessage from the same contact appear in ONE conversation thread. Our app splits them into SEPARATE threads based on channel type (SMS vs iMessage). This causes the same contact to appear multiple times in the thread list.

**Example:** "Madison" shows up twice - once for her SMS messages, once for her iMessage messages.

## Expected Behavior

- Group messages by contact/phone number, not by channel type
- Match how iPhone displays conversations (unified thread per contact)
- One thread per contact, containing both SMS and iMessage messages

## Root Cause (Likely)

1. **macOS Messages database storage:** Messages stores SMS and iMessage with different `service` values:
   - iMessage: `service = 'iMessage'`
   - SMS: `service = 'SMS'`

2. **Import logic issue:** Our import logic creates separate `thread_id` values based on the service type, rather than consolidating by phone number/contact.

3. **Thread grouping key:** Currently uses `service` type as part of the grouping key when it should only use phone number/contact identifier.

## Technical Investigation Needed

1. **macOS Messages Database:**
   - How does macOS store SMS vs iMessage in the same conversation?
   - Check `chat` table for how conversations are identified
   - Verify `service` column values in `message` table

2. **Import Service:**
   - `electron/services/macOSMessagesImportService.ts` - thread_id assignment logic
   - Does it use `chat_id` from macOS (which groups by contact)?
   - Or does it generate thread_id based on service type?

3. **Database Schema:**
   - Current `messages` table thread_id logic
   - May need to consolidate by phone number at import time

## Proposed Solution

**Option A: Fix at Import Time**
- Modify import to use macOS `chat_id` (which already groups by contact, not service)
- Ignore `service` type when determining thread grouping
- Re-import will automatically consolidate threads

**Option B: Fix at Display Time**
- Keep separate thread_ids but group by phone number in UI
- Merge display in thread list view
- Requires changes to `TransactionMessagesTab.tsx` grouping logic

**Recommendation:** Option A (fix at import) is cleaner and matches how macOS stores the data natively.

## Files to Investigate

| File | Purpose |
|------|---------|
| `electron/services/macOSMessagesImportService.ts` | Thread ID assignment during import |
| `electron/database/schema.sql` | Messages table structure |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | Thread grouping in UI |
| `electron/services/db/communicationDbService.ts` | Thread-related queries |

## Acceptance Criteria

- [ ] Messages from same contact appear in single thread (regardless of SMS/iMessage)
- [ ] Thread list shows one entry per contact, not one per service type
- [ ] Existing thread links to transactions are preserved (or gracefully migrated)
- [ ] Message display shows service type indicator per message (nice-to-have)
- [ ] Matches iPhone conversation grouping behavior

## Migration Consideration

Existing users may have:
- Duplicate threads from same contact (SMS + iMessage separate)
- Transaction links to individual threads

**Migration approach:**
1. Run thread consolidation on existing data
2. Update thread_id references in transaction links
3. De-duplicate thread entries

## Effort Estimate

~30K tokens
- Investigation: ~10K
- Import fix: ~15K
- Migration script: ~5K

---

## Related

- BACKLOG-514: Thread deduplication during message import (different issue - re-sync duplicates)
- macOS Messages import feature
- SPRINT-061: Communication Display Fixes

## Discovery Context

Found during SPRINT-062 testing. Same contact (e.g., "Madison") appears twice in thread list - once for SMS history, once for iMessage history. This is confusing UX that doesn't match how iPhone displays conversations.
