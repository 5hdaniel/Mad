# BACKLOG-209: Fix iMessage Text Encoding Corruption (Data Loss Issue)

**Created**: 2026-01-11
**Priority**: CRITICAL
**Category**: service/fix
**Status**: Pending

---

## Description

Messages imported from the macOS Messages database are showing corruption characters (U+FFFD replacement characters) where actual text should be. The current "fix" removes these characters, which **LOSES the actual message content**. For a compliance/audit tool, losing message data is UNACCEPTABLE.

## Problem Context

When importing iMessages from the macOS Messages database (`chat.db`), some messages display corrupted text:

**Example of corruption:**
```
Expected: "Hey, let's meet at 3pm tomorrow"
Actual:   "Hey, let's meet at 3pm tomorrow"  (with  being replacement characters)
```

The current workaround strips these characters, resulting in:
```
Result: "Hey, lets meet at 3pm tomorrow"  (apostrophe LOST)
```

This is a **data integrity violation** - the audit tool is silently dropping message content.

## Root Cause Analysis

The corruption occurs in the `attributedBody` binary data parsing:

1. **Location**: `electron/services/macOSMessagesImportService.ts` and/or `electron/utils/messageParser.ts`

2. **Technical issue**: `buffer.toString("utf8")` encounters bytes that aren't valid UTF-8

3. **The `attributedBody` field**:
   - Contains `NSAttributedString` serialized in Apple's typedstream format
   - The typedstream format may contain:
     - UTF-16 encoded strings (Little Endian or Big Endian)
     - Latin-1 (ISO-8859-1) encoded strings
     - Mixed encodings within the same blob
   - The `imessage-parser` library may not handle all encoding variants

4. **Why corruption appears**:
   - Binary data is being interpreted as UTF-8 when it's actually UTF-16 or another encoding
   - Non-ASCII characters (accented letters, apostrophes, emoji) are most affected
   - The U+FFFD character is the Unicode "replacement character" for invalid sequences

## Technical Investigation Required

### Step 1: Identify Affected Messages
```sql
-- Find messages with potential encoding issues
SELECT
  m.ROWID,
  m.text,
  hex(m.attributedBody) as attributed_hex,
  length(m.attributedBody) as body_length
FROM message m
WHERE m.attributedBody IS NOT NULL
  AND m.text IS NULL
LIMIT 100;
```

### Step 2: Analyze Binary Format
```typescript
// Debug function to inspect attributedBody encoding
function analyzeAttributedBody(buffer: Buffer): void {
  // Check for UTF-16 BOM markers
  const bom = buffer.slice(0, 2);
  if (bom[0] === 0xFF && bom[1] === 0xFE) console.log('UTF-16 LE BOM detected');
  if (bom[0] === 0xFE && bom[1] === 0xFF) console.log('UTF-16 BE BOM detected');

  // Check for typedstream magic bytes
  const magic = buffer.slice(0, 4).toString('hex');
  console.log('Magic bytes:', magic);

  // Look for string markers in typedstream
  // NSString typically has specific byte patterns
}
```

### Step 3: Test Multiple Decodings
```typescript
function tryAllDecodings(buffer: Buffer): string[] {
  const results: string[] = [];
  const encodings = ['utf8', 'utf16le', 'utf16be', 'latin1', 'ascii'];

  for (const encoding of encodings) {
    try {
      const decoded = buffer.toString(encoding as BufferEncoding);
      // Check if result has replacement characters
      if (!decoded.includes('\uFFFD')) {
        results.push(`${encoding}: ${decoded}`);
      }
    } catch (e) {
      // Encoding not supported
    }
  }
  return results;
}
```

## Files Involved

| File | Purpose |
|------|---------|
| `electron/services/macOSMessagesImportService.ts` | Main import service |
| `electron/utils/messageParser.ts` | Parses attributedBody blobs |
| `imessage-parser` (npm package) | Third-party parsing library |

## Proposed Solution

### Option A: Enhanced Multi-Encoding Parser

```typescript
function parseAttributedBody(buffer: Buffer): string {
  // 1. Try UTF-8 first
  let text = buffer.toString('utf8');
  if (!containsReplacementChars(text)) return text;

  // 2. Try UTF-16 LE (common on macOS)
  text = buffer.toString('utf16le');
  if (!containsReplacementChars(text)) return extractTextFromTypedstream(text);

  // 3. Try UTF-16 BE
  text = buffer.toString('utf16be');
  if (!containsReplacementChars(text)) return extractTextFromTypedstream(text);

  // 4. Try Latin-1 as fallback
  text = buffer.toString('latin1');

  // 5. If still corrupted, use iconv-lite for more encodings
  return extractTextFromTypedstream(text);
}

function containsReplacementChars(text: string): boolean {
  return text.includes('\uFFFD');
}
```

### Option B: Proper Typedstream Parser

The typedstream format has a specific structure. A proper parser would:
1. Read the typedstream header
2. Identify object types (NSString, NSMutableString, etc.)
3. Extract string data with correct encoding based on metadata
4. Handle nested attributed strings

Reference: https://github.com/nickshanks/Typedstream

### Option C: Hybrid Approach (Recommended)

1. Use existing `imessage-parser` as primary
2. If result contains U+FFFD, fall back to multi-encoding attempts
3. Log problematic messages for manual review
4. Never silently drop content

## Acceptance Criteria

- [ ] Messages with non-ASCII characters (apostrophes, accents, emoji) are correctly imported
- [ ] NO message content is silently dropped or corrupted
- [ ] Previously corrupted messages can be recovered via re-import
- [ ] Unit tests cover multiple encoding scenarios
- [ ] Integration test with real corrupted message samples
- [ ] Logging identifies any messages that couldn't be fully decoded
- [ ] Re-import with "Force Reimport" recovers previously corrupted messages

## Test Cases Required

1. **UTF-8 with special characters**: "Let's meet at caf for rsum review"
2. **Emoji content**: "Great job! "
3. **Non-Latin scripts**: "" (Chinese), "" (Japanese), "" (Korean)
4. **Mixed content**: "Meeting at 3pm  - "
5. **Smart quotes**: ""Hello" and 'World'"
6. **Currency symbols**: "Price: 100, $50, 30"

## Estimated Tokens

~50,000-80,000 (complex investigation + multi-encoding implementation + extensive testing)

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing imports | High | Extensive regression testing |
| Performance degradation | Medium | Only fall back when needed |
| Incomplete fix | High | Log unrecoverable messages |
| Third-party library limitations | Medium | May need to fork/patch imessage-parser |

## Related Items

- BACKLOG-201: "00" prefix appearing before iMessage text (different issue - display layer)
- BACKLOG-203: Add Comprehensive Tests for macOSMessagesImportService
- BACKLOG-206: UI Freezing During iMessage Sync/Import

## Notes

**This is a CRITICAL data integrity issue.** A compliance/audit tool that silently loses message content is worse than useless - it gives users false confidence that their data is complete when it is not.

The fix must guarantee that:
1. All text content is preserved
2. Users are notified if any content couldn't be decoded
3. Re-import can recover previously corrupted messages

**DO NOT** simply strip replacement characters as a "fix" - this loses data.
