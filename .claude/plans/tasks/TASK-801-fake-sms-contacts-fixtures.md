# Task TASK-801: Create Fake SMS/iMessage and Contacts Fixtures

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

---

## Goal

Create comprehensive fake SMS/iMessage and contacts fixtures that simulate iOS backup data, enabling reproducible testing of message parsing, contact sync, and phone-based transaction detection.

## Non-Goals

- Do NOT modify the actual iOSMessagesParser or iOSContactsParser
- Do NOT create email fixtures (that is TASK-800)
- Do NOT implement actual iOS backup reading

## Deliverables

1. New file: `electron/services/__tests__/fixtures/fake-ios-backup/messages.json`
2. New file: `electron/services/__tests__/fixtures/fake-ios-backup/contacts.json`
3. New file: `electron/services/__tests__/fixtures/fake-ios-backup/types.ts`
4. New file: `electron/services/__tests__/fixtures/fake-ios-backup/iosBackupFixtureService.ts`
5. New file: `electron/services/__tests__/fixtures/fake-ios-backup/createTestDatabase.ts`

## Acceptance Criteria

- [x] Messages JSON contains at least 200 messages across 25+ conversations
- [x] Contacts JSON contains at least 50 contacts with phones, emails
- [x] Messages include individual chats, group chats, iMessage, and SMS
- [x] createTestDatabase.ts can generate in-memory SQLite matching iOS sms.db schema
- [x] Fixtures use Apple epoch timestamps (nanoseconds since 2001-01-01)
- [x] All CI checks pass

## Implementation Notes

### iOS sms.db Schema Reference

```sql
CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT, service TEXT);
CREATE TABLE chat (ROWID INTEGER PRIMARY KEY, guid TEXT, chat_identifier TEXT);
CREATE TABLE message (ROWID INTEGER PRIMARY KEY, text TEXT, handle_id INTEGER, is_from_me INTEGER, date INTEGER);
CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
```

### Apple Timestamp Conversion

```typescript
function toAppleTimestamp(date: Date): number {
  const appleEpoch = new Date('2001-01-01T00:00:00Z').getTime();
  return (date.getTime() - appleEpoch) * 1_000_000;
}
```

### Message Content Suggestions

1. **Showing Coordination**: "Can we see the house at 3pm?"
2. **Offer Discussion**: "Seller countered at $485K"
3. **Closing Coordination**: "Bring your ID tomorrow"

## Integration Notes

- Used by: TASK-802 (Integration Testing Framework)
- Depends on: None

## PR Preparation

- **Title**: `test(fixtures): add fake iOS backup fixtures`
- **Labels**: `test`, `infrastructure`

---

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2025-12-28 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-801-ios-fixtures

### Execution Classification
- **Parallel Safe:** YES - no shared files with TASK-800
- **Depends On:** None
- **Blocks:** TASK-802 (Integration Testing Framework)

### Shared File Analysis

| File | Tasks | Risk |
|------|-------|------|
| `jest.config.js` | TASK-802 only | None for this task |
| New fixture directory | TASK-801 only | None |

### Technical Validation

1. **Existing iOS Parser Tests:**
   - Reference: `electron/services/__tests__/iosMessagesParser.test.ts`
   - Uses in-memory SQLite with iOS sms.db schema
   - Apple epoch timestamps (nanoseconds since 2001-01-01)

2. **iOS Schema Tables (VERIFIED):**
   ```sql
   -- From iosMessagesParser.ts and test files
   handle (ROWID, id TEXT, service TEXT)
   chat (ROWID, guid TEXT, chat_identifier TEXT, display_name TEXT, style INTEGER)
   message (ROWID, text TEXT, handle_id INTEGER, is_from_me INTEGER, date INTEGER, cache_has_attachments INTEGER)
   chat_handle_join (chat_id INTEGER, handle_id INTEGER)
   chat_message_join (chat_id INTEGER, message_id INTEGER)
   ```

