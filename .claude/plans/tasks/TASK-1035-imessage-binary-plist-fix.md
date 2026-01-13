# TASK-1035: Fix iMessage Binary Plist Parsing

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1035 |
| **Sprint** | SPRINT-034 |
| **Backlog Item** | BACKLOG-215 |
| **Priority** | CRITICAL |
| **Phase** | 1 |
| **Estimated Tokens** | ~75K |
| **Token Cap** | 300K |

---

## Problem Statement

ALL iMessage chats display corrupted/garbled characters. The corruption appears as random CJK characters and symbols (e.g., `蘁徠༐华敋敹`).

**Root Cause Identified:** iMessage stores rich text in `message.attributedBody` as binary plist (NSAttributedString serialization). TASK-1028's encoding fallback (UTF-8/UTF-16/Latin1) was the WRONG approach - the issue is binary format interpretation, not text encoding.

**Reference:** https://fatbobman.com/en/posts/deep-dive-into-imessage/

---

## Technical Analysis

### iMessage Message Storage

| Field | Format | Purpose |
|-------|--------|---------|
| `message.text` | Plain text string | Simple messages without formatting |
| `message.attributedBody` | Binary plist (NSAttributedString) | Rich text with formatting, links, mentions |

### Why TASK-1028 Failed

| What TASK-1028 Did | What Was Actually Needed |
|--------------------|--------------------------|
| UTF-8/UTF-16/Latin1 text decoding | Binary plist parsing |
| Assumed text encoding mismatch | Issue is binary format interpretation |
| Added encoding fallback chain | Needed format detection + parsing |

### Corrupted Output Pattern

The garbled characters (`蘁徠༐华敋敹`) are binary plist bytes being interpreted as UTF-16 or random unicode codepoints. This is NOT a text encoding issue - it's binary data being displayed as text.

---

## Solution Options

### Option 1: Fallback to message.text (Quick Win)

```typescript
function getMessageText(row: MessageRow): string {
  // Prefer plain text field when available
  if (row.text && row.text.trim()) {
    return row.text;
  }
  // Only parse attributedBody if text is empty
  if (row.attributedBody) {
    return parseBinaryPlist(row.attributedBody);
  }
  return '';
}
```

**Pros:** Simple, fast, handles most cases
**Cons:** May miss rich text content if text field is empty

### Option 2: Binary Plist Parsing with plist Library

```typescript
import plist from 'plist';

function parseBinaryPlist(buffer: Buffer): string {
  try {
    const parsed = plist.parse(buffer);
    // NSAttributedString structure: { NSString: "actual text", ... }
    return extractStringFromAttributedString(parsed);
  } catch (e) {
    // Fallback to regex extraction
    return extractReadableChars(buffer);
  }
}
```

**Pros:** Accurate parsing of rich text
**Cons:** Requires plist library, more complex

### Option 3: plutil CLI Fallback (macOS Only)

```typescript
import { execSync } from 'child_process';

function parseWithPlutil(buffer: Buffer): string {
  const tempFile = writeTempFile(buffer);
  try {
    const xml = execSync(`plutil -convert xml1 -o - ${tempFile}`);
    return extractStringFromXml(xml.toString());
  } finally {
    unlinkSync(tempFile);
  }
}
```

**Pros:** Uses Apple's native parser
**Cons:** macOS only, slower

### Option 4: Regex Text Extraction (Fallback)

```typescript
function extractReadableChars(buffer: Buffer): string {
  const text = buffer.toString('utf-8');
  // Match sequences of readable ASCII and common unicode
  const matches = text.match(/[\x20-\x7E\u00A0-\u00FF\u4E00-\u9FFF]+/g);
  return matches?.join(' ') || '';
}
```

**Pros:** Simple, no dependencies
**Cons:** May miss some text, may include garbage

---

## Recommended Implementation

**Hybrid Approach:**

1. **First:** Try `message.text` field (plain text, most messages)
2. **Second:** If `text` is empty/null, attempt binary plist parsing with `plist` library
3. **Third:** If plist parsing fails, use regex extraction as fallback
4. **Log:** Any messages that fail all parsers for investigation

```typescript
function getMessageText(row: MessageRow): string {
  // 1. Plain text field (preferred)
  if (row.text && row.text.trim()) {
    return row.text;
  }

  // 2. Binary plist parsing
  if (row.attributedBody) {
    try {
      const parsed = parseBinaryPlist(row.attributedBody);
      if (parsed && parsed.trim()) {
        return parsed;
      }
    } catch (e) {
      logger.debug('Binary plist parse failed', { rowId: row.ROWID, error: e });
    }

    // 3. Fallback: extract readable characters
    const extracted = extractReadableChars(row.attributedBody);
    if (extracted && extracted.trim()) {
      logger.debug('Used regex extraction fallback', { rowId: row.ROWID });
      return extracted;
    }
  }

  logger.warn('No text extracted from message', { rowId: row.ROWID });
  return '';
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/imessage/macOSMessagesImportService.ts` | Update message text extraction |
| `electron/services/imessage/messageParser.ts` | Add binary plist parsing |
| `package.json` | Add `plist` dependency if needed |

