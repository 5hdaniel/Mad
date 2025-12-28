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

- [ ] Messages JSON contains at least 200 messages across 25+ conversations
- [ ] Contacts JSON contains at least 50 contacts with phones, emails
- [ ] Messages include individual chats, group chats, iMessage, and SMS
- [ ] createTestDatabase.ts can generate in-memory SQLite matching iOS sms.db schema
- [ ] Fixtures use Apple epoch timestamps (nanoseconds since 2001-01-01)
- [ ] All CI checks pass

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

## PM Estimate

**Turns:** 10-14 | **Tokens:** ~50K-70K | **Time:** ~1.5-2.5h
