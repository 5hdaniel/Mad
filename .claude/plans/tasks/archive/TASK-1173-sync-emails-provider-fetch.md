# TASK-1173: Sync Emails Must Fetch from Provider

**Sprint**: SPRINT-052
**Backlog Item**: BACKLOG-457
**Status**: Pending
**Estimated Tokens**: ~50K

---

## Summary

Enhance the "Sync Emails" button to fetch new emails from Gmail/Outlook for transaction contacts, not just link existing emails from the local database. This is the core email sync functionality that users expect.

---

## Branch Information

**Branch From**: develop (after TASK-1172 merged)
**Branch Into**: develop
**Branch Name**: feature/task-1173-sync-emails-provider

---

## Problem Statement

### Current Behavior
1. User clicks "Sync Emails" in transaction detail
2. System searches local `communications` table for emails matching transaction contacts
3. Links found emails to the transaction
4. **Problem**: If emails haven't been synced from Gmail/Outlook yet, they won't be found

### Desired Behavior
1. User clicks "Sync Emails" in transaction detail
2. System identifies contact emails associated with the transaction
3. **NEW**: Fetches recent emails involving those contacts from the provider
4. Stores new emails in `communications` table
5. Auto-links all matching emails to the transaction

---

## Requirements

### Functional Requirements

1. **Fetch emails from provider for transaction contacts**
   - Build search query with contact emails
   - Respect transaction date range (started_at to closed_at + buffer)
   - Handle both Gmail and Outlook

2. **Efficient provider search**
   - Only fetch emails for THIS transaction's contacts
   - Use provider search APIs with email address filters
   - Paginated fetching with reasonable limits

3. **Deduplication**
   - Skip emails already in the database (by external_id/message_id)
   - Avoid re-fetching same emails on repeated sync

4. **Progress indication**
   - Show progress while fetching
   - Allow cancellation if fetch takes too long

5. **Graceful fallback**
   - If OAuth is expired, trigger re-auth (uses TASK-1172)
   - If provider unavailable, fall back to local linking only

### Non-Functional Requirements

- Fetch should complete within 30 seconds for typical contact list
- Respect provider rate limits
- Handle large mailboxes without timeout

---

## Technical Approach

### 1. Provider Search Query Building

```typescript
// For Gmail
const gmailQuery = buildGmailSearchQuery(contactEmails, dateRange);
// Result: "from:(alice@example.com OR bob@example.com) OR to:(alice@example.com OR bob@example.com) after:2024/01/01 before:2024/12/31"

// For Outlook
const outlookFilter = buildOutlookFilter(contactEmails, dateRange);
// Result: OData filter for receivedDateTime and from/to addresses
```

### 2. Fetch Flow

```typescript
async function syncEmailsFromProvider(transactionId: string): Promise<SyncResult> {
  // 1. Validate OAuth (uses TASK-1172 token validation)
  const connectionStatus = await validateEmailConnection(userId);
  if (connectionStatus.needsReauth) {
    return { success: false, needsReauth: true };
  }

  // 2. Get transaction contacts
  const contacts = await getTransactionContacts(transactionId);
  const contactEmails = contacts.flatMap(c => c.emails);

  // 3. Get transaction date range
  const dateRange = await getTransactionDateRange(transactionId);

  // 4. Build provider-specific query
  const query = buildSearchQuery(provider, contactEmails, dateRange);

  // 5. Fetch emails (paginated)
  const emails = await fetchEmailsFromProvider(provider, query, { limit: 100 });

  // 6. Deduplicate against existing communications
  const newEmails = filterNewEmails(emails, existingIds);

  // 7. Store new emails
  await storeEmails(newEmails, userId);

  // 8. Auto-link to transaction (existing logic)
  await autoLinkCommunicationsForTransaction(transactionId);

  return { success: true, fetched: emails.length, linked: newEmails.length };
}
```

### 3. Gmail Search API

