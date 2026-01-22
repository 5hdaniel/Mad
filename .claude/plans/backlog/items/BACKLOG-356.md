# BACKLOG-356: Text Conversation Card Design Refinements

**Created**: 2026-01-21
**Updated**: 2026-01-22
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

Refine the text conversation cards in transaction details for consistency.

## Current State

Cards already show the compact format with date range. Just need consistency tweaks.

## Required Changes

### 1. 1:1 Chats - Consistent Phone Layout
Put the phone number on its own line under the contact name (for design consistency):

```
GianCarlo
+14243335133
Jan 1 - Jan 6                    View Full →
```

(Currently it wraps to second line only if name is long - make it always on second line)

### 2. Group Chats - Recipients Format
- Remove the colon after "Group Chat" (or header)
- Put all recipients on a new line
- Use same font styling as phone number in 1:1 chats

```
Group Chat
John, Sarah, Mike
Jan 1 - Jan 6                    View Full →
```

NOT:
```
Group Chat: John, Sarah, Mike    (wrong - has colon)
```

### 3. Prioritize Contact Names
- Always show contact display name if available
- Only show phone number if no contact name exists
- For group chats, show all names (not phone numbers)

## Acceptance Criteria

- [ ] 1:1 chats: Phone number always on separate line under name
- [ ] Group chats: No colon, recipients on their own line
- [ ] Group chat recipients use same font as 1:1 phone numbers
- [ ] Contact names prioritized over phone numbers
- [ ] Consistent styling between 1:1 and group chat cards

## Related

- MessageThreadCard.tsx
- TransactionMessagesTab.tsx
