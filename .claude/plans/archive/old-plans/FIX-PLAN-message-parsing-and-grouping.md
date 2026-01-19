# Fix Plan: Message Parsing and Grouping Bugs

## Executive Summary

Two independent bugs affecting message data integrity:

| Bug | Affected Messages | Root Cause | Impact |
|-----|------------------|------------|--------|
| **Eric Bug** | 48,514 (7.2%) | NULL `thread_id` + fallback ignores `chat_members` | Wrong participants in chats |
| **Garbage Text** | 35,834 (5.3%) | Binary data parsed as UTF-16 LE | Unreadable message content |

Total messages: 674,822
Healthy messages: 590,468 (87.5%)

---

## Bug 1: Eric in Wrong Chat

### Root Cause Analysis

**Data Flow:**
1. macOS Messages.db query uses `LEFT JOIN chat_message_join`
2. Messages without chat association get `chat_id = NULL`
3. Import sets `thread_id = NULL` for these messages
4. UI groups messages by `getThreadKey()` function
5. Fallback grouping uses only `from`/`to`, ignores `chat_members`

**The Bug:**
```typescript
// MessageThreadCard.tsx:368-400
function getThreadKey(msg: MessageLike): string {
  if (msg.thread_id) {
    return msg.thread_id;  // CORRECT: uses actual chat ID
  }

  // FALLBACK: Only uses from/to, IGNORES chat_members
  if (parsed.from) {
    allParticipants.add(normalizeParticipant(parsed.from));
  }
  if (parsed.to) { ... }
  // MISSING: chat_members check!
}
```

**Result:** Two different group chats with same sender merge into one thread.

### Proposed Fix

**File:** `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

**Change:** Add `chat_members` to fallback grouping in `getThreadKey()`:

```typescript
function getThreadKey(msg: MessageLike): string {
  if (msg.thread_id) {
    return msg.thread_id;
  }

  // FALLBACK: Include chat_members for proper grouping
  try {
    if (msg.participants) {
      const parsed = typeof msg.participants === 'string'
        ? JSON.parse(msg.participants)
        : msg.participants;

      const allParticipants = new Set<string>();

      // Include from
      if (parsed.from && parsed.from !== 'me') {
        allParticipants.add(normalizeParticipant(parsed.from));
      }

      // Include to
      if (parsed.to) {
        const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
        toList.forEach((p: string) => {
          if (p && p !== 'me') allParticipants.add(normalizeParticipant(p));
        });
      }

      // NEW: Include chat_members (critical for group chat distinction)
      if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
        parsed.chat_members.forEach((p: string) => {
          if (p && p !== 'me') allParticipants.add(normalizeParticipant(p));
        });
      }

      if (allParticipants.size > 0) {
        return `participants-${Array.from(allParticipants).sort().join('|')}`;
      }
    }
  } catch { }

  return `msg-${msg.id}`;
}
```

**Also update `getThreadParticipants()`** to use `chat_members` as authoritative source for group chat participant display.

### Risk Assessment

- **Low risk**: Change only affects fallback path (messages without thread_id)
- **No data migration needed**: Fix is display-side only
- **Immediate effect**: Will work on existing data without reimport

---

## Bug 2: Garbage Text (Binary as UTF-16 LE)

### Root Cause Analysis

**Data Flow:**
1. macOS Messages.db has `attributedBody` (binary blob)
2. `getMessageText()` tries to parse it
3. If proper parsers fail, heuristic fallback tries UTF-16 LE decoding
4. Binary data decoded as UTF-16 LE produces valid-looking CJK characters
5. Garbage text passes validation (no replacement chars) and gets stored

**The Bug:**
```typescript
// messageParser.ts:485-507
function extractUsingHeuristicsMultiEncoding(buffer: Buffer): string | null {
  // Try UTF-8 first
  let result = extractWithEncoding(buffer, "utf8");
  if (result && !containsReplacementChars(result)) {
    return result;
  }

  // BUG: UTF-16 LE decoding of binary produces garbage CJK text
  result = extractWithEncoding(buffer, "utf16le");
  if (result && !containsReplacementChars(result)) {
    return result;  // Returns garbage like "瑳敲浡祴数"
  }
  // ...
}
```

**Why it passes validation:**
- Binary bytes `73 74 72 65 61 6D` ("stream") become `瑳敲浡` as UTF-16 LE
- These are valid CJK characters, no replacement chars (U+FFFD)
- Current `looksLikeBinaryGarbage()` check only runs at display time, not storage time

### Proposed Fix (Two Parts)

#### Part A: Remove Unsafe UTF-16 LE Heuristic

**File:** `electron/utils/messageParser.ts`

**Change:** Remove UTF-16 LE from heuristic fallback:

```typescript
function extractUsingHeuristicsMultiEncoding(buffer: Buffer): string | null {
  // Only try UTF-8 for plain text fallback
  // UTF-16 LE decoding of binary data produces undetectable garbage

  let result = extractWithEncoding(buffer, "utf8");
  if (result && !containsReplacementChars(result)) {
    return result;
  }

  // REMOVED: UTF-16 LE heuristic (unsafe for binary data)
  // If UTF-8 fails, return null and let caller use fallback message

  return null;
}
```

#### Part B: Add Garbage Validation BEFORE Storage

**File:** `electron/services/macOSMessagesImportService.ts`

**Change:** Validate extracted text before storing:

```typescript
// In storeMessages(), after getMessageText():
const text = await getMessageText({
  text: msg.text,
  attributedBody: msg.attributedBody,
  cache_has_attachments: msg.cache_has_attachments,
});

