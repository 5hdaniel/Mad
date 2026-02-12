# BACKLOG-585: Group chat with multiple participants shows as 1:1 chat

## Summary
Group chats with multiple participants are incorrectly displayed as 1:1 chats in the Messages Audit view.

## Problem
A thread containing messages from both Nasrin Mazooji and Casey is displayed as "Chat with Nasrin Mazooji" instead of showing as a group chat with both participants listed.

## Expected Behavior
- Group chats should display with a group chat indicator
- All participants should be listed (e.g., "Group: Nasrin Mazooji, Casey")
- The icon should reflect group chat (multiple people icon vs single person)

## Actual Behavior
- Shows as "Chat with Nasrin Mazooji" (1:1 format)
- Only one participant name displayed
- Uses single-person chat styling

## Technical Notes
- Thread ID: macos-chat-2505
- Date range: Apr 18, 2025 - Apr 30, 2025
- Message count: 5 messages
- The logic for detecting group chats may not be correctly identifying threads with multiple participants

## Investigation Areas
- Check how `chat_identifier` distinguishes 1:1 vs group chats in macOS Messages database
- Review participant count detection in thread grouping logic
- Verify the UI component renders group chat styling when participants > 1

## Priority
Medium - Display issue affecting data accuracy perception

## Category
Bug
