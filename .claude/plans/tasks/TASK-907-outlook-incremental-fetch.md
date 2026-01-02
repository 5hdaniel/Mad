# TASK-907: Outlook Incremental Fetch

**Sprint:** SPRINT-014
**Backlog:** BACKLOG-090
**Priority:** HIGH
**Category:** service
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 4-6 turns, ~20K tokens, 20-30 min

---

## Goal

Modify Outlook/Microsoft Graph fetch to only retrieve emails newer than the last successful sync.

## Non-Goals

- Do NOT modify Gmail fetch (that's TASK-906)
- Do NOT implement dedup logic
- Do NOT change email parsing/storage

---

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/services/outlookFetchService.ts` | Add `receivedDateTime` filter |

---

## Implementation Notes

### Microsoft Graph Date Filter

```typescript
// In outlookFetchService.ts

async function fetchEmailsSince(userId: string, lastSyncAt: Date | null): Promise<ParsedEmail[]> {
  // Build OData filter
  let filter = '';

  if (lastSyncAt) {
    // Microsoft Graph uses ISO 8601 format
    filter = `receivedDateTime ge ${lastSyncAt.toISOString()}`;
    console.log(`[Outlook] Fetching emails since ${lastSyncAt.toISOString()}`);
  } else {
    // First sync: limit to recent emails (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    filter = `receivedDateTime ge ${ninetyDaysAgo.toISOString()}`;
    console.log('[Outlook] First sync: fetching last 90 days');
  }

  // Use the filter in Microsoft Graph API call
  // GET /me/messages?$filter=receivedDateTime ge 2024-01-01T00:00:00Z
  const response = await graphClient.api('/me/messages')
    .filter(filter)
    .orderby('receivedDateTime desc')
    .top(100) // pagination
    .get();

  // ... existing fetch logic
}
```

### Integration Point

```typescript
// In the sync orchestrator or wherever Outlook sync is triggered

async function syncOutlookEmails(userId: string) {
  const lastSyncAt = await databaseService.getOAuthTokenSyncTime(userId, 'microsoft');

  const emails = await outlookFetchService.fetchEmailsSince(userId, lastSyncAt);

  // ... process and store emails ...

  // Only update timestamp AFTER successful storage
  await databaseService.updateOAuthTokenSyncTime(userId, 'microsoft', new Date());

  console.log(`[Outlook] Sync complete. Fetched ${emails.length} new emails.`);
}
```

---

## Acceptance Criteria

- [ ] Outlook fetch uses `$filter=receivedDateTime ge` when `last_sync_at` exists
- [ ] First sync gracefully handles null timestamp (last 90 days)
- [ ] `last_sync_at` updated ONLY after successful storage
- [ ] Logs show "Fetching emails since [date]" for debugging
- [ ] Reuses `getOAuthTokenSyncTime()` from TASK-906
- [ ] Unit tests for date filtering logic
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use ISO 8601 format for Microsoft Graph filter
- Reuse database methods from TASK-906
- Add logging for debugging
- Handle null/undefined lastSyncAt gracefully

### Don't
- Modify Gmail service
- Change email parsing logic
- Update timestamp before emails are stored
- Duplicate database helper methods

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Microsoft Graph API filtering works differently than expected
- Need to handle delta queries instead of date filtering
- Pagination interacts unexpectedly with date filtering

---

## Testing Expectations

- Unit test date filter construction
- Integration test: first sync (null timestamp) works
- Integration test: subsequent sync only fetches new emails
- Manual verification: check logs show date filter

---

## PR Preparation

**Branch:** `feature/TASK-907-outlook-incremental`
**Title:** `feat(sync): implement incremental Outlook fetch with date filtering`
**Labels:** `feature`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-906, TASK-908)
- **Depends On:** TASK-906 (for shared database methods)
- **Blocks:** TASK-911
