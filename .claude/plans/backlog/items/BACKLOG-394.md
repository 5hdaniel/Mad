# BACKLOG-394: Desktop - Transaction Push Service

**Priority:** P0 (Critical)
**Category:** service / desktop
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~35K

---

## Summary

Create a service to push complete transaction data (transaction details, messages, and attachment metadata) from local SQLite to Supabase cloud for broker review.

---

## Problem Statement

When an agent submits a transaction for review, we need to:
1. Collect all transaction data from local SQLite
2. Collect all linked messages
3. Upload attachments first (BACKLOG-393)
4. Push transaction record to `transaction_submissions`
5. Push messages to `submission_messages`
6. Push attachment metadata to `submission_attachments`
7. Update local submission status
8. Handle resubmissions (version tracking)

---

## Proposed Solution

### Service Architecture

Create `electron/services/submissionService.ts`:

```typescript
interface SubmissionResult {
  success: boolean;
  submissionId: string | null;
  error?: string;
  attachmentsFailed: number;
  messagesCount: number;
  attachmentsCount: number;
}

interface SubmissionProgress {
  stage: 'preparing' | 'attachments' | 'transaction' | 'messages' | 'complete' | 'failed';
  stageProgress: number;  // 0-100 within current stage
  overallProgress: number; // 0-100 total
  currentItem?: string;
}

class SubmissionService {
  /**
   * Submit a transaction for broker review
   */
  async submitTransaction(
    transactionId: string,
    onProgress?: (progress: SubmissionProgress) => void
  ): Promise<SubmissionResult>;

  /**
   * Resubmit a transaction (creates new version)
   */
  async resubmitTransaction(
    transactionId: string,
    onProgress?: (progress: SubmissionProgress) => void
  ): Promise<SubmissionResult>;

  /**
   * Get submission status from cloud
   */
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatus>;
}
```

### Submission Flow

```typescript
async submitTransaction(
  transactionId: string,
  onProgress?: (progress: SubmissionProgress) => void
): Promise<SubmissionResult> {
  
  // 1. Prepare: Load local data
  onProgress?.({ stage: 'preparing', stageProgress: 0, overallProgress: 0 });
  
  const transaction = await this.loadTransaction(transactionId);
  const messages = await this.loadTransactionMessages(transactionId);
  const attachments = await this.loadTransactionAttachments(transactionId);
  const orgId = await this.getUserOrganizationId();
  
  if (!orgId) {
    throw new Error('User is not a member of any organization');
  }
  
  // 2. Generate submission ID
  const submissionId = crypto.randomUUID();
  
  // 3. Upload attachments (30% of progress)
  onProgress?.({ stage: 'attachments', stageProgress: 0, overallProgress: 10 });
  
  const attachmentResults = await this.uploadAttachments(
    orgId, submissionId, attachments,
    (pct) => onProgress?.({ 
      stage: 'attachments', 
      stageProgress: pct, 
      overallProgress: 10 + (pct * 0.3) 
    })
  );
  
  // 4. Push transaction to Supabase (20% of progress)
  onProgress?.({ stage: 'transaction', stageProgress: 0, overallProgress: 40 });
  
  const submissionRecord = this.mapToSubmission(transaction, orgId, submissionId);
  await this.insertSubmission(submissionRecord);
  
  onProgress?.({ stage: 'transaction', stageProgress: 100, overallProgress: 60 });
  
  // 5. Push messages (30% of progress)
  onProgress?.({ stage: 'messages', stageProgress: 0, overallProgress: 60 });
  
  const messageRecords = messages.map(m => this.mapToSubmissionMessage(m, submissionId));
  await this.insertMessages(messageRecords, (pct) => 
    onProgress?.({ stage: 'messages', stageProgress: pct, overallProgress: 60 + (pct * 0.3) })
  );
  
  // 6. Push attachment metadata (10% of progress)
  const attachmentRecords = attachmentResults
    .filter(r => r.success)
    .map(r => this.mapToSubmissionAttachment(r, submissionId));
  await this.insertAttachmentRecords(attachmentRecords);
  
  // 7. Update local status
  await this.updateLocalSubmissionStatus(transactionId, {
    submission_status: 'submitted',
    submission_id: submissionId,
    submitted_at: new Date().toISOString()
  });
  
  onProgress?.({ stage: 'complete', stageProgress: 100, overallProgress: 100 });
  
  return {
    success: true,
    submissionId,
    messagesCount: messages.length,
    attachmentsCount: attachmentResults.filter(r => r.success).length,
    attachmentsFailed: attachmentResults.filter(r => !r.success).length
  };
}
```

### Data Mapping

