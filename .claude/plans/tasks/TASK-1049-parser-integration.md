# Task TASK-1049: Parser Integration and Fallback Removal

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Wire up the deterministic format detection and parsers into the main `extractTextFromAttributedBody` flow, remove heuristic fallbacks, and add a clear `"[Unable to parse message]"` fallback for unparseable messages.

## Non-Goals

- Do NOT modify individual parsers (that was TASK-1047 and TASK-1048)
- Do NOT modify the import service (that's TASK-1050)
- Do NOT add comprehensive tests yet (that's TASK-1051)
- Do NOT optimize for performance - focus on correctness

## Deliverables

1. Update: `electron/utils/messageParser.ts` - Refactor `extractTextFromAttributedBody`
2. Update: `electron/constants.ts` - Add `UNABLE_TO_PARSE` fallback constant
3. Delete or simplify: `electron/utils/encodingUtils.ts` - Remove encoding guessing functions (or mark deprecated)
4. Update: `electron/utils/__tests__/messageParser.test.ts` - Add integration tests

## Acceptance Criteria

- [ ] `extractTextFromAttributedBody` uses `detectAttributedBodyFormat` to route parsing
- [ ] Binary plist format calls `extractTextFromBinaryPlist`
- [ ] Typedstream format calls `extractTextFromTypedstream`
- [ ] Unknown format returns `FALLBACK_MESSAGES.UNABLE_TO_PARSE`
- [ ] Parser failure (null result) returns `FALLBACK_MESSAGES.UNABLE_TO_PARSE`
- [ ] All heuristic fallback functions are removed or marked deprecated
- [ ] `looksLikeBinaryGarbage` heuristic in `getMessageText` is removed
- [ ] Unit tests verify correct routing for each format type
- [ ] All CI checks pass

## Implementation Notes

### New Flow

```typescript
/**
 * Extract text from macOS Messages attributedBody blob
 *
 * Uses DETERMINISTIC format detection based on magic bytes:
 * 1. "bplist00" -> Binary plist (NSKeyedArchiver)
 * 2. "streamtyped" -> Typedstream (legacy Apple format)
 * 3. Neither -> Unknown format (return placeholder)
 *
 * NEVER guesses encoding or uses heuristics.
 *
 * @param attributedBodyBuffer - The attributedBody buffer from Messages database
 * @returns Extracted text or clear fallback message
 */
export async function extractTextFromAttributedBody(
  attributedBodyBuffer: Buffer | null | undefined
): Promise<string> {
  if (!attributedBodyBuffer || attributedBodyBuffer.length === 0) {
    return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
  }

  // DETERMINISTIC: Detect format from magic bytes
  const format = detectAttributedBodyFormat(attributedBodyBuffer);

  logService.debug(`Detected attributedBody format: ${format}`, "MessageParser", {
    bufferLength: attributedBodyBuffer.length,
  });

  switch (format) {
    case 'bplist': {
      const result = extractTextFromBinaryPlist(attributedBodyBuffer);
      if (result && result.length >= MIN_MESSAGE_TEXT_LENGTH) {
        const cleaned = cleanExtractedText(result);
        if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
          return cleaned;
        }
      }
      // Binary plist parse failed
      logService.debug("Binary plist extraction returned no content", "MessageParser");
      return FALLBACK_MESSAGES.UNABLE_TO_PARSE;
    }

    case 'typedstream': {
      const result = extractTextFromTypedstream(attributedBodyBuffer);
      if (result && result.length >= MIN_MESSAGE_TEXT_LENGTH) {
        const cleaned = cleanExtractedText(result);
        if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH && cleaned.length < MAX_MESSAGE_TEXT_LENGTH) {
          return cleaned;
        }
      }
      // Typedstream parse failed
      logService.debug("Typedstream extraction returned no content", "MessageParser");
      return FALLBACK_MESSAGES.UNABLE_TO_PARSE;
    }

    case 'unknown':
    default: {
      // Unknown format - do NOT guess, do NOT try encodings
      logService.warn("Unknown attributedBody format", "MessageParser", {
        bufferLength: attributedBodyBuffer.length,
        hexPreview: attributedBodyBuffer.subarray(0, 20).toString("hex"),
      });
      return FALLBACK_MESSAGES.UNABLE_TO_PARSE;
    }
  }
}
```

### Add Fallback Constant

In `electron/constants.ts`:

```typescript
export const FALLBACK_MESSAGES = {
  REACTION_OR_SYSTEM: "[Reaction or system message]",
  ATTACHMENT: "[Attachment]",
  PARSING_ERROR: "[Unable to display message]",
  UNABLE_TO_PARSE: "[Unable to parse message]",  // ADD THIS
};
```

### Remove/Deprecate Encoding Guessing

The following functions in `messageParser.ts` should be REMOVED or marked deprecated:

```typescript
// REMOVE these functions:
// - tryFallbackExtraction() - guessing
// - tryMultiEncodingExtraction() - guessing
// - extractMessageFromDecodedText() - guessing
// - extractUsingHeuristicsMultiEncoding() - guessing
// - extractWithEncoding() - guessing
// - extractUsingHeuristics() - guessing

// ALSO REMOVE from getMessageText():
// - looksLikeBinaryGarbage() heuristic
```

### Simplified getMessageText

```typescript
/**
 * Get message text from a message object
 *
 * Priority:
 * 1. Use message.text if present and not garbage
 * 2. Parse attributedBody using deterministic detection
 * 3. Return attachment fallback if applicable
 * 4. Return reaction fallback
 */
export async function getMessageText(message: Message): Promise<string> {
  // If text field exists and is not empty, use it
  if (message.text && message.text.length >= MIN_MESSAGE_TEXT_LENGTH) {
    const cleaned = cleanExtractedText(message.text);
    if (cleaned.length >= MIN_MESSAGE_TEXT_LENGTH) {
      return cleaned;
    }
  }

  // Try to extract from attributed body
  if (message.attributedBody) {
    return await extractTextFromAttributedBody(message.attributedBody);
  }

  // Fallback based on message type
  if (message.cache_has_attachments === 1) {
    return FALLBACK_MESSAGES.ATTACHMENT;
  }

  return FALLBACK_MESSAGES.REACTION_OR_SYSTEM;
}
```

**Key Change:** Remove `looksLikeBinaryGarbage` heuristic. If `message.text` contains garbage, it will fail the `MIN_MESSAGE_TEXT_LENGTH` check after cleaning, and we'll fall back to `attributedBody`.

### What to Remove

| Function | File | Action |
|----------|------|--------|
| `tryFallbackExtraction` | messageParser.ts | DELETE |
| `tryMultiEncodingExtraction` | messageParser.ts | DELETE |
| `extractMessageFromDecodedText` | messageParser.ts | DELETE |
| `extractUsingHeuristicsMultiEncoding` | messageParser.ts | DELETE |
| `extractWithEncoding` | messageParser.ts | DELETE |
| `extractUsingHeuristics` | messageParser.ts | DELETE |
| `looksLikeBinaryGarbage` | messageParser.ts | DELETE (inline in getMessageText) |
| `tryMultipleEncodings` | encodingUtils.ts | Mark @deprecated |
| `extractTextSegments` | encodingUtils.ts | Mark @deprecated |

## Integration Notes

- Imports from: `./encodingUtils` (may reduce imports), `../constants`
- Exports to: Used by import service and UI components
- Depends on: TASK-1046 (format detection), TASK-1047 (bplist), TASK-1048 (typedstream)

## Do / Don't

### Do:

- Use the deterministic format detection
- Return clear fallback messages instead of garbage
- Log unknown formats at warn level with hex preview
- Clean extracted text before returning

### Don't:

- Don't add any encoding fallbacks
- Don't use "looks like garbage" heuristics
- Don't catch and ignore parse errors silently
- Don't keep dead code - delete the heuristic functions

## When to Stop and Ask

- If removing heuristics breaks existing functionality
- If you find edge cases not covered by bplist or typedstream parsers
- If tests start failing after removing fallback functions
- If unsure which functions are safe to delete

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `extractTextFromAttributedBody` routes bplist correctly
  - `extractTextFromAttributedBody` routes typedstream correctly
  - `extractTextFromAttributedBody` returns fallback for unknown format
  - `extractTextFromAttributedBody` returns fallback when parser returns null
  - `getMessageText` uses text field when valid
  - `getMessageText` falls back to attributedBody when text is garbage
  - `getMessageText` returns attachment fallback when appropriate
- Existing tests to update: Remove tests for deleted functions

### Coverage

- Coverage impact: Should remain same or improve (removing dead code)

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (N/A)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(parser): integrate deterministic format detection, remove heuristics`
- **Labels**: `refactor`, `parser`, `phase-2`
- **Depends on**: TASK-1046, TASK-1047, TASK-1048

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 3 files (parser, constants, tests) | +15K |
| Code volume | ~50 lines new, ~200 lines deleted | +5K |
| Test complexity | Medium (integration paths) | +10K |

**Confidence:** Medium-High

**Risk factors:**
- Deleting code may break imports elsewhere
- Edge cases in format routing

**Similar past tasks:** TASK-1035 (integration ~similar complexity)

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
- [ ] electron/utils/messageParser.ts (integrate and remove heuristics)
- [ ] electron/constants.ts (add UNABLE_TO_PARSE)
- [ ] electron/utils/encodingUtils.ts (deprecate functions)
- [ ] electron/utils/__tests__/messageParser.test.ts (integration tests)

Functions deleted:
- [ ] tryFallbackExtraction
- [ ] tryMultiEncodingExtraction
- [ ] extractMessageFromDecodedText
- [ ] extractUsingHeuristicsMultiEncoding
- [ ] extractWithEncoding
- [ ] extractUsingHeuristics
- [ ] looksLikeBinaryGarbage (inline function)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/deterministic-message-parsing
