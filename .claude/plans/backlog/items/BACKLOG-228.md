# BACKLOG-228: UI Freeze When Viewing Messages to Attach

## Problem Statement

The app freezes when opening the Attach Messages modal to view/select messages for linking to a transaction. This occurs despite BACKLOG-173 fix (contact-first interface).

## Current Behavior

- Open transaction → Messages tab → Click "Attach Messages"
- UI freezes / becomes unresponsive
- May need to force-quit app

## Previous Fix (BACKLOG-173)

PR #353 implemented a contact-first interface to avoid loading all messages at once. However, the freeze is still occurring, indicating either:
1. Regression in the fix
2. Different code path being triggered
3. Incomplete fix for certain scenarios

## Expected Behavior

- Attach Messages modal opens quickly
- Shows contacts first (as designed in BACKLOG-173)
- Only loads messages for selected contact
- UI remains responsive throughout

## Investigation Needed

1. Verify contact-first interface is still active
2. Check if freeze happens before or after contact selection
3. Profile to find the blocking operation
4. Check if pagination/batching is working correctly

## Priority

High - Blocks core workflow

## Acceptance Criteria

- [ ] Attach Messages modal opens without freeze
- [ ] UI remains responsive during message loading
- [ ] Works with large message databases (500K+ messages)

## Related

- BACKLOG-173: Contact-First AttachMessagesModal Interface (completed PR #353)
- BACKLOG-206: UI Freezing During iMessage Sync/Import
- TASK-1029: Fix UI Freezing During iMessage Import

## Created

2025-01-13
