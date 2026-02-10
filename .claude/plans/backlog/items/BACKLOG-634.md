# BACKLOG-634: Message Import Date Filter (Default 6 Months)

## Priority: High
## Category: Performance
## Status: Pending

## Summary

Add a configurable date cutoff to the macOS message import pipeline so only recent messages (default: last 6 months) are imported from `~/Library/Messages/chat.db`. This filters at the SQL query level to avoid reading, parsing, and deduplicating old messages entirely.

## Problem

Users with large iMessage histories (600K+ messages spanning years) experience slow imports and high memory usage. Most of these old messages are irrelevant to current real estate transactions.

## Implementation Plan

### 1. Add constant and parameter

**File:** `electron/services/macOSMessagesImportService.ts`

- Add `DEFAULT_IMPORT_MONTHS = 6` constant near line 132
- Add `importSinceMonths` optional parameter to `importMessages()` (line 290)
- Mac epoch conversion: `(cutoff.getTime() / 1000 - 978307200) * 1e9`

### 2. Filter at three SQL touch points

All queries against macOS `chat.db` need `AND message.date > ?` with the Mac epoch cutoff:

1. **COUNT query** (line 473) — accurate progress reporting
2. **Main SELECT** (line 583) — message data fetch
3. **Attachment query** (line 631) — also joins on `message`

### 3. UI consideration (optional/future)

- Settings option to let users pick import window (1 month, 3 months, 6 months, 1 year, all)
- Default to 6 months for new users
- "Import all" option for users who need full history

## Estimated Effort

~8K tokens — straightforward SQL filter addition with timestamp conversion.

## Related Items

- BACKLOG-335: Transaction-level date filtering (different scope — per-transaction, not global import)

## Acceptance Criteria

- [ ] Only messages from the last 6 months are imported by default
- [ ] `importSinceMonths` parameter allows override
- [ ] COUNT query matches actual imported count (progress bar accurate)
- [ ] Attachment query also respects the date filter
- [ ] Force reimport respects the same filter
- [ ] No regression for users with small message histories