// NEW: Validate extracted text is not garbage
if (isBinaryGarbage(text)) {
  // Use placeholder instead of storing garbage
  messageTexts.set(msg.guid, FALLBACK_MESSAGES.PARSING_ERROR);
  logService.warn("Garbage text detected during import", SERVICE_NAME, {
    guid: msg.guid,
    sample: text.substring(0, 50),
  });
} else {
  messageTexts.set(msg.guid, text);
}
```

**Also export `isBinaryGarbage` function** from messageParser.ts for use in import service.

#### Part C: Make `isBinaryGarbage()` Deterministic

**File:** `electron/utils/messageParser.ts`

**Change:** Remove threshold-based detection, use only exact pattern matching:

```typescript
export function isBinaryGarbage(text: string): boolean {
  if (!text || text.length < 3) return false;

  // EXACT binary signatures (deterministic)
  const BINARY_SIGNATURES = ["bplist00", "bplist", "streamtyped"];
  for (const sig of BINARY_SIGNATURES) {
    if (text.includes(sig)) return true;
  }

  // Apple metadata patterns (never in user text)
  const APPLE_METADATA = [
    "__kIM", "NSAttributedString", "NSMutableString",
    "NSDictionary", "kIMMessagePart", "$archiver", "$objects"
  ];
  for (const meta of APPLE_METADATA) {
    if (text.includes(meta)) return true;
  }

  // UTF-16 LE garbage patterns (exact translations)
  const UTF16_GARBAGE = [
    "瑳敲浡", "祴数", "䵓瑵", "楲杮", "瑁牴", "扩瑵"
  ];
  for (const pattern of UTF16_GARBAGE) {
    if (text.includes(pattern)) return true;
  }

  // Private Use Area characters (never in normal text)
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0xE000 && code <= 0xF8FF) return true;
    if (code >= 0xD800 && code <= 0xDFFF) return true; // Orphan surrogates
  }

  // NO THRESHOLD - all checks are deterministic
  return false;
}
```

### Risk Assessment

- **Medium risk**: Changes parsing behavior
- **Reimport required**: Existing garbage data won't be fixed automatically
- **Potential false positives**: Need to verify Chinese/Japanese users not affected

### Migration Strategy

For existing 35,834 garbage messages:
1. User triggers "Force Reimport" from Settings
2. Import service deletes existing messages
3. Fresh import with new validation
4. Messages that can't be parsed get placeholder text

---

## Implementation Order

1. **Eric Bug Fix (Low Risk)**
   - Update `getThreadKey()` in MessageThreadCard.tsx
   - Update `getThreadParticipants()` for display
   - No reimport needed, immediate effect

2. **Garbage Text Fix (Medium Risk)**
   - Export `isBinaryGarbage()` function
   - Add validation before storage in import service
   - Remove UTF-16 LE heuristic
   - Requires reimport for existing data

---

## Testing Plan

### Eric Bug
- [ ] Create test with two group chats having same sender but different members
- [ ] Verify they remain separate threads after fix
- [ ] Test with NULL thread_id messages

### Garbage Text
- [ ] Test with known garbage-producing messages
- [ ] Verify placeholder shown instead of garbage
- [ ] Test with legitimate Chinese/Japanese text (no false positives)
- [ ] Verify reimport fixes existing garbage

---

## Questions for SR Engineer Review

1. Should we also fix the LEFT JOIN in macOS import to INNER JOIN (excludes orphaned messages)?
2. Is removing UTF-16 LE heuristic safe, or should we keep it with garbage validation?
3. Should we add a migration script to fix existing garbage without full reimport?
4. Should the `isBinaryGarbage()` check be more aggressive or conservative?

---

## Files to Modify

| File | Changes |
|------|---------|
| `MessageThreadCard.tsx` | Update `getThreadKey()` and `getThreadParticipants()` |
| `messageParser.ts` | Export `isBinaryGarbage()`, remove UTF-16 LE heuristic |
| `macOSMessagesImportService.ts` | Add garbage validation before storage |

---

*Created: 2025-01-13*
*Status: DRAFT - Awaiting SR Engineer Review*
