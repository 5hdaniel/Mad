# BACKLOG-105: Text Messages Tab in Transaction Details

**Priority:** High
**Category:** ui
**Status:** Pending
**Created:** 2025-12-28

---

## Description

Add a new "Text Messages" tab to the transaction details view. This tab will show text messages (SMS/iMessage) associated with the transaction, with the ability to:
1. View text message threads linked to the transaction
2. Remove non-relevant texts from the transaction
3. Search for and attach text threads that weren't automatically attached

## Background

The current TransactionDetails component has two tabs:
- Details: Shows transaction info and emails
- Contacts: Shows assigned contacts and AI suggestions

Text messages are stored in the `messages` table with `channel IN ('sms', 'imessage')` but are not currently displayed in transaction details.

Related backlog items:
- BACKLOG-011: Manually Add Missing Emails to Audit
- BACKLOG-012: Manually Add Missing Texts to Audit

## Technical Scope

This feature involves multiple tasks:
1. **Tab UI** - Add "Messages" tab to TransactionDetails
2. **Message List Component** - Display text messages in conversation style
3. **Unlink Functionality** - Remove messages from transaction
4. **Attach Functionality** - Search and link new message threads

## Files to Create/Modify

- `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` (new)
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` (new)
- `src/components/transactionDetailsModule/components/AttachMessagesModal.tsx` (new)
- `src/components/TransactionDetails.tsx` (update tabs)
- `src/components/transactionDetailsModule/types.ts` (extend types)

## Acceptance Criteria

- [ ] Text Messages tab appears in transaction details
- [ ] Text messages linked to transaction are displayed
- [ ] Messages grouped by conversation thread
- [ ] Can unlink irrelevant messages from transaction
- [ ] Can search for and attach unlinked message threads
- [ ] Empty state when no messages linked
- [ ] Consistent styling with existing tabs

## Estimated Effort

- **Turns:** 15-25 (multiple sub-tasks)
- **Tokens:** ~80K-120K
- **Time:** ~3-5h
- **Adjustment:** 1.0x (ui category)

---

## Sub-Tasks (Recommended Split)

1. TASK-702: Add Messages tab infrastructure (Tab UI, empty state)
2. TASK-703: Message thread display component
3. TASK-704: Attach/unlink messages modal

## Notes

Consider splitting this into 2-3 smaller tasks for parallel or sequential execution. The tab infrastructure can be done first, then the display component, then the attach/unlink functionality.
