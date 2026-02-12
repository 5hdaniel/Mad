# BACKLOG-635: Auto-Link Search Cloud Email Providers

## Priority: High
## Category: Feature
## Status: Pending

## Summary

Extend `autoLinkService.ts` to search Outlook and Gmail APIs when a contact is added to a transaction, not just the local `emails` table. Currently auto-link only finds emails that were previously fetched and saved during an earlier transaction linking.

## Problem

When a contact is added to a transaction, auto-link searches the local `emails` SQLite table. But emails only get into that table when they've been previously linked to some transaction. New contacts with no prior transaction history will show zero email matches even if the user has hundreds of emails with that contact in Outlook/Gmail.

## Implementation Plan

1. **Search locally first** (existing behavior in `findEmailsByContactEmails()`)
2. **If authenticated with Outlook/Gmail**, search cloud APIs using contact email addresses
   - `OutlookFetchService.searchEmails()` (line 344) already supports query-based search
   - `GmailFetchService` has similar search capability
3. **Save new matches** to local `emails` table via `createEmail()` in `emailDbService.ts`
4. **Create communication links** to the transaction
5. **Return combined counts** (local + cloud matches)

## Key Files

- `electron/services/autoLinkService.ts` — main auto-link logic
- `electron/services/outlookFetchService.ts` — Outlook Graph API search
- `electron/services/gmailFetchService.ts` — Gmail API search
- `electron/services/db/emailDbService.ts` — local email storage
- `electron/services/transactionService.ts` — existing email save pattern (line 686)

## Acceptance Criteria

- [ ] Auto-link searches Outlook API when user is authenticated with Microsoft
- [ ] Auto-link searches Gmail API when user is authenticated with Google
- [ ] New emails from cloud are saved to local `emails` table (deduplicated by external_id)
- [ ] Communication links are created for cloud-fetched emails
- [ ] Graceful fallback to local-only if cloud auth is unavailable
- [ ] Progress/count reported back to UI
