# BACKLOG-589: Windows Group Chat Sender Names Missing

**Priority:** High
**Category:** Bug (Platform Parity)
**Source:** SPRINT-068 testing (user-reported)
**Related PR:** #716

## Problem

On Windows, group chats don't show the sender name for each message. The UI shows the message content but users cannot tell who sent each message in a group conversation.

## Root Cause

macOS stores `chat_members` in the participants JSON field, which provides the full list of group members that can be used to look up sender names. Windows doesn't populate this field.

## macOS Behavior

- `participants` JSON contains `chat_members` array
- Each message can be attributed to a sender from the group
- Group chat UI displays sender name above each message

## Windows Behavior

- `participants` JSON lacks `chat_members`
- Only the direct sender's phone is captured
- Cannot display sender name in group context

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` (lines 272-276)

## Files to Reference

- macOS implementation of participants population

## Deliverables

1. Populate `chat_members` in participants JSON during Windows import
2. Ensure group chat sender names display correctly

## Estimate

~20K tokens

## User Impact

High - Users cannot identify who sent messages in group chats on Windows.
