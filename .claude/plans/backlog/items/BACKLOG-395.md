# BACKLOG-395: Desktop - Status Sync + Review Notes Display

**Priority:** P0 (Critical)
**Category:** service / ui / desktop
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~25K

---

## Summary

Create a service to sync submission status changes from Supabase cloud to the local SQLite database, and display broker review notes to the agent when changes are requested.

---

## Problem Statement

After an agent submits a transaction, the broker reviews it in the web portal. The agent needs to:
1. See status changes (under_review, needs_changes, approved, rejected)
2. Read broker feedback when changes are requested
3. Know when to resubmit after making corrections

Currently, there's no mechanism to sync cloud status back to the desktop app.

---

## Proposed Solution

### Sync Service

Create `electron/services/submissionSyncService.ts`:

```typescript
interface SyncResult {
  updated: number;
  failed: number;
  details: Array<{
    transactionId: string;
    oldStatus: SubmissionStatus;
    newStatus: SubmissionStatus;
    reviewNotes?: string;
  }>;
}

class SubmissionSyncService {
  /**
   * Sync status for all submitted transactions
   */
  async syncAllSubmissions(): Promise<SyncResult>;

  /**
   * Sync status for a specific transaction
   */
  async syncSubmission(transactionId: string): Promise<boolean>;

  /**
   * Start periodic sync (polling)
   */
  startPeriodicSync(intervalMs?: number): void;

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void;
}
```

### Sync Implementation

```typescript
async syncAllSubmissions(): Promise<SyncResult> {
  // 1. Get all local transactions with submission_id
  const submittedTransactions = await db.query(`
    SELECT id, submission_id, submission_status, last_review_notes
    FROM transactions
    WHERE submission_id IS NOT NULL
    AND submission_status NOT IN ('approved', 'rejected')
  `);
  
  if (submittedTransactions.length === 0) {
    return { updated: 0, failed: 0, details: [] };
  }
  
  // 2. Fetch cloud statuses
  const submissionIds = submittedTransactions.map(t => t.submission_id);
  const { data: cloudStatuses, error } = await supabase
    .from('transaction_submissions')
    .select('id, status, review_notes, reviewed_at, reviewed_by')
    .in('id', submissionIds);
  
  if (error) throw error;
  
  // 3. Compare and update
  const results: SyncResult = { updated: 0, failed: 0, details: [] };
  
  for (const local of submittedTransactions) {
    const cloud = cloudStatuses.find(c => c.id === local.submission_id);
    if (!cloud) continue;
    
    // Check if status changed
    if (cloud.status !== local.submission_status || 
        cloud.review_notes !== local.last_review_notes) {
      
      try {
        await db.run(`
          UPDATE transactions
          SET submission_status = ?,
              last_review_notes = ?
          WHERE id = ?
        `, [cloud.status, cloud.review_notes, local.id]);
        
        results.updated++;
        results.details.push({
          transactionId: local.id,
          oldStatus: local.submission_status,
          newStatus: cloud.status,
          reviewNotes: cloud.review_notes
        });
        
        // Emit event for UI notification
        if (cloud.status !== local.submission_status) {
          this.emitStatusChange(local.id, cloud.status, cloud.review_notes);
        }
        
      } catch (e) {
        results.failed++;
      }
    }
  }
  
  return results;
}
```

### Periodic Polling

```typescript
private syncInterval: NodeJS.Timeout | null = null;

startPeriodicSync(intervalMs = 60000) { // Default: 1 minute
  if (this.syncInterval) return;
  
  this.syncInterval = setInterval(async () => {
    try {
      await this.syncAllSubmissions();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }, intervalMs);
  
  // Also sync immediately on start
  this.syncAllSubmissions().catch(console.error);
}

stopPeriodicSync() {
  if (this.syncInterval) {
    clearInterval(this.syncInterval);
    this.syncInterval = null;
  }
}
```

### UI Notifications

When status changes to `needs_changes`:

```typescript
emitStatusChange(transactionId: string, newStatus: string, reviewNotes?: string) {
  // Emit to renderer for toast notification
  mainWindow?.webContents.send('submission-status-changed', {
    transactionId,
    newStatus,
    reviewNotes,
    title: this.getNotificationTitle(newStatus),
    message: this.getNotificationMessage(newStatus, reviewNotes)
  });
}

getNotificationTitle(status: SubmissionStatus): string {
  switch (status) {
    case 'under_review': return 'Submission Under Review';
    case 'needs_changes': return 'Changes Requested';
    case 'approved': return 'Submission Approved!';
    case 'rejected': return 'Submission Rejected';
    default: return 'Submission Status Updated';
  }
}
```

