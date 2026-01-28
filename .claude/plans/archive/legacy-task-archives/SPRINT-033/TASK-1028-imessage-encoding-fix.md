# TASK-1028: Fix iMessage Text Encoding Corruption (U+FFFD)

**Backlog ID:** BACKLOG-209
**Sprint:** SPRINT-033
**Phase:** Phase 1 - Critical Data Integrity Fix
**Branch:** `fix/task-1028-imessage-encoding`
**Estimated Tokens:** ~60K
**Token Cap:** 240K

---

## Objective

Fix the text encoding corruption in iMessage imports that results in U+FFFD replacement characters, ensuring all message content is preserved without data loss. This is a **CRITICAL** data integrity issue for an audit/compliance tool.

---

## Context

Messages imported from the macOS Messages database (`chat.db`) are showing corruption characters (U+FFFD replacement characters) where actual text should be. The current workaround strips these characters, which **LOSES actual message content**.

### Current Problem

```
Expected: "Hey, let's meet at 3pm tomorrow"
Actual:   "Hey, let's meet at 3pm tomorrow" (with replacement chars)
After strip: "Hey, lets meet at 3pm tomorrow" (apostrophe LOST)
```

### Root Cause

The `attributedBody` binary field in the Messages database contains `NSAttributedString` serialized in Apple's typedstream format. This format may contain:
- UTF-16 encoded strings (Little Endian or Big Endian)
- Latin-1 (ISO-8859-1) encoded strings
- Mixed encodings within the same blob

The current code uses `buffer.toString("utf8")` which fails for non-UTF-8 content.

### Files Involved

| File | Purpose |
|------|---------|
| `electron/services/macOSMessagesImportService.ts` | Main import service |
| `electron/utils/messageParser.ts` | Parses attributedBody blobs |
| `imessage-parser` (npm package) | Third-party parsing library |

---

## Requirements

### Must Do:

1. **Investigate** the actual encoding in corrupted `attributedBody` blobs
2. **Implement** multi-encoding fallback parser that tries:
   - UTF-8 first
   - UTF-16 LE (common on macOS)
   - UTF-16 BE
   - Latin-1 as final fallback
3. **Preserve** all text content - no silent data loss
4. **Log** any messages that couldn't be fully decoded
5. **Test** with multiple encoding scenarios
6. **Ensure** re-import can recover previously corrupted messages

### Must NOT Do:

- Strip or remove U+FFFD characters without recovering actual content
- Break existing working imports
- Significantly degrade import performance (< 20% slower acceptable)
- Fork/modify the imessage-parser library unless absolutely necessary

---

## Acceptance Criteria

- [ ] Messages with non-ASCII characters (apostrophes, accents, emoji) are correctly imported
- [ ] NO message content is silently dropped or corrupted
- [ ] Previously corrupted messages can be recovered via Force Reimport
- [ ] Unit tests cover multiple encoding scenarios (UTF-8, UTF-16 LE, UTF-16 BE, Latin-1)
- [ ] Integration test with real corrupted message samples passes
- [ ] Logging identifies any messages that couldn't be fully decoded
- [ ] Full test suite passes (`npm test`)
- [ ] Performance: Import time increased by no more than 20%

---

## Implementation Approach

### Option A: Enhanced Multi-Encoding Parser (Recommended)

```typescript
function parseAttributedBody(buffer: Buffer): string {
  // 1. Try imessage-parser first (handles most cases)
  let text = imessageParser.parseAttributedBody(buffer);
  if (!containsReplacementChars(text)) return text;

  // 2. Fall back to multi-encoding attempts
  text = tryMultiEncoding(buffer);
  if (!containsReplacementChars(text)) return text;

  // 3. If still corrupted, log and return best effort
  logger.warn('Could not fully decode message', {
    bufferLength: buffer.length,
    preview: buffer.slice(0, 50).toString('hex')
  });
  return text;
}

function tryMultiEncoding(buffer: Buffer): string {
  const encodings: BufferEncoding[] = ['utf8', 'utf16le', 'latin1'];

  for (const encoding of encodings) {
    const decoded = buffer.toString(encoding);
    if (!containsReplacementChars(decoded)) {
      return extractTextFromTypedstream(decoded);
    }
  }

  // Return UTF-8 as default (may have replacement chars)
  return buffer.toString('utf8');
}

function containsReplacementChars(text: string): boolean {
  return text.includes('\uFFFD');
}
```

### Typedstream Extraction

The typedstream format has specific markers. Look for:
- NSString markers and extract following data
- Length prefixes before string data
- Skip control bytes and object metadata

### Debug Investigation Steps

Before implementing the fix, investigate:

```typescript
// 1. Find affected messages
const query = `
  SELECT m.ROWID, m.text, hex(m.attributedBody) as hex_body
  FROM message m
  WHERE m.attributedBody IS NOT NULL
    AND m.text IS NULL
  LIMIT 10
