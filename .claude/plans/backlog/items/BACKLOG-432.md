# BACKLOG-432: Unified Contact Selection & Auto-Import from Group Chats

## Summary

Improve the contact selection UX by unifying the import and selection screens, streamlining the new audit flow, and automatically importing contacts that appear in group chats but weren't explicitly selected.

## Category

Enhancement / UX

## Priority

P1 - High (User-requested UX improvement)

## Description

### Problem

The current contact selection flow has several friction points:
1. Import screen and select contact screen are separate, requiring extra navigation
2. Contact selection process for new audits is cumbersome
3. Contacts who appear in group chat messages but weren't explicitly selected are not automatically imported, leading to incomplete audit records

### Proposed Solution

#### 1. Unify Import & Select Contact Screens
- Combine the "Import Contacts" and "Select Contacts" screens into a single unified interface
- Allow users to search, import, and select contacts in one place
- Reduce navigation steps and cognitive load

#### 2. Streamline New Audit Contact Selection
- Simplify the contact selection step in the "Audit New Transaction" flow
- Make it easier to add/remove contacts quickly
- Consider auto-suggestions based on transaction type or recent contacts

#### 3. Auto-Import Group Chat Participants
- When importing messages from a group chat, automatically detect all participants
- Import contacts that appear in the conversation even if not explicitly selected
- Show user which contacts were auto-imported with option to remove
- Ensures complete audit trail of all communication participants

### User Stories

1. As a user, I want to import and select contacts in one screen so I don't have to navigate back and forth
2. As a user, I want the new audit flow to be faster so I can complete audits efficiently
3. As a user, I want all group chat participants automatically included so my audit is complete

## Acceptance Criteria

- [ ] Import and select contact functionality combined into single screen
- [ ] New audit contact selection step is streamlined
- [ ] Group chat participants are automatically detected and imported
- [ ] Auto-imported contacts are clearly indicated to user
- [ ] User can remove auto-imported contacts if needed
- [ ] All existing contact functionality preserved
- [ ] Tests updated for new flow

## Estimated Effort

~35K tokens (complex UX refactor)

## Dependencies

None

## Related Items

- BACKLOG-430: Default Representation Start Date
- BACKLOG-431: Add Sale Price and Listing Price
- New Audit Transaction flow