### Review Notes Display

In the transaction detail page, when `submission_status === 'needs_changes'`:

```tsx
{transaction.submission_status === 'needs_changes' && (
  <ReviewNotesPanel
    notes={transaction.last_review_notes}
    reviewedAt={transaction.reviewed_at}
    onResubmit={() => handleResubmit(transaction.id)}
  />
)}
```

Component:

```tsx
function ReviewNotesPanel({ notes, reviewedAt, onResubmit }) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h3 className="font-semibold text-orange-700">Changes Requested</h3>
      </div>
      
      <blockquote className="border-l-4 border-orange-300 pl-4 my-3 italic">
        "{notes}"
      </blockquote>
      
      {reviewedAt && (
        <p className="text-sm text-gray-500">
          Reviewed on {formatDate(reviewedAt)}
        </p>
      )}
      
      <button
        onClick={onResubmit}
        className="mt-3 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
      >
        Resubmit for Review
      </button>
    </div>
  );
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/services/submissionSyncService.ts` | New service file |
| `electron/main.ts` | Start periodic sync on app ready |
| `electron/preload/preload.ts` | Expose sync API and events |
| `src/hooks/useSubmissionSync.ts` | React hook for UI |
| `src/components/transactionDetailsModule/components/ReviewNotesPanel.tsx` | New component |
| `src/components/Notifications/SubmissionStatusToast.tsx` | New toast component |

---

## Dependencies

- BACKLOG-390: Local schema (submission_status, last_review_notes fields)
- BACKLOG-394: Transaction push service (creates submission_id)

---

## Acceptance Criteria

- [ ] Sync runs automatically on app start
- [ ] Sync runs periodically (configurable interval)
- [ ] Manual sync trigger available
- [ ] Local status updated when cloud status changes
- [ ] Review notes stored locally
- [ ] Toast notification on status change
- [ ] Review notes panel shows in transaction detail
- [ ] Resubmit button available when changes requested
- [ ] Sync doesn't run for approved/rejected (terminal states)
- [ ] Sync handles offline gracefully (skip, retry later)

---

## Technical Notes

### Polling vs Realtime

For demo, polling is acceptable:
- Simpler implementation
- Works offline (just skips sync)
- 1-minute interval is responsive enough

**Production Enhancement:** Use Supabase Realtime subscriptions for instant updates.

### Auth Context

Use service key for sync queries (same as submission):

```typescript
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
```

### Offline Handling

```typescript
async syncAllSubmissions(): Promise<SyncResult> {
  if (!navigator.onLine) {
    console.log('Offline, skipping sync');
    return { updated: 0, failed: 0, details: [] };
  }
  // ... rest of sync
}
```

### App Lifecycle

```typescript
// In main.ts
app.on('ready', () => {
  // Start sync after auth is confirmed
  authService.onAuthenticated(() => {
    submissionSyncService.startPeriodicSync();
  });
});

app.on('before-quit', () => {
  submissionSyncService.stopPeriodicSync();
});
```

### React Integration

```typescript
// useSubmissionSync.ts
export function useSubmissionSync() {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  useEffect(() => {
    // Listen for status change events
    const unsubscribe = window.api.onSubmissionStatusChanged((data) => {
      // Trigger local state refresh
      queryClient.invalidateQueries(['transaction', data.transactionId]);
      
      // Show toast
      toast.info(data.title, { description: data.message });
    });
    
    return unsubscribe;
  }, []);
  
  const syncNow = async () => {
    setSyncing(true);
    try {
      await window.api.syncSubmissions();
      setLastSynced(new Date());
    } finally {
      setSyncing(false);
    }
  };
  
  return { lastSynced, syncing, syncNow };
}
```

---

## Testing Plan

1. Submit transaction, verify initial sync sees 'submitted'
2. Change status in Supabase directly, verify sync updates local
3. Add review notes in Supabase, verify notes synced
4. Test toast notification on status change
5. Test review notes panel display
6. Test resubmit from panel
7. Test offline behavior (no crash, graceful skip)
8. Test sync stops for terminal states
9. Test periodic sync interval

---

## Related Items

- BACKLOG-390: Local Schema Changes (dependency)
- BACKLOG-391: Submit UI (displays status)
- BACKLOG-394: Transaction Push (creates submissions)
- BACKLOG-400: Review Actions (broker side)
- SPRINT-050: B2B Broker Portal Demo
