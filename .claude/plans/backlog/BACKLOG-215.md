# BACKLOG-215: Encoding Corruption in All iMessage Chats

**Status:** Root Cause Identified
**Priority:** CRITICAL
**Category:** bug/data-integrity
**Created:** 2026-01-12
**Updated:** 2026-01-12
**Related Task:** TASK-1028 (merged PR #404)
**Related Backlog:** BACKLOG-209

---

## Problem Statement

**CRITICAL:** All iMessage chats display corrupted/garbled characters that appear to be binary data displayed as text. This is NOT limited to group chats - the corruption affects ALL messages.

```
Example corrupted text:
蘁徠༐华敋敹䅤捲楨敶퉲ईଊ癗牥楳湯
```

**Note:** TASK-1028 (PR #404) was intended to fix iMessage encoding issues but the corruption is still happening. Either:
1. The fix was not effective
2. There is a different/additional encoding issue not addressed by TASK-1028
3. The fix only partially addressed the problem

This requires urgent re-investigation of the iMessage parsing logic.

---

## Symptoms

- **ALL** iMessage chats show corrupted characters (not just group chats)
- Messages display CJK characters mixed with symbols
- These are clearly NOT intentional text (random unicode codepoints)
- The pattern `蘁徠༐华敋敹` suggests UTF-16 bytes being read as UTF-8 or binary/serialized data
- Affects both 1:1 conversations AND group chats

---

## ROOT CAUSE IDENTIFIED

**Reference:** https://fatbobman.com/en/posts/deep-dive-into-imessage/

### The Actual Problem

iMessage stores messages in **two fields**:

| Field | Format | Purpose |
|-------|--------|---------|
| `message.text` | Plain text (simple string) | Simple messages without formatting |
| `message.attributedBody` | **Binary plist format** (NSAttributedString) | Rich text with formatting, links, mentions |

**The corrupted characters (`蘁徠༐华敋敹`) are raw binary plist data being displayed directly instead of being properly parsed.**

### Why TASK-1028 Was Wrong

TASK-1028's multi-encoding fallback addressed the **WRONG problem**:

| What TASK-1028 Did | What Was Actually Needed |
|--------------------|--------------------------|
| Tried UTF-8/UTF-16/Latin1 text decoding | Binary plist parsing |
| Assumed text encoding mismatch | Issue is binary format interpretation |
| Added encoding fallback chain | Needed format detection + parsing |

**The issue is NOT text encoding (UTF-8 vs UTF-16).** The `attributedBody` field contains serialized `NSAttributedString` data in Apple's binary plist format. Treating binary plist as text (regardless of encoding) produces garbled characters.

### Solutions from Article

**Option 1: Regex extraction (fast but may miss some)**
```typescript
// Extract readable characters from binary data
// Fast but may miss embedded strings
function extractTextFromBinaryPlist(buffer: Buffer): string {
  const text = buffer.toString('utf-8');
  // Match sequences of readable characters
  return text.match(/[\x20-\x7E\u4E00-\u9FFF]+/g)?.join('') || '';
}
```

**Option 2: plutil conversion (accurate but slower)**
```bash
# Convert binary plist to XML, then extract <string> tags
plutil -convert xml1 -o - attributedBody.plist | grep '<string>' | sed 's/<[^>]*>//g'
```

**Option 3: Fallback to message.text (recommended first step)**
```typescript
// If attributedBody parsing fails, use plain text field
function getMessageText(row: MessageRow): string {
  if (row.text) {
    return row.text;  // Simple messages have plain text
  }
  if (row.attributedBody) {
    return parseBinaryPlist(row.attributedBody);  // Rich messages need parsing
  }
  return '';
}
```

### Files to Investigate

- **iMessage import service** - Where `attributedBody` is being read
- **Message text extraction** - Check if binary plist parsing exists
- **Fallback logic** - Verify if `message.text` is used when `attributedBody` fails

---

## Technical Analysis (Original)

### Likely Cause (SUPERSEDED - see ROOT CAUSE above)

The corrupted output pattern suggests one of:

1. ~~**NSArchiver data** - macOS uses NSArchiver for serializing complex objects~~
2. ~~**typedstream format** - Different variant than what TASK-1028 handles~~
3. **attributedBody format parsing failure** - Parser not correctly handling format **CONFIRMED**
4. **Binary blob displayed directly** - Parser returning raw bytes instead of text **CONFIRMED**
5. ~~**TASK-1028 fix not applied correctly** - Merged but not functioning as expected~~

### Investigation Steps

1. **Verify TASK-1028 fix is active:**
   - Check that the encoding fix code is actually being executed
   - Add logging to confirm which code path is taken

2. **Analyze message format:**
```sql
-- Examine messages with corrupted display
SELECT m.ROWID, m.text, hex(m.attributedBody) as hex_body,
       length(m.attributedBody) as body_length
FROM message m
WHERE m.attributedBody IS NOT NULL
LIMIT 10
```

3. **Check byte patterns:**
```typescript
// If first bytes are 'bplist' or 'typedstream', needs different parsing
function detectFormat(buffer: Buffer): string {
  const header = buffer.slice(0, 10).toString('ascii');
  if (header.startsWith('bplist')) return 'binary-plist';
  if (header.startsWith('streamtyped')) return 'typedstream';
  return 'unknown';
}
```

---

## Relationship to TASK-1028

TASK-1028 was supposed to fix encoding issues, but corruption persists:

| Aspect | TASK-1028 Expected | Actual Result |
|--------|-------------------|---------------|
| Scope | Fix encoding issues | Corruption still present |
| Character type | U+FFFD replacement | Random CJK/symbols showing |
| Message type | All messages | All messages STILL affected |
| Status | Merged (PR #404) | Fix may be ineffective |

**Action Required:** Re-investigate the iMessage parsing logic to determine why TASK-1028 did not resolve the issue.

---

## Acceptance Criteria

- [ ] ALL iMessage chats display correctly without garbled characters
- [ ] Binary data blobs are properly detected and parsed (not displayed raw)
- [ ] Root cause of TASK-1028 ineffectiveness identified
- [ ] Corrupted messages can be recovered via Force Reimport
- [ ] Logging identifies unparseable message formats
- [ ] Full test suite passes
- [ ] Manual verification that corruption is resolved in both 1:1 and group chats

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-209 | iMessage encoding fix | Original encoding issue |
| TASK-1028 | Fix U+FFFD encoding | Fix may be ineffective |
| PR #404 | Encoding fix | Merged but not working |

---

## Estimated Effort

**Category:** fix/data-integrity
**Estimated Tokens:** ~75K (investigation of why TASK-1028 failed + new fix)
**Token Cap:** 300K

---

## Changelog

- 2026-01-12: Created from user testing feedback
- 2026-01-12: **ELEVATED TO CRITICAL** - Corruption affects ALL chats, not just group chats. TASK-1028 fix may not have been effective.
- 2026-01-12: **ROOT CAUSE IDENTIFIED** - Issue is binary plist format in `attributedBody` field being displayed as raw text. TASK-1028's encoding fallback was addressing wrong problem. Reference: https://fatbobman.com/en/posts/deep-dive-into-imessage/
