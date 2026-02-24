# BACKLOG-749: Group Chat Participants Show Phone Numbers Instead of Contact Names

| Field       | Value                  |
|-------------|------------------------|
| **Type**    | Bug                    |
| **Area**    | Service                |
| **Priority**| High                   |
| **Status**  | Pending                |
| **Created** | 2026-02-20             |

## Description

In text (SMS/MMS) group chats, participant phone numbers are not being resolved to their matching contact names. Users see raw phone numbers instead of display names for group chat members.

## Expected Behavior

Group chat participant list should display the resolved contact name for each member when a matching contact exists in the user's contacts database.

## Actual Behavior

Phone numbers are displayed as-is without being resolved to contact names, even when the phone number matches an existing contact.

## Investigation Areas

- Contact name resolution logic for group chat participants
- Whether the phone-to-contact lookup is being called for group chat member lists
- Differences between 1:1 chat contact resolution and group chat contact resolution
- Phone number format normalization (e.g., +1 prefix, dashes, spaces) that may prevent matching

## Related Items

- BACKLOG-747: Mask iCloud Email Identifier in 1:1 Chat Exports
- BACKLOG-748: Merge Duplicate 1:1 Chats (iCloud Email vs Phone Number)
