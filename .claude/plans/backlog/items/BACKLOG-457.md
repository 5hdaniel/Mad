# BACKLOG-457: Enhance Sync Emails to Fetch from Provider

## Summary

The "Sync Emails" button in transaction detail view only auto-links existing emails from the local database. It should also fetch new emails from the connected email provider (Gmail/Outlook) for the transaction's contacts.

## Category

Feature Enhancement

## Priority

P0 - Critical (Core functionality gap - users expect Sync Emails to actually sync)

## Description

### Current Behavior

1. User clicks "Sync Emails" in transaction detail
2. System searches local `communications` table for emails matching transaction contacts
3. Links found emails to the transaction
4. **Problem**: If emails haven't been synced from Gmail/Outlook yet, they won't be found

### Desired Behavior

1. User clicks "Sync Emails" in transaction detail
2. System identifies contact emails associated with the transaction
3. **NEW**: Efficiently fetches recent emails involving those contacts from the provider
4. Stores new emails in `communications` table
5. Auto-links all matching emails to the transaction

### Efficiency Considerations

To avoid fetching the entire mailbox:
- Only fetch emails for contacts on THIS transaction
- Use provider search APIs with email address filters (e.g., `from:contact@example.com OR to:contact@example.com`)
- Limit to transaction date range (started_at to closed_at + buffer)
- Skip emails already in the database (dedup by message ID)
- Consider incremental sync (only fetch since last sync)

### Technical Approach

```
1. Get contact emails from transaction_contacts + contact_emails
2. Build provider-specific search query:
   - Gmail: `from:(email1 OR email2) OR to:(email1 OR email2) after:YYYY/MM/DD`
   - Outlook: Similar OData filter
3. Fetch matching emails (paginated, limited)
4. Dedup against existing communications.external_id
5. Store new emails
6. Run existing auto-link logic
```

## Acceptance Criteria

- [ ] Sync Emails fetches new emails from provider for transaction contacts
- [ ] Uses efficient provider search (not full mailbox scan)
- [ ] Respects transaction date range
- [ ] Deduplicates against existing emails
- [ ] Shows progress indicator during fetch
- [ ] Works with both Gmail and Outlook
- [ ] Falls back gracefully if provider unavailable

## Estimated Effort

~50K tokens (involves email provider APIs, efficient querying)

## Dependencies

- Existing Gmail/Outlook OAuth connections
- Communications table schema
- Auto-link service

## Related Items

- Auto-link service (`autoLinkService.ts`)
- Email sync handlers (`outlookHandlers.ts`, Gmail handlers)
- BACKLOG-456: Unify Loading Animation UI
