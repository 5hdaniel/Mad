# BACKLOG-591: Windows participants_flat Missing Group Members

**Priority:** Medium
**Category:** Bug (Platform Parity)
**Source:** SPRINT-068 testing
**Related PR:** #716

## Problem

Windows `participants_flat` only contains the direct sender's digits, while macOS `participants_flat` contains ALL group members comma-separated. This causes auto-linking to fail for group chat participants because not all phone numbers are searchable.

## Current Behavior

**Windows (`iPhoneSyncStorageService.ts` lines 278-281):**
```typescript
participants_flat: sender.replace(/\D/g, '') // Only sender's digits
```

**macOS (`macOSMessagesImportService.ts` lines 884-900):**
```typescript
participants_flat: allMembers.map(m => m.replace(/\D/g, '')).join(',') // All members
```

## Impact

- Group chat messages won't auto-link to transactions
- Contact lookup fails for group chat participants other than sender
- Inconsistent behavior between platforms

## Deliverables

1. Update Windows import to populate `participants_flat` with all group members
2. Parse group chat member list from iPhone backup data
3. Ensure comma-separated format matches macOS

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` (lines 278-281)

## Files to Reference

- `electron/services/macOSMessagesImportService.ts` (lines 884-900)

## Estimate

~15K tokens

## User Impact

Medium - Affects group chat auto-linking, which is less common than 1:1 conversations.
