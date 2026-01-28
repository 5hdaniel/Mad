# BACKLOG-090: Incremental Sync - Only Process New Data

## Priority: High

## Summary

Optimize LLM processing costs by only analyzing data that arrived since the last sync, rather than re-processing all historical data.

## Problem

Currently, when syncing emails or iPhone data, we may re-process messages that have already been analyzed by the LLM, wasting API costs and time.

## Data Sources & Sync Timestamps

### Email (Gmail/Outlook)
| Location | Field | Notes |
|----------|-------|-------|
| `oauth_tokens` table | `last_sync_at` | Per-provider sync timestamp |
| `messages` table | `received_at` | Message received date |

### iPhone (iMessage/Contacts)
| Location | Field | Notes |
|----------|-------|-------|
| Backup file | `lastModified` | File modification time |
| `messages` table | `sent_at` / `received_at` | Message timestamps |
| `useIPhoneSync` hook | `lastSyncTime` | In-memory, from backup status |

## Implementation

### 1. Email Sync Optimization

```typescript
// In email fetch service
async function fetchNewEmailsSince(userId: string, provider: 'google' | 'microsoft') {
  // Get last sync timestamp from oauth_tokens
  const token = await databaseService.getOAuthToken(userId, provider, 'mailbox');
  const lastSync = token?.last_sync_at;

  // Build query with date filter
  const query = lastSync
    ? { after: new Date(lastSync) }
    : { maxResults: 600 }; // First sync: limit to recent

  const emails = await fetchEmails(query);

  // Update last_sync_at after successful fetch
  await databaseService.updateOAuthTokenSyncTime(userId, provider, new Date());

  return emails;
}
```

### 2. iPhone Sync Optimization

```typescript
// Already partially implemented via external_id deduplication
// Enhancement: Skip parsing if backup hasn't changed

async function shouldProcessBackup(backupPath: string, lastSyncTime: Date | null) {
  const backupModified = await getBackupModifiedTime(backupPath);
  return !lastSyncTime || backupModified > lastSyncTime;
}
```

### 3. LLM Processing Filter

```typescript
// In extraction pipeline
async function getMessagesForLLMAnalysis(userId: string) {
  return await db.query(`
    SELECT * FROM messages
    WHERE user_id = ?
    AND is_transaction_related IS NULL  -- Not yet analyzed
    AND classification_method IS NULL   -- No classification yet
  `, [userId]);
}
```

## Acceptance Criteria

- [ ] Email sync only fetches messages newer than `last_sync_at`
- [ ] `last_sync_at` is updated after each successful sync
- [ ] iPhone sync skips unchanged backups
- [ ] LLM pipeline only processes unanalyzed messages
- [ ] First-time sync handles no-timestamp case gracefully
- [ ] Logs show "Fetched X new messages since Y" for debugging

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Email sync optimization | 0.5 sprint |
| iPhone sync enhancement | 0.25 sprint |
| LLM filter integration | 0.25 sprint |
| **Total** | 1 sprint |

## Dependencies

- SPRINT-007 (Cost Optimization) - provides base infrastructure
- Existing `external_id` deduplication for iPhone sync

## Cost Impact

Prevents re-processing of already-analyzed emails, potentially reducing LLM costs by 50-90% for returning users with large mailboxes.
