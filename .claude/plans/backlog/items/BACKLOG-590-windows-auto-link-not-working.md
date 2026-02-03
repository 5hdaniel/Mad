# BACKLOG-590: Windows Auto-Link Text Messages Not Working

**Priority:** High
**Category:** Bug (Platform Parity)
**Source:** SPRINT-068 testing
**Related PR:** #716

## Problem

Even after fixing `participants_flat` in SPRINT-068, the auto-linking feature reports `messagesLinked: 0`. Text messages are not automatically attaching to transactions on Windows.

## Symptoms

- Debug logging was added to investigate
- `messagesLinked: 0` in auto-link results
- Phone pattern matching appears to fail
- Related to BACKLOG-585, BACKLOG-586, BACKLOG-587

## Investigation Needed

1. Verify the `participants_flat` fix is actually working
2. Check phone number normalization between contacts and messages
3. Validate the matching query logic on Windows
4. Compare with working macOS implementation

## Files to Investigate

- `electron/services/iPhoneSyncStorageService.ts` - participants_flat population
- Auto-linking service/query logic
- Contact phone number storage format

## Deliverables

1. Identify root cause of matching failure
2. Fix phone pattern matching to work on Windows
3. Verify auto-link successfully links messages

## Estimate

~25K tokens (investigation + fix)

## User Impact

High - Core feature (auto-linking) doesn't work on Windows, defeating the purpose of the app.
