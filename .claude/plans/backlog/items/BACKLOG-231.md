# BACKLOG-231: Fix Failing iosMessagesParser Tests (20 tests)

## Problem

The `iosMessagesParser.test.ts` test file has 20 failing tests out of 46 total. These tests fail because they test against a mock SQLite database that doesn't properly represent the iOS Messages database structure.

## Impact

- **Test Suite**: 20 failures reduce confidence in test coverage metrics
- **CI**: Tests pass overall but these specific tests are failing silently (not blocking CI)
- **Data Integrity**: Parser functionality is not properly validated by tests
- **Priority**: Medium (tests were added in SPRINT-036/037 but underlying mock data issues remain)

## Root Cause Analysis

Based on test output, the issues are:

1. **Mock database structure mismatch**: Tests expect 3 conversations but mock returns 0
2. **Non-existent path handling**: Parser doesn't throw when opening non-existent database path
3. **Group chat detection**: `find()` returns `undefined` when searching for group chats
4. **Message retrieval**: Messages array is empty when it should contain 3 messages
5. **Message attribute parsing**: `fromMe`, `sender`, `recipient` fields not properly populated

The mock database setup in the test file likely needs to:
- Use the correct table schema (`chat`, `message`, `chat_message_join`, `handle`)
- Insert proper test data with all required columns
- Match the actual iOS Messages database structure

## Affected Files

| File | Purpose |
|------|---------|
| `electron/services/__tests__/iosMessagesParser.test.ts` | Test file with 20 failures |
| `electron/services/iosMessagesParser.ts` | Parser implementation |

## Failing Test Categories

| Category | Tests Failing | Description |
|----------|---------------|-------------|
| Database open/close | 1 | Non-existent path should throw |
| getConversations | 3 | Empty results, missing group/individual chat detection |
| getMessages | 3+ | Empty results, chronological order, fromMe detection |
| Message content parsing | 10+ | Text extraction, attachments, date handling |

## Proposed Solution

### Option A: Fix Mock Database Setup (Recommended)
1. Review actual iOS Messages database schema
2. Update test file to create proper mock tables
3. Insert representative test data
4. Ensure parser methods are tested against realistic data

### Option B: Integration Test Approach
1. Create a test fixtures directory with sanitized real iOS Messages database
2. Update tests to use fixture database
3. Mark as integration tests (separate from unit tests)

### Option C: Mock Service Layer
1. Create a mock for the SQLite database layer
2. Mock return values for each query
3. Test parser logic independently of actual database

## Acceptance Criteria

- [ ] All 46 tests in iosMessagesParser.test.ts pass
- [ ] Tests validate actual parser behavior (not just mock responses)
- [ ] Test coverage for edge cases:
  - Non-existent database path
  - Empty database
  - Group chats vs individual chats
  - Messages with attachments
  - Date parsing and sorting
- [ ] No regressions in existing passing tests

## Estimation

- **Category**: test
- **Complexity**: Medium - requires understanding iOS Messages schema
- **Estimated Tokens**: ~30K
- **Files to modify**: 1-2

## Related

- SPRINT-036 (Deterministic Message Parsing) - Added parser refactors
- SPRINT-037 (Test Coverage) - Addressed databaseService tests, not iosMessagesParser
- BACKLOG-203 (macOS Messages tests) - Related but for macOS, not iOS parser

## Notes

- Discovered: 2026-01-15 during SPRINT-037 completion review
- 26 tests pass, 20 fail (56% pass rate)
- These tests were likely added without proper mock data setup
- Consider adding to SPRINT-038 or next test-focused sprint