3. **Apple Timestamp Formula - VERIFIED:**
   ```typescript
   // Correct formula from iosMessagesParser.ts
   const appleEpoch = new Date('2001-01-01T00:00:00Z').getTime();
   const nanoseconds = (date.getTime() - appleEpoch) * 1_000_000;
   ```

4. **Contact Data Structure:**
   - Reference: `electron/services/__tests__/iosContactsParser.test.ts`
   - ContactsParser uses different SQLite schema (AddressBook)

### Technical Corrections

1. **Message Schema Enhancement:**
   Add these fields from actual iOS sms.db:
   ```sql
   message (
     ROWID INTEGER PRIMARY KEY,
     guid TEXT,
     text TEXT,
     handle_id INTEGER,
     is_from_me INTEGER,
     date INTEGER,            -- Apple nanoseconds
     date_read INTEGER,
     cache_has_attachments INTEGER,
     associated_message_guid TEXT,  -- For reactions
     associated_message_type INTEGER
   )
   ```

2. **Group Chat Support:**
   - `chat.style = 43` for group chats, `style = 45` for individual
   - Multiple handles per chat via chat_handle_join

3. **iMessage vs SMS Distinction:**
   - `handle.service = 'iMessage'` or `'SMS'`
   - Include both types in fixtures

### Technical Considerations
- Include group chat scenarios (3+ participants)
- Add reaction messages (associated_message_type = 2000-2005)
- Test tapback messages and their parent references
- Include both iMessage and SMS service types
- Add contact photos as base64 samples (optional, for testing)

### Risk Assessment
- **LOW:** Test infrastructure only
- **MEDIUM:** Apple epoch calculations must be precise (use provided formula)
- Ensure SQLite in-memory database handles all schema constraints

---

## PM Estimate

**Turns:** 10-14 | **Tokens:** ~50K-70K | **Time:** ~1.5-2.5h

---

## SR Engineer Review (Post-Implementation)

**Review Date:** 2025-12-31 | **Status:** APPROVED | **PR:** #259

### Verification Results

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| Messages in JSON | 200+ | 203 | PASS |
| Conversations | 25+ | 30 | PASS |
| Contacts in JSON | 50+ | 52 | PASS |
| Individual chats | Yes | 25 | PASS |
| Group chats | Yes | 5 | PASS |
| iMessage messages | Yes | 172 | PASS |
| SMS messages | Yes | 31 | PASS |
| In-memory SQLite creation | Yes | Yes | PASS |
| Apple epoch timestamps | Yes | Verified (727030800000000000 -> 2024-01-15) | PASS |
| CI checks | All pass | All pass | PASS |

### Code Quality Assessment

**Strengths:**
1. Comprehensive type definitions with detailed JSDoc comments
2. Message fixtures include test metadata (category, difficulty, expected)
3. Fixture service provides extensive filtering and lookup capabilities
4. Contact data includes realistic real estate transaction roles
5. Database creation supports flexible options (filters, file persistence)
6. Added `index.ts` for clean re-exports (not in original spec - improvement)

**Architecture Compliance:**
- [x] Files properly placed in `__tests__/fixtures/` directory
- [x] Types exported from dedicated `types.ts` file
- [x] Service file provides proper abstraction over raw JSON
- [x] No coupling to production code
- [x] Uses `better-sqlite3-multiple-ciphers` correctly for in-memory DB
- [x] Apple epoch conversion matches existing parser implementation

### SR Engineer Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Code Review | 1 | ~8K | 8 min |
| Verification | 1 | ~4K | 5 min |
| Documentation | 1 | ~2K | 3 min |
| **Total** | **3** | **~14K** | **16 min** |

### Merge Details

- **PR:** #259
- **Merge Type:** Traditional merge (not squash)
- **Target:** develop
- **Merged By:** SR Engineer
- **Merge Date:** 2025-12-31