```typescript
// Use Gmail Users.messages.list with q parameter
async function fetchGmailEmails(query: string, options: FetchOptions): Promise<Email[]> {
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: options.limit,
  });

  // Fetch full message details for each result
  const emails = await Promise.all(
    response.messages.map(m => gmail.users.messages.get({ userId: 'me', id: m.id }))
  );

  return emails.map(parseGmailMessage);
}
```

### 4. Outlook Search API

```typescript
// Use Microsoft Graph messages endpoint with $filter
async function fetchOutlookEmails(filter: string, options: FetchOptions): Promise<Email[]> {
  const response = await graphClient
    .api('/me/messages')
    .filter(filter)
    .top(options.limit)
    .orderby('receivedDateTime desc')
    .get();

  return response.value.map(parseOutlookMessage);
}
```

### 5. IPC Handler

```typescript
// Add to transaction-handlers.ts
ipcMain.handle('transactions:syncEmailsFromProvider', async (event, transactionId) => {
  return await syncEmailsFromProvider(transactionId);
});
```

### 6. UI Integration

```tsx
// In TransactionDetail.tsx or similar
const handleSyncEmails = async () => {
  setIsSyncing(true);
  try {
    const result = await window.api.transactions.syncEmailsFromProvider(transactionId);
    if (result.needsReauth) {
      setShowReauthPrompt(true);
    } else if (result.success) {
      toast.success(`Synced ${result.linked} new emails`);
      refreshCommunications();
    }
  } catch (error) {
    toast.error('Failed to sync emails');
  } finally {
    setIsSyncing(false);
  }
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/autoLinkService.ts` | Add provider fetch logic |
| `electron/transaction-handlers.ts` | Add syncEmailsFromProvider IPC handler |
| `electron/services/googleAuthService.ts` | Add Gmail search method |
| `electron/services/outlookHandlers.ts` | Add Outlook search method |
| `electron/types/ipc.ts` | Add new IPC method type |
| `electron/preload/transactionBridge.ts` | Expose new method |
| `src/components/TransactionDetail.tsx` | Update Sync button handler |
| `src/window.d.ts` | Add type definition |

---

## Acceptance Criteria

- [ ] Sync Emails fetches new emails from provider for transaction contacts
- [ ] Uses efficient provider search (not full mailbox scan)
- [ ] Respects transaction date range (started_at to closed_at + 30 days)
- [ ] Deduplicates against existing emails (by external_id)
- [ ] Shows progress indicator during fetch
- [ ] Works with both Gmail and Outlook
- [ ] Falls back gracefully if provider unavailable
- [ ] Prompts re-auth if OAuth expired (integrates with TASK-1172)
- [ ] Unit tests for query building and deduplication
- [ ] Manual testing with real Gmail/Outlook accounts

---

## Testing Requirements

### Unit Tests
- Gmail query building (email addresses, date range)
- Outlook filter building
- Deduplication logic
- Error handling (OAuth expired, network error)

### Integration Tests
- Full sync flow with mocked provider responses

### Manual Testing
1. Add contact to transaction
2. Send test email to/from that contact
3. Click "Sync Emails" -> verify email appears
4. Click "Sync Emails" again -> verify no duplicate
5. Test with expired OAuth -> verify re-auth prompt
6. Test with both Gmail and Outlook connected

---

## Dependencies

- TASK-1172: Fix Email Connection Status (token validation, refresh)

---

## Blocked By

- TASK-1172

---

## Blocks

- None (end of critical path)

---

## Edge Cases to Handle

1. **Contact with many email addresses**: Limit query length for Gmail (max 500 chars)
2. **Transaction with many contacts**: Batch requests or limit contacts
3. **Very long transactions**: Paginate by date if needed
4. **Rate limiting**: Respect Gmail/Outlook rate limits, implement backoff
5. **Large attachments**: Store reference, don't download full content
6. **Duplicate contacts**: Deduplicate email addresses before query

---

## Implementation Summary

*To be filled by engineer after implementation*

### Changes Made
-

### Tests Added
-

### Manual Testing Done
-

### PR
-
