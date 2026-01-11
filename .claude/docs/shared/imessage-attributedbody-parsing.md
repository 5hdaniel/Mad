# iMessage attributedBody Parsing

## Overview

macOS Messages stores message content in an `attributedBody` column as a binary blob using Apple's NSKeyedArchiver format. This document explains how we parse it and the issues we've encountered.

## The Format

The `attributedBody` field contains an NSAttributedString serialized with NSKeyedArchiver in binary plist (bplist) format. The structure is:

```
[bplist header - "bplist00"]
[NSKeyedArchiver metadata]
  - $archiver: "NSKeyedArchiver"
  - $version: 100000
  - $top: { root: UID }
  - $objects: [array of archived objects]
[Objects include:]
  - NSAttributedString class
  - NSString with actual message text
  - Attribute dictionaries (formatting, links, etc.)
```

## Parsing Approach (PR #384)

**Current Implementation:** Uses proper bplist parsing via `bplist-parser` library.

### How It Works

1. **Parse binary plist** using `bplist-parser.parseBuffer()`
2. **Navigate NSKeyedArchiver structure** - look for `$objects` array
3. **Extract text** from `$objects`:
   - Find string objects that aren't metadata (skip "NS*", "$*" prefixes)
   - Check for `NS.string` keys in dictionary objects
   - Return the longest non-metadata string as the message text
4. **Fallback to heuristics** if bplist parsing fails

### Why This Approach

The previous heuristic approach had issues:
- Converting binary to UTF-8 caused encoding artifacts
- Length prefix bytes (like `0x30 0x30`) became "00" text
- Regex-based extraction was fragile

The bplist parser gives us clean, structured access to the archived data.

See: `electron/utils/messageParser.ts`

## Known Issues & Fixes

### Issue: "00" Prefix Before Message Text (FIXED in PR #384)

**Symptom:** Messages displayed with "00" at the beginning, like:
- "006 min away" instead of "6 min away"
- "00AHome!" instead of "AHome!"

**Root Cause:**
The NSKeyedArchiver format includes length prefix bytes before string data. The old heuristic approach converted the binary buffer to UTF-8, which caused bytes like `0x30 0x30` to become "00".

**Fix:**
Use proper bplist parsing which correctly interprets the binary format and extracts only the actual string content, without any length prefix bytes.

**Migration:**
For existing data in the database, either:
1. Re-import messages (Settings → Messages → Re-sync with full re-import)
2. The display-side `sanitizeMessageText()` in `ConversationViewModal.tsx` will clean up old data

### Issue: Internal Attribute Names Leaking

**Symptom:** Messages showing `__kIMMessagePartAttributeName` or similar.

**Root Cause:**
The attributedBody contains attribute dictionaries with keys like `__kIMMessagePartAttributeName`.

**Fix:**
Both the bplist parser extraction and the fallback heuristic method filter out strings containing `__kIM`, `kIMMessagePart`, etc.

### Issue: Reactions Showing Raw Data

**Symptom:** Messages showing Hebrew text like "סימון ״אהבתי״ ל:" or binary garbage.

**Root Cause:**
Reactions (tapbacks) have a different attributedBody structure. The Hebrew text is macOS's localized "Liked" indicator.

**Current Handling:**
These are filtered as system messages. The `text` field is preferred when available.

## Data Flow

```
macOS Messages DB (chat.db)
    │
    ▼
attributedBody (binary NSKeyedArchiver/bplist)
    │
    ▼ bplistParser.parseBuffer()
    │
Parsed NSKeyedArchiver structure
    │
    ▼ extractTextFromNSKeyedArchiver()
    │
Clean message text (no encoding artifacts)
    │
    ▼ cleanExtractedText()
    │
Final text (stored in messages.body_text)
```

## Re-importing Messages

After parser fixes, users can re-import messages to get clean data:

1. Settings → Messages → Re-sync (or full re-import option)
2. This re-parses all messages with the new bplist parser
3. Old data with "00" artifacts will be replaced with clean text

**Note:** Incremental sync only imports new messages. For existing messages with artifacts, a full re-import is needed.

## Technical Details

### NSKeyedArchiver Structure

```javascript
{
  "$archiver": "NSKeyedArchiver",
  "$version": 100000,
  "$top": { "root": { "UID": 1 } },
  "$objects": [
    "$null",                           // Index 0: null placeholder
    { "NS.string": { "UID": 2 } },     // Index 1: NSAttributedString
    "Hello, this is the message",      // Index 2: Actual string content
    // ... more objects (attributes, classes, etc.)
  ]
}
```

### UID References

Objects in `$objects` reference each other using UID objects:
```javascript
{ "UID": 2 }  // Points to $objects[2]
```

The `resolveUID()` helper function handles these references.

## Dependencies

- `bplist-parser` (via `simple-plist` which includes it)

## Related Files

- `electron/utils/messageParser.ts` - Core parsing logic with bplist support
- `electron/constants.ts` - Fallback messages and constants
- `electron/services/macOSMessagesImportService.ts` - Import service (calls parser)
- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Display-side sanitization (fallback for old data)

## Related PRs

- PR #377 - Initial message text sanitization (display-side)
- PR #379 - Hex pattern with newline handling
- PR #380 - Lookahead regex for direct prefix
- PR #381 - Improved regex in parser
- PR #384 - **Proper bplist parsing (root cause fix)**
