# TASK-906: Gmail Incremental Fetch

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

Modify Gmail fetch to only retrieve emails newer than the last successful sync, reducing API calls and LLM processing costs.

## Non-Goals

- Do NOT modify Outlook fetch (that's TASK-907)
- Do NOT implement dedup logic
- Do NOT change email parsing/storage

---

## Current State

Gmail fetch currently retrieves all emails matching the query without date filtering. The `oauth_tokens` table has a `last_sync_at` field that isn't being used.

---

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/services/gmailFetchService.ts` | Add date filter to search query |
| `electron/services/databaseService.ts` | Add `updateOAuthTokenSyncTime()` method |

---

## Implementation Notes

### Gmail Date Filter

```typescript
// In gmailFetchService.ts - modify searchEmails or equivalent

async function fetchEmailsSince(userId: string, lastSyncAt: Date | null): Promise<ParsedEmail[]> {
  // Build Gmail query with date filter
  let query = 'category:primary OR category:updates';

  if (lastSyncAt) {
    // Gmail uses 'after:' with Unix timestamp or YYYY/MM/DD format
    const afterDate = Math.floor(lastSyncAt.getTime() / 1000);
    query += ` after:${afterDate}`;
    console.log(`[Gmail] Fetching emails since ${lastSyncAt.toISOString()}`);
  } else {
    // First sync: limit to recent emails (last 90 days)
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    query += ` after:${ninetyDaysAgo}`;
    console.log('[Gmail] First sync: fetching last 90 days');
  }

  // ... existing fetch logic with modified query
}
```

### Database Helper

```typescript
// In databaseService.ts

async updateOAuthTokenSyncTime(
  userId: string,
  provider: 'google' | 'microsoft',
  syncTime: Date
): Promise<void> {
  await this.db.run(`
    UPDATE oauth_tokens
    SET last_sync_at = ?
    WHERE user_id = ? AND provider = ? AND scope = 'mailbox'
  `, [syncTime.toISOString(), userId, provider]);
}

async getOAuthTokenSyncTime(
  userId: string,
  provider: 'google' | 'microsoft'
): Promise<Date | null> {
  const row = await this.db.get(`
    SELECT last_sync_at FROM oauth_tokens
    WHERE user_id = ? AND provider = ? AND scope = 'mailbox'
  `, [userId, provider]);

  return row?.last_sync_at ? new Date(row.last_sync_at) : null;
}
```

### Integration Point

```typescript
// In the sync orchestrator or wherever Gmail sync is triggered

async function syncGmailEmails(userId: string) {
  const lastSyncAt = await databaseService.getOAuthTokenSyncTime(userId, 'google');

  const emails = await gmailFetchService.fetchEmailsSince(userId, lastSyncAt);

  // ... process and store emails ...

  // Only update timestamp AFTER successful storage
  await databaseService.updateOAuthTokenSyncTime(userId, 'google', new Date());

  console.log(`[Gmail] Sync complete. Fetched ${emails.length} new emails.`);
}
```

---

## Acceptance Criteria

- [ ] Gmail fetch uses `after:` filter when `last_sync_at` exists
- [ ] First sync gracefully handles null timestamp (last 90 days)
- [ ] `last_sync_at` updated ONLY after successful storage
- [ ] Logs show "Fetching emails since [date]" for debugging
- [ ] `updateOAuthTokenSyncTime()` method added to databaseService
- [ ] `getOAuthTokenSyncTime()` method added to databaseService
- [ ] Unit tests for new database methods
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Do / Don't

### Do
- Use Unix timestamp format for Gmail `after:` filter
- Update timestamp AFTER successful DB persistence
- Add logging for debugging
- Handle null/undefined lastSyncAt gracefully

### Don't
- Modify Outlook service (that's TASK-907)
- Change email parsing logic
- Update timestamp before emails are stored

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- `oauth_tokens` table structure is different than expected
- Gmail API date filtering works differently
- Need to handle pagination with date filtering

---

## Testing Expectations

- Unit test `getOAuthTokenSyncTime()` and `updateOAuthTokenSyncTime()`
- Integration test: first sync (null timestamp) works
- Integration test: subsequent sync only fetches new emails
- Manual verification: check logs show date filter

---

## PR Preparation

**Branch:** `feature/TASK-906-gmail-incremental`
**Title:** `feat(sync): implement incremental Gmail fetch with date filtering`
**Labels:** `feature`, `SPRINT-014`

---

## SR Engineer Review Notes

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop

### Execution Classification
- **Parallel Safe:** Yes (with TASK-907, TASK-908)
- **Depends On:** None (Phase 1 complete)
- **Blocks:** TASK-909 (must merge before TASK-909 starts - same file)
