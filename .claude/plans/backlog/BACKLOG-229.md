# BACKLOG-229: Binary Plist Text Still Showing as Garbage (CRITICAL)

## Priority: CRITICAL

## Problem Statement

Despite TASK-1035 fix, binary plist data is still appearing as garbage text in some messages. The `looksLikeBinaryGarbage` detection is not catching all cases.

## Example Garbage Output

```
଄瑳敲浡祴数腤ϨƄ葀蒄丙䵓瑵扡敬瑁牴扩瑵摥瑓楲杮萀ኄ华瑁牴扩瑵摥瑓楲杮萀ࢄ华扏敪瑣蔀蒒蒄丏䵓瑵扡敬瑓楲杮萁ࢄ华瑓楲杮锁Ƅ̫뿯蚼ʄ䥩ā蒒蒄丌䑓捩楴湯牡y蒕椁鈃预⚘彟䥫䉍獡坥楲楴杮楄敲瑣潩䅮瑴楲畢整慎敭銆蒄ࢄ华畎扭牥萀ބ华慖畬e蒕⨁蒄焁ﾟ銆预ᶘ彟䥫䵍獥慳敧慐瑲瑁牴扩瑵乥浡虥蒒麝龟蘀蒒题弢歟䵉楆敬牔湡晳牥啇䑉瑁牴扩瑵乥浡虥蒒题愩彴弰㐵䘸㙂䔴䄭㜳ⵆ㐴䕄㤭㤶ⴷ㜵㠴㜷㠸㝂㥁蚆
```

This is binary plist data (`streamtyped` format) being misinterpreted as UTF-16 text.

## Root Cause Analysis

The current `looksLikeBinaryGarbage` function checks for:
1. Literal "bplist" or "streamtyped" strings
2. >30% unusual characters (code > 255)

However, when binary data is read as UTF-16 and displayed as UTF-8:
- "streamtyped" becomes `瑳敲浡祴数` (garbled)
- The literal string check fails
- The 30% check may also fail depending on the specific bytes

## Symptoms

1. Messages with attachments (screenshots) show the image correctly
2. But the accompanying text shows as Chinese/Japanese-like garbage characters
3. Contains patterns like `_kIMBaseWritingDirectionAttributeName` encoded as garbage

## Files Affected

- `electron/utils/messageParser.ts` - `looksLikeBinaryGarbage` function
- `electron/services/macOSMessagesImportService.ts` - import uses `getMessageText`

## Proposed Fix

Improve binary garbage detection:
1. Check for UTF-16 interpreted binary patterns
2. Detect `__kIM` metadata even when garbled
3. Check for specific byte sequences that indicate binary plist
4. Lower the threshold for unusual character detection

## Related

- TASK-1035: Original binary plist fix (incomplete)
- BACKLOG-215: iMessage Encoding Corruption
- SPRINT-034: Stability fixes

## Acceptance Criteria

- [ ] No garbage text appearing in message conversations
- [ ] Binary plist data properly parsed and displayed as readable text
- [ ] Works for both fresh imports and existing data

## Created

2025-01-13
