# TASK-1920: Add Contacts.Read Scope + Fetch Outlook Contacts via Graph API

**Backlog Item:** BACKLOG-629
**Sprint:** SPRINT-073
**Status:** in_progress
**Category:** feature
**Created:** 2026-02-07

## Objective

Extend the existing Microsoft Graph integration in the Electron desktop app to also fetch contacts from Outlook. Add the `Contacts.Read` scope and create a contacts fetch function using the existing auth/token infrastructure.

## Architecture Context (from research)

### Two Microsoft Auth Systems in Desktop App

The desktop app has **two** separate Microsoft auth services:

1. **`electron/services/microsoftAuthService.ts`** — Used for mailbox connection (email fetching)
   - Auth code flow with PKCE via local HTTP server on port 3000
   - `authenticateForMailbox()` requests scopes: `openid, profile, email, User.Read, Mail.Read, Mail.ReadWrite, offline_access`
   - Tokens stored in encrypted SQLite via `databaseService.saveOAuthToken()` / `getOAuthToken()`
   - Token refresh via `refreshAccessToken()` method
   - **This is the one to modify** — add `Contacts.Read` to mailbox scopes

2. **`electron/outlookService.ts`** — Legacy Outlook export (MSAL-based, device code flow)
   - Uses `@azure/msal-node` with file-based token cache
   - Only requests `User.Read, Mail.Read` scopes
   - Used for email export to audit folders
   - **Do NOT modify** — this is a separate flow

### Email Fetch Pattern to Follow

`electron/services/outlookFetchService.ts` fetches emails using:
- Gets token from `databaseService.getOAuthToken(userId, "microsoft", "mailbox")`
- Checks token expiry, calls `microsoftAuthService.refreshAccessToken()` if needed
- Uses `axios` to call Graph API with `Authorization: Bearer ${token}` header
- Pagination via `@odata.nextLink`
- Rate limiting via `withRetry()` and `apiThrottlers`

### external_contacts Table Schema

From `electron/services/db/externalContactDbService.ts`:
```
external_contacts:
  id: string (UUID)
  user_id: string
  name: string | null
  phones_json: string | null  (JSON array)
  emails_json: string | null  (JSON array)
  company: string | null
  last_message_at: string | null
  external_record_id: string  (unique per source)
  source: 'macos' | 'iphone'  (needs 'outlook' added)
  synced_at: string
```

### ContactSource Type

From `electron/types/models.ts:24`:
```ts
export type ContactSource = "manual" | "email" | "sms" | "messages" | "contacts_app" | "inferred";
```
Note: This is for the `contacts` table, not `external_contacts`. The `external_contacts` table has its own `source` field with values `'macos' | 'iphone'`.

## Requirements

### 1. Add `Contacts.Read` scope to mailbox OAuth flow

**File:** `electron/services/microsoftAuthService.ts:350-360`

Add `"Contacts.Read"` to the scopes array in `authenticateForMailbox()`:
```ts
const scopes = [
  "openid", "profile", "email", "User.Read",
  "Mail.Read", "Mail.ReadWrite",
  "Contacts.Read",  // NEW
  "offline_access",
];
```

**Important — Re-consent Risk (SR Engineer feedback):**
- `prompt: "select_account"` only shows the account picker — it does NOT force consent
- Microsoft shows incremental consent only when requesting scopes the user hasn't previously consented to
- **Existing users** with valid tokens will silently lack `Contacts.Read` until they disconnect and reconnect their mailbox — the `refreshToken()` method returns tokens with the *originally granted* scopes, not new ones
- The token record stores `scopes_granted` (line 536 of microsoftAuthService.ts) — check this before attempting contacts fetch
- When the fetch gets 403/Forbidden, show a user-friendly "reconnect required" message

### 2. Create `fetchOutlookContacts()` function

**New file:** `electron/services/outlookContactsFetchService.ts`

Follow the pattern from `outlookFetchService.ts`:
- Get token from DB → check expiry → refresh if needed
- Call `GET /me/contacts` via Graph API
- Use `$select` to only fetch needed fields: `displayName,emailAddresses,phones,companyName,jobTitle`
- Handle pagination via `@odata.nextLink` with `$top=250` (default is only 10 — users may have 1000+ contacts)
- Use `withRetry()` and `apiThrottlers.microsoft` for rate limiting
- Map Graph API response to `ExternalContact` format

### 3. Graph API Contact Fields Mapping

```
Graph API field          → external_contacts column
displayName              → name
emailAddresses[].address → emails_json (JSON array)
phones[].number          → phones_json (JSON array)
companyName              → company
id                       → external_record_id
```

## Files to Modify

- `electron/services/microsoftAuthService.ts` — Add `Contacts.Read` scope
- `electron/services/outlookContactsFetchService.ts` — **NEW** — Fetch contacts from Graph API

## Acceptance Criteria

- [ ] `Contacts.Read` scope added to `authenticateForMailbox()` scopes
- [ ] `fetchOutlookContacts()` function created following `outlookFetchService.ts` patterns
- [ ] Uses existing token management (getOAuthToken, refreshAccessToken)
- [ ] Checks `scopes_granted` before attempting fetch — returns clear error if `Contacts.Read` missing
- [ ] Handles 403/Forbidden gracefully when token lacks `Contacts.Read` scope
- [ ] Handles pagination for large contact lists (`$top=250`)
- [ ] Maps Graph API fields to external_contacts format
- [ ] Unit tests for fetch function (pagination, empty, error/403 cases)
- [ ] No TypeScript errors

## Branch Information

**Branch From:** develop
**Branch Name:** feature/task-1920-outlook-contacts-api

## Agent ID

**Engineer Agent ID:** _[To be filled by implementing agent]_

## Implementation Summary

### Changes Made

1. **`electron/services/microsoftAuthService.ts`** — Added `"Contacts.Read"` to the scopes array in `authenticateForMailbox()` (line 358). New mailbox connections will now request contact read permission.

2. **`electron/services/outlookFetchService.ts`** — Added `fetchContacts(userId)` method to the existing `OutlookFetchService` class:
   - Added `GraphContact`, `OutlookContact`, and `FetchContactsResult` interfaces
   - `fetchContacts()` checks `scopes_granted` before API call (returns reconnect-required if `Contacts.Read` is missing)
   - Handles 403/Forbidden gracefully (returns reconnect-required error, does not throw)
   - Paginates via `@odata.nextLink` with `$top=250`
   - Maps Graph API fields: `displayName` -> `name`, `emailAddresses[].address` -> `emails`, `mobilePhone/homePhones/businessPhones` -> `phones` (flattened), `companyName` -> `company`, `id` -> `external_record_id`
   - Uses existing `_graphRequest()` infrastructure (retry, rate limiting, token refresh)

3. **`electron/services/db/externalContactDbService.ts`** — Updated `ExternalContact.source` type from `'macos' | 'iphone'` to `'macos' | 'iphone' | 'outlook'`. Updated type casts in `getAllForUser()`, `search()`, and `deleteStaleContactsBySource()` signature.

4. **`electron/services/__tests__/outlookFetchService.test.ts`** — Added 8 unit tests for `fetchContacts()`: successful fetch with field mapping, pagination, empty results, missing scope check, 403 handling, non-403 error propagation, minimal fields, and uninitialized state.

### Results

- TypeScript: 0 errors
- Tests: 49/49 passing (41 existing + 8 new)
- Lint: Pre-existing error in NotificationContext.tsx (not related to changes)

### Deviations

- Task file suggested creating a new file `outlookContactsFetchService.ts`, but the user's instruction explicitly said to add to existing `outlookFetchService.ts` — followed user's instruction.
