# Task TASK-1799: Add message_type field to Communication model

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Add an explicit `message_type` field to the Communication/Message model to differentiate between regular text messages, voice messages, location shares, and other special message types. This enables the UI to display appropriate indicators.

## Non-Goals

- Do NOT implement UI changes (separate task: TASK-1800)
- Do NOT add audio playback (separate task: TASK-1801)
- Do NOT modify export service (separate task: TASK-1802)

## Deliverables

1. Update: `electron/types/models.ts` - Add `MessageType` enum and field
2. New/Update: `electron/database/migrations/` - Add column if persisting
3. Update: `electron/services/iPhoneSyncStorageService.ts` - Set message_type during import
4. Update: `electron/services/macOSMessagesImportService.ts` - Set message_type for macOS

## Acceptance Criteria

- [ ] `MessageType` enum defined: `'text' | 'voice_message' | 'location' | 'attachment_only' | 'system' | 'unknown'`
- [ ] `Message` interface includes `message_type?: MessageType`
- [ ] `Communication` type alias inherits message_type
- [ ] iOS import sets `message_type` based on content analysis
- [ ] macOS import sets `message_type` based on content analysis
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass

## Implementation Notes

### Key Patterns

```typescript
// In electron/types/models.ts
export type MessageType =
  | 'text'           // Regular text message
  | 'voice_message'  // Audio message with optional transcript
  | 'location'       // Location sharing message
  | 'attachment_only'// Has attachment but no text content
  | 'system'         // System/service message (delivery receipts, etc.)
  | 'unknown';       // Unable to determine type

// Add to Message interface
export interface Message {
  // ... existing fields ...

  /** Type of message content for UI differentiation */
  message_type?: MessageType;
}
```

### Type Detection Logic

```typescript
// In iPhoneSyncStorageService.ts - when persisting messages
function determineMessageType(message: iOSMessage, attachment?: Attachment): MessageType {
  // Voice message: has audio attachment OR has transcript
  if (message.audioTranscript) {
    return 'voice_message';
  }

  // Check attachments for audio mime type
  if (attachment?.mimeType?.startsWith('audio/')) {
    return 'voice_message';
  }

  // Location: Check for location patterns in text
  const locationPatterns = [
    /started sharing location/i,
    /stopped sharing location/i,
    /shared a location/i,
    /📍/, // Pin emoji
  ];
  if (message.text && locationPatterns.some(p => p.test(message.text!))) {
    return 'location';
  }

  // Attachment only: has attachment but no meaningful text
  if (message.attachments.length > 0 && (!message.text || message.text.trim() === '')) {
    return 'attachment_only';
  }

  // System message: certain patterns or associated_message_type
  // (reactions, delivery receipts, etc.)
  // This may require more investigation of iOS schema

  // Default: regular text
  return message.text ? 'text' : 'unknown';
}
```

### Database Consideration

**Option A: Store in database (recommended)**
- Add migration with new column
- Queryable and filterable
- Consistent storage

```sql
-- Migration: add_message_type_column
ALTER TABLE messages ADD COLUMN message_type TEXT;
CREATE INDEX idx_messages_message_type ON messages(message_type);
```

**Option B: Derive at query time**
- No schema change
- Computed on each fetch
- Less efficient for filtering

### Important Details

- The field should be optional (`?`) for backwards compatibility
- Default to `'text'` or `'unknown'` when type cannot be determined
- Consider batch updating existing messages via migration

## Integration Notes

- Imports from: None (defines types)
- Exports to: MessageBubble, export service, broker portal
- Used by: TASK-1800 (UI), TASK-1802 (export)
- Depends on: TASK-1798 (provides audioTranscript)

## Do / Don't

### Do:

- Make the field optional for backwards compatibility
- Use clear, descriptive enum values
- Add database index if adding column
- Document type detection logic

### Don't:

- Don't require message_type (existing data won't have it)
- Don't remove or rename existing fields
- Don't add UI code in this task

## When to Stop and Ask

- If uncertain about detection heuristics for location/system messages
- If migration would take significant time on large databases
- If type detection conflicts with existing logic

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `determineMessageType()` for each message type
  - Test voice message detection (transcript, audio mime)
  - Test location pattern matching
  - Test attachment-only detection
- Existing tests to update:
  - Any tests mocking Message/Communication need optional field

### Coverage

- Coverage impact: Should not decrease
- Type detection logic should have comprehensive test coverage

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(messages): add message_type field for content differentiation`
- **Labels**: `schema`, `types`, `enhancement`
- **Depends on**: TASK-1798 (for audioTranscript field)

---

## PM Estimate (PM-Owned)

**Category:** `schema` + `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 4 files | +6K |
| Migration | Simple column add | +3K |
| Type detection logic | ~50 lines | +3K |
| Tests | Medium complexity | +3K |

**Confidence:** Medium

**Risk factors:**
- Detection heuristics may need refinement
- Existing message backfill complexity

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-02-02*

### Agent ID

```
Engineer Agent ID: (background agent - no Task tool invocation)
```

### Checklist

```
Files modified:
- [x] electron/types/models.ts
- [x] electron/services/iPhoneSyncStorageService.ts
- [x] electron/services/macOSMessagesImportService.ts
- [x] electron/services/databaseService.ts (migration)
- [x] electron/types/iosMessages.ts (added audioTranscript field)
- [x] electron/utils/messageTypeDetector.ts (NEW)
- [x] electron/utils/__tests__/messageTypeDetector.test.ts (NEW)

Features implemented:
- [x] MessageType type defined (text, voice_message, location, attachment_only, system, unknown)
- [x] message_type field on Message interface
- [x] Type detection in iOS import (iPhoneSyncStorageService)
- [x] Type detection in macOS import (macOSMessagesImportService)
- [x] Database migration 28 (column + CHECK constraint + backfill)
- [x] messageTypeDetector utility with 43 unit tests

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (pre-existing unrelated error in NotificationContext)
- [x] npm test passes (874 tests, 11 failures are pre-existing supabase/Windows path issues)
```

### Notes

**Planning notes:**
- Used Migration 28 as recommended by SR Engineer
- Added CHECK constraint: `CHECK (message_type IN ('text', 'voice_message', 'location', 'attachment_only', 'system', 'unknown'))`
- Backfill for audio attachments implemented as approved
- Detection function is stateless and pure for testing
- Added audioTranscript to iOSMessage type (from TASK-1798 dependency) to enable voice message detection

**Deviations from plan:**
- Added electron/types/iosMessages.ts to the modified files list (needed to add audioTranscript field for type safety)

**Issues encountered:**
- Variable name collision: `messagesColumns` was already used in Migration 11, renamed to `messagesColumnsM28` in Migration 28
- Pre-existing test failures in supabaseService tests (device registration/analytics) - not related to this task
- Pre-existing Windows path handling test failure in macOSMessagesImportService.attachments.test.ts - not related to this task

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Verification (MANDATORY)

- [ ] PR merged and verified
- [ ] Task can now be marked complete
