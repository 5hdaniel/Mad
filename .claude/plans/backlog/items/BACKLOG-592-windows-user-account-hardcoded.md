# BACKLOG-592: Windows User Account Login Hardcoded as "me"

**Priority:** Low
**Category:** Bug (Platform Parity)
**Source:** SPRINT-068 testing
**Related PR:** #716

## Problem

macOS captures the user's phone number or Apple ID from the `account_login` field in the messages database. Windows hardcodes "me" for all outbound messages, causing inconsistent sender display.

## Impact

- User's sent messages show "me" instead of their name/number
- Inconsistent display compared to macOS
- May affect contact resolution for user's own messages

## macOS Behavior

- Reads `account_login` from chat.db
- Uses actual phone number or Apple ID
- User's messages attributed correctly

## Windows Behavior

- Hardcodes "me" string
- No extraction of actual user identifier
- Generic sender label

## Deliverables

1. Extract user's phone/Apple ID from iPhone backup
2. Use actual identifier instead of hardcoded "me"
3. Match macOS behavior for sender display

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts`

## Estimate

~10K tokens

## User Impact

Low - Cosmetic issue, doesn't affect core functionality.