---

## Acceptance Criteria

- [ ] ALL iMessage chats display correctly without garbled characters (requires manual testing with Force Re-import)
- [x] Plain text messages (`message.text`) display correctly - existing behavior preserved
- [x] Rich text messages (`message.attributedBody`) display correctly - binary plist parsing added
- [x] Binary plist data is properly detected and parsed - `isBinaryPlist()` and `extractTextFromBinaryPlist()` implemented
- [x] Fallback mechanism handles unparseable messages gracefully - falls back to heuristics if plist parsing fails
- [x] Logging identifies any messages that fail all parsing methods - existing logging preserved
- [ ] Corrupted messages can be recovered via Force Re-import (requires manual testing)
- [x] Full test suite passes - 18 new tests pass, existing tests unaffected
- [ ] Manual verification in both 1:1 and group chats (requires manual testing)

---

## Testing Requirements

### Unit Tests

```typescript
describe('messageParser', () => {
  it('returns text field when available', () => {});
  it('parses binary plist attributedBody when text is empty', () => {});
  it('extracts readable chars as fallback', () => {});
  it('returns empty string when no text extractable', () => {});
  it('handles null/undefined attributedBody', () => {});
});
```

### Integration Tests

- Re-import iMessage database with previously corrupted messages
- Verify all messages display readable text
- Verify no data loss during parsing

### Manual Testing

1. Open app with existing corrupted messages
2. Use Force Re-import to reload messages
3. Verify ALL chats (1:1 and group) display correctly
4. Check for any remaining garbled characters

---

## Branch Information

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** fix/TASK-1035-imessage-binary-plist

---

## Implementation Summary

*Completed by engineer*

### Changes Made
- Added binary plist (bplist00) format detection using magic bytes
- Added NSKeyedArchiver plist parsing with `simple-plist` library (already a dependency)
- Implemented text extraction from `$objects` array, filtering out metadata strings
- Integrated binary plist parsing as the FIRST step in `extractTextFromAttributedBody()` before typedstream parsing
- Added comprehensive fallback chain: text field -> binary plist -> typedstream -> regex extraction

### Files Modified
- `electron/utils/messageParser.ts` - Added `isBinaryPlist()`, `extractTextFromBinaryPlist()`, and updated `extractTextFromAttributedBody()` to detect and parse bplist00 format first
- `electron/utils/__tests__/messageParser.test.ts` - Added 18 new tests for binary plist detection and extraction

### Tests Added
- `isBinaryPlist` tests (5 tests): Detection of bplist00 magic bytes, edge cases
- `extractTextFromBinaryPlist` tests (10 tests): NSKeyedArchiver parsing, string extraction, metadata filtering, unicode/CJK handling, error cases
- Integration tests (3 tests): Full extraction flow with binary plist buffers

### Manual Testing Done
- Verified binary plist creation and parsing with `simple-plist.bplistCreator()`
- Confirmed string extraction logic correctly identifies message content vs metadata
- All 18 new tests pass, existing tests unaffected

---

## Dependencies

- None (Phase 1 task, no dependencies)

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-215 | iMessage Encoding Corruption | Source backlog item |
| TASK-1028 | Previous encoding fix | Superseded by this fix |
| PR #404 | Previous fix PR | Merged but ineffective |

---

## User Verification

| Test | Result | Date |
|------|--------|------|
| Rich iMessage text displays correctly | **PASS** | 2025-01-12 |
| Links in messages show as text (not garbage) | **PASS** | 2025-01-12 |
| Calendar invites display readable text | **PASS** | 2025-01-12 |

**Verified by:** User during SPRINT-034 testing session

**Additional fix during testing:** Added custom `extractTextFromTypedstream()` function to handle NSMutableString preamble (`01 95 84 01 2b`) in addition to regular NSString preamble (`01 94 84 01 2b`). The imessage-parser library only handled the regular preamble.

---

## Notes

- This is the CORRECT fix for the encoding issue - TASK-1028 addressed wrong problem
- The `plist` npm package can parse Apple binary plist format
- Reference article provides detailed explanation of iMessage storage format
- TASK-1036 (Settings scroll) needs to complete so Force Re-import is accessible for testing
