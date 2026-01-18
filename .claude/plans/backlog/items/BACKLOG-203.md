# BACKLOG-203: Add Comprehensive Tests for macOSMessagesImportService

## Summary

Add comprehensive test coverage for `electron/services/macOSMessagesImportService.ts`, a critical service for importing iMessage conversations on macOS.

## Problem

The `macOSMessagesImportService` handles macOS Messages (iMessage) database parsing and import. This is a complex service with multiple parsing operations, database queries, and attachment handling. Currently, test coverage may be limited to attachment tests only (`macOSMessagesImportService.attachments.test.ts`).

## Current State

| File | Exists | Coverage Focus |
|------|--------|----------------|
| `macOSMessagesImportService.attachments.test.ts` | Yes | Attachment parsing only |
| `macOSMessagesImportService.test.ts` | Unknown | Core import logic |

## Proposed Solution

Create comprehensive unit tests covering:

1. **Message Parsing**
   - Basic message extraction from chat.db
   - Attributed body parsing (styled text)
   - Group chat handling
   - Date/timestamp conversion

2. **Contact Matching**
   - Phone number normalization
   - Contact lookup by phone/email
   - Unknown contact handling

3. **Thread Management**
   - Thread creation and grouping
   - Participant resolution
   - Thread-to-transaction linking

4. **Attachment Handling**
   - (Already covered in attachments test)
   - Integration with message import

5. **Error Handling**
   - Database access errors
   - Malformed message data
   - Permission issues

## Files to Test

- `electron/services/macOSMessagesImportService.ts` - Main service

## Files to Read (for context)

- `electron/services/__tests__/macOSMessagesImportService.attachments.test.ts` - Existing tests
- `.claude/docs/shared/imessage-attributedbody-parsing.md` - Parsing documentation
- `electron/handlers/messageImportHandlers.ts` - Handler using this service

## Acceptance Criteria

- [ ] Core message import logic has >60% test coverage
- [ ] Message parsing tests cover happy path and edge cases
- [ ] Contact matching tests cover various phone formats
- [ ] Thread grouping tests verify correct behavior
- [ ] Error handling tests ensure graceful failures
- [ ] All existing tests continue to pass
- [ ] No flaky tests introduced

## Priority

**HIGH** - Messages feature is user-facing and parsing bugs impact data quality

## Estimate

~40K tokens (comprehensive test suite)

## Category

test

## Impact

- Prevents regression bugs in message import
- Enables safer refactoring of parsing logic
- Improves confidence in macOS-specific functionality
- Documents expected behavior through tests

## Dependencies

None - can be done independently

## Related Items

- BACKLOG-172: macOS Messages Import (feature implementation)
- BACKLOG-191: Add Test Coverage for Core Service Layer (pattern)