`;

// 2. Analyze byte patterns
function analyzeBuffer(buffer: Buffer): void {
  // Check for BOM markers
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) console.log('UTF-16 LE BOM');
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) console.log('UTF-16 BE BOM');

  // Log first 100 bytes in hex
  console.log('First 100 bytes:', buffer.slice(0, 100).toString('hex'));
}
```

---

## Files to Modify

- `electron/services/macOSMessagesImportService.ts` - Add multi-encoding fallback
- `electron/utils/messageParser.ts` - Enhanced parsing logic (if exists)
- Possibly new file: `electron/utils/encodingUtils.ts` - Encoding detection utilities

## Files to Read (for context)

- `electron/services/macOSMessagesImportService.ts` - Current implementation
- `node_modules/imessage-parser/` - Third-party library source
- macOS Messages database schema documentation

---

## Testing Expectations

### Unit Tests

**Required:** Yes - Multiple encoding scenarios

**Test file:** `electron/utils/__tests__/messageParser.test.ts` or similar

**Test cases:**
```typescript
describe('parseAttributedBody', () => {
  it('handles UTF-8 with special characters', () => {
    const input = createTestBuffer("Let's meet at café for résumé review");
    expect(parseAttributedBody(input)).toBe("Let's meet at café for résumé review");
  });

  it('handles emoji content', () => {
    const input = createTestBuffer("Great job! 👍🎉");
    expect(parseAttributedBody(input)).toBe("Great job! 👍🎉");
  });

  it('handles smart quotes', () => {
    const input = createTestBuffer('"Hello" and 'World'');
    expect(parseAttributedBody(input)).toBe('"Hello" and 'World'');
  });

  it('handles non-Latin scripts', () => {
    // Chinese, Japanese, Korean
    const input = createTestBuffer("你好 こんにちは 안녕하세요");
    expect(parseAttributedBody(input)).toBe("你好 こんにちは 안녕하세요");
  });

  it('handles currency symbols', () => {
    const input = createTestBuffer("Price: €100, £50, ¥30");
    expect(parseAttributedBody(input)).toBe("Price: €100, £50, ¥30");
  });

  it('logs warning for unrecoverable content', () => {
    // Test with intentionally corrupted buffer
  });
});
```

### Integration Tests

**Required:** Test with real corrupted samples if available

```typescript
describe('macOSMessagesImportService', () => {
  it('imports messages with various encodings correctly', async () => {
    // Test full import flow with mock database
  });

  it('re-import recovers previously corrupted messages', async () => {
    // Import once with old code, then re-import with fix
  });
});
```

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(import): resolve iMessage text encoding corruption (U+FFFD)`
- **Branch:** `fix/task-1028-imessage-encoding`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Plan-First (MANDATORY):
- [ ] Invoked Plan agent with task context
- [ ] Reviewed plan for feasibility
- [ ] Plan approved

Investigation:
- [ ] Found corrupted message samples
- [ ] Analyzed byte patterns in attributedBody
- [ ] Identified actual encodings present

Implementation:
- [ ] Multi-encoding parser implemented
- [ ] Logging for unrecoverable content added
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] Root cause documented below
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Root Cause Analysis

**What encoding issues were found:**
[Document actual encodings encountered]

**How the fix resolves them:**
[Document solution approach]

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~60K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The imessage-parser library needs to be forked/patched
- More than 3 encoding types are needed beyond UTF-8/UTF-16/Latin-1
- Performance degrades by more than 30%
- The typedstream format is more complex than expected
- You cannot find real corrupted message samples to test with
- You encounter blockers not covered in the task file

---

## SR Engineer Review Notes

**Review Date:** 2026-01-11 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1028-imessage-encoding

### Execution Classification
- **Parallel Safe:** No - Must complete before Phase 2
- **Depends On:** None (first task)
- **Blocks:** TASK-1029, TASK-1030

### Shared File Analysis
- Files modified: `electron/utils/messageParser.ts`, `electron/services/macOSMessagesImportService.ts`
- Conflicts with: TASK-1029 (macOSMessagesImportService.ts)

### Technical Considerations

**Current State:**
- `messageParser.ts` already uses `imessage-parser` library with `cleanOutput: true`
- Fallback heuristic extraction exists but uses `buffer.toString("utf8")` only
- Recent fix (ec5d326) addressed "00" prefix but not core U+FFFD issue

**Recommended Approach:**
1. Add BOM detection BEFORE trying encoding fallbacks:
   - UTF-16 LE BOM: `0xFF 0xFE`
   - UTF-16 BE BOM: `0xFE 0xFF`
2. Try encodings in order: UTF-8 -> UTF-16 LE -> UTF-16 BE -> Latin-1
3. Log which encoding succeeded for each message (helps future debugging)

**Risk Areas:**
- Typedstream format has multiple variants - test with diverse samples
- Performance: 600K messages x multiple encoding attempts could be slow
- Consider caching encoding detection per conversation/thread_id

**Testing Requirements:**
- Must test with REAL corrupted message samples, not just synthetic buffers
- Verify re-import recovers previously corrupted messages
