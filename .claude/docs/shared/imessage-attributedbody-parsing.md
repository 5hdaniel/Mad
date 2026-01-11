# iMessage attributedBody Parsing

## Overview

macOS Messages stores message content in an `attributedBody` column as a binary blob using Apple's NSKeyedArchiver format. This document explains how we parse it and the issues we've encountered.

## The Format

The `attributedBody` field contains an NSAttributedString serialized with NSKeyedArchiver. The structure is:

```
[bplist header]
[NSKeyedArchiver metadata]
[NSAttributedString class definition]
[NSString marker][length prefix bytes][actual message text]
[Attribute dictionaries (formatting, links, etc.)]
```

## Parsing Approach

We use a heuristic approach rather than full plist parsing:

1. Convert the binary buffer to UTF-8 string
2. Look for the "NSString" marker
3. Find readable text sequences after the marker
4. Select the longest sequence as the message text

See: `electron/utils/messageParser.ts`

## Known Issues & Fixes

### Issue: "00" Prefix Before Message Text

**Symptom:** Messages displayed with "00" at the beginning, like:
- "006 min away" instead of "6 min away"
- "00AHome!" instead of "AHome!"

**Root Cause:**
The NSKeyedArchiver format includes length prefix bytes before string data. When we convert the binary buffer to UTF-8, bytes like `0x30` (ASCII digit "0") are included in the extracted text.

For example, a length prefix of `0x30 0x30` (which might encode a length value) becomes the string "00" when interpreted as UTF-8.

**Fix (PR #381):**
Strip hex digit prefixes during extraction in `extractFromNSString()`:

```typescript
// Strip length prefix bytes that got decoded as hex digits
cleaned = cleaned.replace(/^[0-9A-Fa-f]{2}(?=[A-Za-z])/, "").trim();
cleaned = cleaned.replace(/^[0-9A-Fa-f]{2}(?=\d\s)/, "").trim();
```

**Display-Side Fallback:**
For existing data in the database, `ConversationViewModal.tsx` also sanitizes text at display time.

### Issue: Internal Attribute Names Leaking

**Symptom:** Messages showing `__kIMMessagePartAttributeName` or similar.

**Root Cause:**
The attributedBody contains attribute dictionaries with keys like `__kIMMessagePartAttributeName`. Our regex was matching these as "readable text."

**Fix:**
Filter out strings containing `__kIM`, `kIMMessagePart`, etc. in the extraction logic.

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
attributedBody (binary NSKeyedArchiver)
    │
    ▼ extractTextFromAttributedBody()
    │
Extracted text (may have artifacts)
    │
    ▼ cleanExtractedText()
    │
Cleaned text (stored in messages.body_text)
    │
    ▼ sanitizeMessageText() [display-side fallback]
    │
Final display text
```

## Re-importing Messages

After parser fixes, users should re-import messages to get clean data:

1. Settings → Messages → Re-sync
2. This re-parses all messages with the fixed logic
3. Old data with artifacts will be replaced

## Future Improvements

1. **Proper plist parsing**: Use a library like `bplist-parser` to properly decode NSKeyedArchiver format instead of string heuristics.

2. **Binary-aware extraction**: Work with the buffer directly instead of converting to UTF-8 string first.

3. **Reaction handling**: Better detection and display of tapback reactions.

## Related Files

- `electron/utils/messageParser.ts` - Core parsing logic
- `electron/constants.ts` - Regex patterns and constants
- `electron/services/macOSMessagesImportService.ts` - Import service
- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Display-side sanitization

## Related PRs

- PR #377 - Initial message text sanitization
- PR #379 - Hex pattern with newline handling
- PR #380 - Lookahead regex for direct prefix
- PR #381 - Root cause fix in parser
