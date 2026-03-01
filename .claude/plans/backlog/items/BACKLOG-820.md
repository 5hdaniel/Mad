# BACKLOG-820: Thread list unmounts and jumps to top when removing a text thread

**Type:** Bug
**Area:** UI
**Priority:** Medium
**Status:** Pending
**Created:** 2026-02-27

## Description

When removing a text thread from a transaction, the entire thread list appears to unmount and then remount, reloading all chats. This causes the user to lose their scroll position and jump back to the top of the list.

Expected behavior: removing a thread should update the list in place without unmounting. The user should stay at the same scroll position and the removed thread should simply disappear from the list.

## Steps to Reproduce

1. Open a transaction with multiple text threads
2. Scroll down in the thread list
3. Remove a thread
4. Observe: list unmounts, reloads all chats, scrolls to top

## Acceptance Criteria

- [ ] Removing a thread does not unmount/remount the thread list
- [ ] Scroll position is preserved after thread removal
- [ ] The removed thread disappears from the list without a full reload
- [ ] No visual flicker or loading state during removal

## Notes

- Likely caused by a state change that triggers a full re-render of the parent component
- May need to use a stable key or optimistic removal pattern instead of refetching the full list