```typescript
mapToSubmission(transaction: LocalTransaction, orgId: string, submissionId: string): SubmissionRecord {
  return {
    id: submissionId,
    organization_id: orgId,
    submitted_by: this.getCurrentUserId(),
    local_transaction_id: transaction.id,
    property_address: transaction.property_address,
    property_city: transaction.property_city,
    property_state: transaction.property_state,
    property_zip: transaction.property_zip,
    transaction_type: transaction.transaction_type,
    listing_price: transaction.listing_price,
    sale_price: transaction.sale_price,
    started_at: transaction.started_at,
    closed_at: transaction.closed_at,
    status: 'submitted',
    message_count: 0,  // Updated after messages inserted
    attachment_count: 0,  // Updated after attachments inserted
    submission_metadata: {
      desktop_version: app.getVersion(),
      submitted_from_device: this.getDeviceId()
    }
  };
}

mapToSubmissionMessage(message: LocalMessage, submissionId: string): SubmissionMessageRecord {
  return {
    submission_id: submissionId,
    local_message_id: message.id,
    channel: message.channel,  // 'email', 'sms', 'imessage'
    direction: message.direction,
    subject: message.subject,
    body_text: message.body_text,
    participants: {
      from: message.from_address,
      to: message.to_addresses,
      cc: message.cc_addresses,
      bcc: message.bcc_addresses
    },
    sent_at: message.sent_at,
    thread_id: message.thread_id,
    has_attachments: message.attachment_count > 0,
    attachment_count: message.attachment_count
  };
}
```

### Resubmission Logic

```typescript
async resubmitTransaction(transactionId: string, ...): Promise<SubmissionResult> {
  const transaction = await this.loadTransaction(transactionId);
  
  if (!transaction.submission_id) {
    throw new Error('Transaction has not been submitted before');
  }
  
  // Get current version
  const { data: existingSubmission } = await supabase
    .from('transaction_submissions')
    .select('version')
    .eq('id', transaction.submission_id)
    .single();
  
  const newVersion = (existingSubmission?.version || 1) + 1;
  const newSubmissionId = crypto.randomUUID();
  
  // Submit with version and parent reference
  const result = await this.submitTransactionInternal(transactionId, {
    version: newVersion,
    parent_submission_id: transaction.submission_id
  });
  
  // Update local status
  await this.updateLocalSubmissionStatus(transactionId, {
    submission_status: 'resubmitted',
    submission_id: newSubmissionId,
    submitted_at: new Date().toISOString()
  });
  
  return result;
}
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `electron/services/submissionService.ts` | New service file |
| `electron/services/supabaseService.ts` | Add submission queries |
| `electron/handlers/submission-handlers.ts` | IPC handlers |
| `electron/preload/preload.ts` | Expose submission API |
| `src/services/submissionService.ts` | Renderer-side wrapper |

---

## Dependencies

- BACKLOG-387: Cloud schema (tables must exist)
- BACKLOG-388: RLS policies (for service key access)
- BACKLOG-390: Local schema (submission_status fields)
- BACKLOG-393: Attachment upload service (uploads first)

---

## Acceptance Criteria

- [ ] Can submit transaction with messages and attachments
- [ ] Progress callback provides accurate status
- [ ] Local submission_status updated on success
- [ ] submission_id stored locally for sync
- [ ] Resubmission creates new version
- [ ] Parent submission linked correctly
- [ ] Message counts updated in submission record
- [ ] Attachment counts updated in submission record
- [ ] Graceful handling of partial attachment failures
- [ ] Error recovery doesn't leave orphan cloud records

---

## Technical Notes

### Auth Context (Demo)

Use service key for Supabase operations:

```typescript
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
```

**Production:** Authenticate user, use their JWT.

### Transaction Isolation

If submission fails mid-way:
1. Cloud records may be partially created
2. Local status should NOT be updated to 'submitted'
3. User can retry, which should clean up partial data

Consider using Supabase transactions or manual cleanup:

```typescript
// On failure, clean up partial cloud data
if (error) {
  await this.cleanupFailedSubmission(submissionId);
  throw error;
}
```

### Message Batching

For transactions with many messages (100+), batch inserts:

```typescript
const BATCH_SIZE = 50;
for (let i = 0; i < messages.length; i += BATCH_SIZE) {
  const batch = messages.slice(i, i + BATCH_SIZE);
  await supabase.from('submission_messages').insert(batch);
  onProgress?.((i + batch.length) / messages.length * 100);
}
```

### Count Updates

After inserting messages/attachments, update the submission record:

```typescript
await supabase
  .from('transaction_submissions')
  .update({
    message_count: actualMessageCount,
    attachment_count: actualAttachmentCount
  })
  .eq('id', submissionId);
```

---

## Testing Plan

1. Submit transaction with 0 messages, 0 attachments
2. Submit transaction with 10 messages, 5 attachments
3. Submit transaction with 100+ messages
4. Test progress callback accuracy
5. Test partial attachment failure handling
6. Test resubmission creates new version
7. Test parent_submission_id linked
8. Test local status updates correctly
9. Test cleanup on failure

---

## Related Items

- BACKLOG-387: Supabase Schema (dependency)
- BACKLOG-390: Local Schema Changes (dependency)
- BACKLOG-391: Submit UI (calls this service)
- BACKLOG-392: Bulk Submit UI (calls this service)
- BACKLOG-393: Attachment Upload (dependency)
- BACKLOG-395: Status Sync (reads status back)
- SPRINT-050: B2B Broker Portal Demo
