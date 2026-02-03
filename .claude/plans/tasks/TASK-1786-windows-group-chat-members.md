# TASK-1786: Populate Group Chat Members in Windows Import

**Backlog ID:** BACKLOG-589
**Sprint:** SPRINT-068
**Phase:** Phase 2 - Group Chat Support
**Branch:** `sprint/SPRINT-068-windows-ios-contacts` (existing PR #716)
**Estimated Tokens:** ~20K

---

## Objective

Fix group chat display on Windows so that each message shows the sender's name. Currently, macOS stores `chat_members` in the participants JSON field, but Windows doesn't populate this field.

---

## Context

On Windows, group chats don't show who sent each message. The `participants` JSON field should contain a `chat_members` array with all group participants, but Windows import only captures the direct sender.

**User-reported issue:** Cannot identify who sent messages in group conversations.

---

## Requirements

### Must Do:
1. Parse group chat member list from iPhone backup data
2. Populate `chat_members` array in participants JSON
3. Ensure group chat sender names display correctly in UI

### Must NOT Do:
- Change UI components (display logic already works with chat_members)
- Break 1:1 conversation import
- Skip validation of member data

---

## Acceptance Criteria

- [ ] `participants` JSON contains `chat_members` array for group chats
- [ ] Each member has phone/identifier and contact name (if available)
- [ ] Group chat UI shows sender name for each message
- [ ] 1:1 conversations continue to work correctly
- [ ] Existing tests pass

---

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` (lines 272-276)
  - Populate `chat_members` in participants JSON

## Files to Reference

- macOS implementation of participants population (for format reference)
- iPhone backup message database structure

---

## Testing Expectations

### Manual Testing (Primary)
1. Import iPhone backup with group chat conversations
2. Open a group chat in UI
3. Verify each message shows sender name

### Unit Tests
- **Required:** If new parsing logic added, include tests
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Technical Notes

### Expected participants JSON format:

```json
{
  "chat_members": [
    { "phone": "+15551234567", "name": "John Doe" },
    { "phone": "+15559876543", "name": "Jane Smith" },
    { "phone": "+15555555555", "name": null }
  ],
  "sender": "+15551234567"
}
```

### iPhone Backup Structure

Group chat members should be available from the chat/handle tables in the iPhone backup. Reference the macOS implementation for the join structure.

---

## PR Preparation

- **Title:** `fix(windows): populate group chat members for sender display`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**STATUS: COMPLETED**

*Completed: 2026-02-02*

### Results

- **Before**: Group chats show no sender names
- **After**: Group chats show sender name for each message
- **Actual Tokens**: No additional work required - existing logic worked once contacts were properly resolved

### Notes

**Finding:** The group chat sender display was working correctly in the UI layer. The problem was that contact lookup was failing because:
1. iPhone contacts were not being stored in `external_contacts` table (fixed by migration 27b)
2. Contact lookup was not platform-aware (fixed in `transactionService.getMessageContacts()`)

Once the contact data was available and the lookup was fixed, group chat sender names displayed correctly without any additional code changes.

---

## Guardrails

**STOP and ask PM if:**
- iPhone backup structure doesn't contain group member data
- Format differs significantly from macOS
- Changes would affect 1:1 conversation import
