# Task TASK-1798: Parse iOS attributedBody and audio_transcript columns

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Extend the iOS message parser to query and parse the `attributedBody`, `audio_transcript`, and `associated_message_type` columns from sms.db, enabling extraction of special message content (voice message transcripts, location sharing text).

## Non-Goals

- Do NOT implement UI changes (separate task)
- Do NOT add audio playback (separate task)
- Do NOT modify macOS message import (already has attributedBody support)
- Do NOT add new database columns (message_type is separate task)

## Deliverables

1. Update: `electron/services/iosMessagesParser.ts` - Add columns to SELECT, parse attributedBody
2. Update: `electron/types/iosMessages.ts` - Extend interfaces with new fields
3. Update: `electron/services/iPhoneSyncStorageService.ts` - Pass through parsed text/transcript

## Acceptance Criteria

- [ ] `iosMessagesParser.ts` queries `attributedBody` column in SELECT
- [ ] `iosMessagesParser.ts` queries `audio_transcript` column (graceful if missing)
- [ ] `RawMessageRow` interface extended with `attributedBody?: Buffer | null` and `audio_transcript?: string | null`
- [ ] `iOSMessage` interface extended with `audioTranscript?: string | null`
- [ ] `mapMessage()` function uses `extractTextFromAttributedBody()` when `text` is null/empty
- [ ] Voice message transcripts populated in `iOSMessage.audioTranscript`
- [ ] Existing tests pass (no regression)
- [ ] TypeScript compiles without errors
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// In iosMessagesParser.ts - Update the SELECT query
const query = `
  SELECT
    message.ROWID,
    message.guid,
    message.text,
    message.attributedBody,  // NEW
    message.audio_transcript, // NEW (may not exist in all iOS versions)
    message.handle_id,
    message.is_from_me,
    message.date,
    message.date_read,
    message.date_delivered,
    message.service
  FROM message
  JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
  WHERE chat_message_join.chat_id = ?
  ORDER BY message.date ASC
`;

// In mapMessage() - Use existing parser from messageParser.ts
import { extractTextFromAttributedBody, getMessageText } from "../utils/messageParser";

private mapMessage(row: RawMessageRow): iOSMessage {
  let finalText = row.text;

  // If text is empty/null but attributedBody exists, parse it
  if ((!finalText || finalText.trim() === '') && row.attributedBody) {
    // Use async version in async context, or add sync wrapper
    // Note: May need to make mapMessage async or use sync extraction
    const parsed = extractTextFromAttributedBody(row.attributedBody);
    if (parsed && parsed.length > 2) {
      finalText = parsed;
    }
  }

  return {
    id: row.ROWID,
    guid: row.guid || "",
    text: finalText,
    audioTranscript: row.audio_transcript || null,  // NEW
    handle: row.handle_id ? this.getHandle(row.handle_id) : "",
    isFromMe: row.is_from_me === 1,
    date: convertAppleTimestamp(row.date) || new Date(0),
    dateRead: convertAppleTimestamp(row.date_read),
    dateDelivered: convertAppleTimestamp(row.date_delivered),
    service: row.service === "iMessage" ? "iMessage" : "SMS",
    attachments: this.getAttachments(row.ROWID),
  };
}
```

### Handling Missing Columns

The `audio_transcript` column may not exist in older iOS versions. Use a try-catch or check schema:

```typescript
// Option 1: Check if column exists
private hasAudioTranscriptColumn(): boolean {
  try {
    const info = this.db!.prepare(
      "SELECT name FROM pragma_table_info('message') WHERE name = 'audio_transcript'"
    ).get();
    return !!info;
  } catch {
    return false;
  }
}

// Option 2: Build query dynamically (less preferred)
// Option 3: Let it fail gracefully and catch error (simplest)
```

### Reference: Existing messageParser.ts functions

```typescript
// Already available in electron/utils/messageParser.ts:
export async function extractTextFromAttributedBody(
  attributedBodyBuffer: Buffer | null | undefined
): Promise<string>;

export function detectAttributedBodyFormat(
  buffer: Buffer | null | undefined
): AttributedBodyFormat;

export function extractTextFromBinaryPlist(buffer: Buffer): string | null;
export function extractTextFromTypedstream(buffer: Buffer): string | null;
```

### Important Details

- iOS sms.db uses the same binary plist format as macOS Messages
- The `extractTextFromAttributedBody` function is async - may need to handle this
- Voice messages typically have mime_type `audio/x-m4a` or similar
- Location messages have distinctive patterns in attributedBody text

## Integration Notes

- Imports from: `electron/utils/messageParser.ts`
- Exports to: `iPhoneSyncStorageService.ts` (consumes iOSMessage)
- Used by: TASK-1799 (message_type), TASK-1800 (MessageBubble)
- Depends on: None (foundation task)

## Do / Don't

### Do:

- Use existing `extractTextFromAttributedBody` function
- Gracefully handle missing `audio_transcript` column
- Preserve existing behavior for messages with `text` already populated
- Add debug logging for parsing failures

### Don't:

- Don't duplicate the binary plist parsing logic
- Don't assume all iOS versions have audio_transcript
- Don't make breaking changes to existing iOSMessage interface
- Don't modify the macOS import service

## When to Stop and Ask

- If the `attributedBody` column doesn't exist in test sms.db
- If the binary plist format differs from macOS
- If making `mapMessage` async causes cascading changes
- If existing tests fail due to interface changes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test `mapMessage` with null text but valid attributedBody
  - Test `mapMessage` with audio_transcript populated
  - Test graceful handling when audio_transcript column missing
- Existing tests to update:
  - Any tests mocking RawMessageRow need new optional fields

### Coverage

- Coverage impact: Should not decrease
- New parsing paths should have test coverage

### Integration / Feature Tests

- Required scenarios:
  - Import iPhone backup with voice messages
  - Import iPhone backup with location sharing messages
  - Verify transcript text appears in parsed messages

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(ios): parse attributedBody and audio_transcript from sms.db`
- **Labels**: `ios`, `parser`, `enhancement`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-3 files | +8K |
| Code volume | ~100-150 lines | +6K |
| Test complexity | Medium (schema variations) | +6K |

**Confidence:** Medium

**Risk factors:**
- May need async/sync handling for extractTextFromAttributedBody
- Column availability varies by iOS version

**Similar past tasks:** TASK-1797 (iOS attributedBody - est 15K)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/services/iosMessagesParser.ts
- [ ] electron/types/iosMessages.ts
- [ ] electron/services/iPhoneSyncStorageService.ts (if needed)

Features implemented:
- [ ] attributedBody column in SELECT
- [ ] audio_transcript column in SELECT
- [ ] Parse attributedBody when text is empty
- [ ] audioTranscript field in iOSMessage

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any, explain what and why>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
