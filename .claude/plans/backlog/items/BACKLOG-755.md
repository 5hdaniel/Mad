# BACKLOG-755: Group Chat Participant Missing and Messages Attributed to Wrong Sender

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Bug                    |
| **Area**    | UI                     |
| **Priority**| High                   |
| **Status**  | Pending                |
| **Created** | 2026-02-20             |
| **Sprint**  | SPRINT-089             |
| **Task**    | TASK-2026              |

## Description

In the Messages tab, a group chat shows "GianCarlo, Juan Villaherrera, Eric Leazure" but is missing participant Paul Dorian. Paul's messages in the group chat are incorrectly attributed to GianCarlo. However, the export correctly shows "Paul Dorian +14082104874" for his messages.

### Root Cause

`extractAllPhones()` in `TransactionMessagesTab.tsx` only extracts phone numbers from `from`/`to` fields in the participants JSON. It does NOT extract from `chat_members`. Additionally, iMessage handles can be email addresses (e.g., `paul@icloud.com`) rather than phone numbers, and the phone-only lookup in `getNamesByPhones()` can't resolve email handles to contact names.

The export service works correctly because it uses `getGroupChatParticipants()` which reads directly from `chat_members` and has a more comprehensive name resolution path.

## Expected Behavior

- All group chat participants appear in the thread header, including those whose handles are email addresses
- Each message in the group chat preview shows the correct sender name
- Behavior matches the export service output

## Actual Behavior

- Missing participants from chat_members who are not in `from`/`to` fields
- Messages from missing participants attributed to the wrong sender (first match in the contact list)
- Export output is correct, creating an inconsistency between UI and export

## Acceptance Criteria

- [ ] Group chats show ALL participants in header (including those using email handles)
- [ ] Individual messages in group chat preview show correct sender name
- [ ] Export still works correctly (no regression)
- [ ] 1:1 chats unaffected
- [ ] Type-check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)

## Related Items

- BACKLOG-542: Merge SMS/iMessage threads (same contact, different service)
- BACKLOG-748: Merge duplicate 1:1 chats (iCloud email vs phone number)
- BACKLOG-749: Group chat participants show phone numbers instead of resolved contact names
- TASK-2026: Sprint task for this fix
