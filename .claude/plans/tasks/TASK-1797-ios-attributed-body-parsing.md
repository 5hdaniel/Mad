# TASK-1797: Parse iOS attributedBody Field for Location Sharing Messages

**Backlog ID:** BACKLOG-604
**Sprint:** SPRINT-068
**Phase:** Bug Fix
**Branch:** `sprint/SPRINT-068-windows-ios-contacts`
**Estimated Turns:** 2-3
**Estimated Tokens:** 12K-18K

---

## Objective

Parse the `attributedBody` field for iOS messages when the `text` field is empty, enabling proper display of location sharing and other system messages.

---

## Context

During SPRINT-068 testing, it was discovered that iOS messages like "You started sharing location" display as "[Media not available]" because these messages store their text content in the `attributedBody` blob field rather than the plain `text` field.

The solution is straightforward: the `parseAttributedBody()` function already exists in `electron/utils/messageParser.ts` and is used for macOS message parsing. We just need to:
1. Query the `attributedBody` column in the iOS parser
2. Parse it when `text` is empty

---

## Requirements

### Must Do:
1. Add `attributedBody` to the SELECT query in `iosMessagesParser.ts`
2. Import and use `parseAttributedBody()` from `messageParser.ts` in `iPhoneSyncStorageService.ts`
3. When `text` is empty/null but `attributedBody` exists, parse and use the attributedBody text
4. Verify location sharing messages display correctly

### Must NOT Do:
- Modify the existing `parseAttributedBody()` function unless necessary
- Change handling for messages that already have `text` populated
- Add new dependencies

---

## Acceptance Criteria

- [ ] `iosMessagesParser.ts` SELECT query includes `message.attributedBody`
- [ ] `iPhoneSyncStorageService.ts` parses `attributedBody` when `text` is empty
- [ ] Location sharing messages display "You started sharing location" instead of "[Media not available]"
- [ ] Messages with existing `text` field continue to work correctly
- [ ] TypeScript compiles without errors
- [ ] No regressions in message import functionality

---

## Files to Modify

### Primary Files

1. **`electron/services/iosMessagesParser.ts`**
   - Function: `parseMessagesDb()`
   - Change: Add `message.attributedBody` to the SELECT query
   - Note: The column needs to be aliased or added to the returned row object

2. **`electron/services/iPhoneSyncStorageService.ts`**
   - Function: Where message text is processed during persistence
   - Change: Import `parseAttributedBody` from `../utils/messageParser`
   - Logic: If `message.text` is empty/null and `message.attributedBody` exists, call `parseAttributedBody(message.attributedBody)` to get the text

### Reference Files (Read Only)

- `electron/utils/messageParser.ts` - Contains the `parseAttributedBody()` function signature and implementation to understand how to call it

---

## Implementation Approach

### Step 1: Update iOS Parser Query

In `iosMessagesParser.ts`, find the SELECT query in `parseMessagesDb()` and add `message.attributedBody`:

```sql
SELECT
  message.ROWID,
  message.text,
  message.attributedBody,  -- ADD THIS
  message.date,
  ...
```

### Step 2: Parse attributedBody in Storage Service

In `iPhoneSyncStorageService.ts`, when processing messages:

```typescript
import { parseAttributedBody } from '../utils/messageParser';

// When processing message text:
let messageText = message.text;
if (!messageText && message.attributedBody) {
  messageText = parseAttributedBody(message.attributedBody);
}
```

---

## Testing Expectations

### Manual Testing

1. Import iPhone backup containing location sharing messages
2. Verify messages display "You started sharing location" or similar text
3. Verify other messages still display correctly
4. Check that media messages still show appropriate placeholders

### Unit Tests
- **Required:** No (existing tests should cover)
- **New tests to write:** None (optional enhancement for future)
- **Existing tests to update:** None expected

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(BACKLOG-604): parse attributedBody for iOS location sharing messages`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Location sharing messages show "[Media not available]"
- **After**: Location sharing messages show actual text
- **Actual Turns**: X (Est: 2-3)
- **Actual Tokens**: ~XK (Est: 12K-18K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `parseAttributedBody()` function doesn't work with iOS binary plist format
- The `attributedBody` column has a different name in the iOS database
- You encounter other message types that need similar handling
- You encounter blockers not covered in the task file

---

## SR Engineer Review

**Reviewer:** SR Engineer Agent
**Date:** 2026-02-02
**Verdict:** APPROVED

### Technical Assessment

The task plan is well-structured and the implementation approach is correct. Key observations:

**1. Architecture Alignment**

The solution reuses existing infrastructure appropriately:
- `parseAttributedBody()` in `messageParser.ts` already supports both `bplist` (binary plist) and `typedstream` formats via deterministic format detection (TASK-1049)
- The function has been battle-tested for macOS message parsing and handles edge cases well (TASK-1035, TASK-1046, TASK-1047, TASK-1048, TASK-1071)

**2. Code Changes Required**

Files identified in the task are correct:

- **`electron/types/iosMessages.ts`**: Add `attributedBody?: Buffer | null` to `RawMessageRow` interface (not mentioned in task, but required for type safety)
- **`electron/services/iosMessagesParser.ts`**:
  - Add `message.attributedBody` to SELECT queries in `getMessages()`, `getMessagesAsync()`, `searchMessages()`, and `getConversationWithMessages()`
  - Pass `attributedBody` through `mapMessage()` to `iOSMessage`
- **`electron/types/iosMessages.ts`**: Add `attributedBody?: Buffer | null` to `iOSMessage` interface
- **`electron/services/iPhoneSyncStorageService.ts`**: Import `extractTextFromAttributedBody` (async version) and use it when `text` is empty/null

**3. Technical Recommendations**

- **Use the async version**: Import `extractTextFromAttributedBody` (not `parseAttributedBody`) as it handles both formats and returns a Promise
- **Handle the Promise**: Since `storeMessages()` is already async, the `await extractTextFromAttributedBody()` call fits naturally
- **Fallback behavior**: If attributedBody parsing returns a fallback placeholder, consider keeping the original empty text to avoid false positives

**4. Risk Assessment**

- **Low risk**: iOS sms.db uses the same attributedBody format as macOS Messages.app (NSKeyedArchiver binary plist)
- **Tested parser**: The parser has extensive error handling and returns clean fallback messages on failure
- **No breaking changes**: Messages with existing `text` are unaffected (they skip attributedBody parsing)

**5. Additional Type Changes (Not in Original Task)**

The engineer should add `attributedBody` to both type interfaces:

```typescript
// In RawMessageRow
attributedBody: Buffer | null;

// In iOSMessage
attributedBody?: Buffer | null;
```

This ensures type safety when passing the buffer through the parsing pipeline.

### Approval Notes

- Implementation is straightforward (2-3 turns estimate is accurate)
- Token estimate of 12K-18K is reasonable
- No architectural concerns
- Recommend engineer verify with a real iOS backup containing location sharing messages during manual testing

**Status:** Ready for implementation
