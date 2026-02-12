# BACKLOG-617: Message Import Lookback Setting

## Summary

Add a user-configurable setting to limit how far back messages are imported during sync. This addresses disk space concerns since message attachments are COPIED to the local database during import.

## Problem

Currently, message import copies ALL messages and their attachments from the Messages database to the local MagicAudit database. For users with years of message history and large attachments, this can:
- Consume significant disk space (attachments are copied, not referenced)
- Slow down initial import significantly
- Potentially fail if disk space is insufficient

## Solution

Add a "Message Lookback Period" setting with the following options:
- **Last 30 days** - Minimal storage, recent messages only
- **Last 6 months** (Recommended) - Good balance of history and storage
- **Last year** - More history for active users
- **Last 2 years** - Extended history
- **All messages** - Complete history (current behavior)

## Implementation

### 1. Settings UI (Settings > Sync Preferences)

Add a new dropdown/select in the Settings UI:
```
Message Import Range
[Last 6 months (Recommended) ▼]

Only messages within this range will be imported.
Attachments are copied locally, so shorter ranges use less disk space.
```

### 2. Filter Messages DB Query

In `electron/services/macOSMessagesImportService.ts`, modify the query to filter by date:

```typescript
// Current query fetches all messages
// Add date filter based on user setting
const lookbackDate = calculateLookbackDate(userSetting);
const query = `
  SELECT * FROM message
  WHERE date > ${lookbackDate}
  ORDER BY date DESC
`;
```

### 3. Attachment Handling

Only copy attachments for messages within the selected date range. The attachment copy logic is at line 1272:
```typescript
await fs.promises.copyFile(sourcePath, destPath);
```

This should only execute for messages within the lookback period.

### 4. Default Value

New installs: **Last 6 months** (recommended)
Existing installs: **All messages** (preserve current behavior)

## Files to Modify

1. `src/components/settings/SyncSettings.tsx` - Add UI control
2. `electron/services/macOSMessagesImportService.ts` - Add date filtering
3. `electron/handlers/preferencesHandlers.ts` - Store/retrieve setting
4. `src/types/preferences.ts` - Add type for setting

## Acceptance Criteria

- [ ] Setting visible in Settings > Sync Preferences
- [ ] "Last 6 months" is pre-selected for new users
- [ ] Message query filters by selected date range
- [ ] Only attachments for included messages are copied
- [ ] Setting persists across app restarts
- [ ] Existing users default to "All messages" to preserve behavior

## Estimates

- **Effort**: ~15K tokens
- **Priority**: Medium
- **Category**: Feature

## References

- `electron/services/macOSMessagesImportService.ts:1272` - Attachment copy logic
- Discussion: Disk space concerns when importing large message histories
