# BACKLOG-201: "00" prefix appearing before iMessage text in conversation views

## Category
Bug

## Priority
Medium (UX impact - confusing garbage text in messages)

## Status
Completed

## Description
"00" text was appearing before every iMessage in conversation views. Instead of "Hey it's daniel", users saw "00\nHey it's daniel".

## Root Cause Analysis

### Initial Assumptions (Wrong)
1. **First hypothesis:** "00" was embedded in message data from iMessage parsing (typedstream format)
   - Added debug logging to `messageParser.ts` during import - showed CLEAN data

2. **Second hypothesis:** Client-side rendering issue
   - Added sanitization in new `messageSanitizer.ts` - didn't fix it
   - Added more aggressive debug logging in UI - still showed CLEAN data

### Breakthrough
User inspected element in browser DevTools, revealing "00" was a **TEXT NODE outside the message `<p>` tag**.

### Actual Root Cause
`msg.has_attachments` is a **number** (0 or 1) from SQLite, not a boolean.

In JavaScript: `0 && anything` returns `0` (not `false`)
React renders the number `0` as text "0"

Two JSX conditionals used `{msg.has_attachments && ...}`, each rendering "0" = "00"

## Fix Applied
Changed `{msg.has_attachments &&` to `{!!msg.has_attachments &&` (2 instances)

**Files Changed:**
- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx`
  - Lines 366, 376: Added `!!` boolean coercion

## Cleanup Performed
Removed investigation artifacts that didn't solve the issue:
- Reverted debug logging from `electron/utils/messageParser.ts`
- Deleted `src/utils/messageSanitizer.ts` (created during investigation)
- Removed sanitizer imports from `MessageThreadCard.tsx`
- Reverted sanitizer usage in `ConversationViewModal.tsx`

## Key Learnings

| Learning | Details |
|----------|---------|
| SQLite boolean storage | SQLite stores booleans as integers (0/1), not true/false |
| React 0 rendering | React renders `0` as text, but not `false`, `null`, or `undefined` |
| Boolean coercion pattern | Always use `!!field` or `Boolean(field)` when using numeric DB fields in JSX conditionals |
| DevTools breakthrough | Browser "Inspect Element" was the breakthrough - showing "00" was a separate text node outside expected DOM structure |

## Effort Analysis

| Phase | Time | Notes |
|-------|------|-------|
| Investigation | ~2-3 hours | Wrong initial assumptions led down rabbit holes (parser debugging, sanitizer creation) |
| Actual fix | ~5 minutes | 2 lines of code change |
| Cleanup | ~15 minutes | Remove dead-end code artifacts |
| **Total** | **~3 hours** | **Ratio: 36:1 investigation to fix** |

## Preventive Measures
Consider adding ESLint rule or documentation note:
- Any SQLite integer field used in JSX conditionals should use boolean coercion
- Especially: `has_attachments`, `is_read`, `is_from_me`, etc.

## Related
- ConversationViewModal.tsx
- SQLite boolean handling patterns
- React conditional rendering quirks

## Review Status
- [x] SR Engineer: APPROVED
- [x] Ready for merge

## Created
2026-01-11

## Completed
2026-01-11
