# BACKLOG-346: Add Test Coverage for folderExportService.ts

**Created**: 2026-01-21
**Priority**: High
**Category**: Testing
**Status**: Pending

---

## Description

`folderExportService.ts` is a critical 2057-line file with 0% test coverage. It handles all audit package exports and has significant business logic that needs testing.

## Source

SR Engineer review (2026-01-21): "The folderExportService.ts file (2057 lines) has significant new functionality... No test file exists."

## Functions to Test

- `_isGroupChat()` - group chat detection logic
- `getGroupChatParticipants()` - participant extraction from messages
- `_filterCommunicationsByDate()` - date range filtering
- File naming logic (`email_`, `text_` prefixes)
- Contact name resolution
- Attachment export with fallback lookups

## Acceptance Criteria

- [ ] Create `electron/services/__tests__/folderExportService.test.ts`
- [ ] Test group chat detection edge cases
- [ ] Test date filtering boundary conditions
- [ ] Test file naming conventions
- [ ] Achieve >60% coverage for the service

## Priority

High - Critical export functionality without safety net
