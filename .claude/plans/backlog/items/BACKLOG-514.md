# BACKLOG-514: Fix Thread Deduplication During Message Import

## Type
bug

## Priority
medium

## Status
in_progress

## Sprint
SPRINT-061

## Description

Same conversation appears as multiple separate threads in the UI. Messages from the same thread are being imported with different thread_ids, or the grouping logic is not consolidating them properly.

### Steps to Reproduce

1. Import messages from macOS
2. Note a specific conversation's thread count
3. Re-run message import (re-sync)
4. Check if same conversation now has multiple thread entries
5. Link the conversation to a transaction
6. Observe if it appears as multiple threads

### Expected Behavior

- Each conversation appears as a single thread
- Re-sync does not create duplicate threads
- Thread IDs are consistent across imports

### Actual Behavior

- Same conversation may appear as multiple threads
- Re-sync can create additional thread entries
- Thread deduplication not working consistently

### Technical Investigation Needed

1. **Import Thread Assignment**: How does `macOSMessagesImportService.ts` assign `thread_id`?
   - Is it based on `chat_id` from macOS database?
   - Is it deterministic for the same conversation?

2. **GUID Deduplication**: Is GUID-based deduplication preventing duplicate messages?
   - What happens on re-import?
   - Are existing records updated or new ones created?

3. **Frontend vs Backend Grouping**: Do they use the same logic?
   - Frontend: `TransactionMessagesTab.tsx` thread grouping
   - Backend: `countTextThreadsForTransaction()` in communicationDbService

4. **Edge Cases**:
   - NULL thread_id handling
   - Thread ID changes across macOS versions

### Files to Investigate

- `electron/services/macOSMessagesImportService.ts` - thread_id assignment, GUID deduplication
- `electron/services/db/communicationDbService.ts` - `countTextThreadsForTransaction()` (lines 837-870)
- `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` - frontend grouping
- `electron/database/schema.sql` - messages table structure

## Acceptance Criteria

- [ ] Same conversation gets consistent thread_id across re-imports
- [ ] GUID deduplication prevents message duplicates
- [ ] Re-sync does not create new thread entries for existing conversations
- [ ] Thread count matches actual unique conversations
- [ ] Frontend and backend grouping logic are consistent

## Related

- SPRINT-061: Communication Display Fixes
- macOS message import
- iPhone message sync
