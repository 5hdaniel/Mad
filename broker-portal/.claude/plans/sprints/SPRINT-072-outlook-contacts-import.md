# SPRINT-072: Outlook Contacts Import to Broker Portal

## Sprint Overview

| Field | Value |
|-------|-------|
| **Sprint ID** | SPRINT-072 |
| **Branch** | Per-task feature branches from `develop` |
| **Base** | `develop` |
| **Status** | In Progress |
| **Created** | 2026-02-06 |
| **SR Review** | Completed 2026-02-06 -- feedback incorporated into all 4 task files |

## Sprint Goals

Import Outlook contacts into the broker portal via Microsoft Graph API, storing them in a new Supabase `external_contacts` table with a `source` column to track origin (outlook, gmail, manual). This enables brokers to manage contacts from multiple sources in one place.

## Background / Research Findings

### Existing Infrastructure
- The broker portal already uses Microsoft Azure OAuth for login (provider: `azure`)
- Current OAuth scopes: `email profile openid` -- does NOT include `Contacts.Read`
- Supabase passes through `provider_token` after OAuth, but does NOT store it server-side
- The Electron desktop app has an `external_contacts` table in local SQLite with `source` column (`macos`, `iphone`) -- this is a different system
- The Supabase cloud database has NO contacts table at all

### Architecture Decision: Provider Token Flow
- Supabase returns a `provider_token` (Microsoft access token) after OAuth login
- We need to add `Contacts.Read offline_access` to the OAuth scopes to get Graph API access
- The provider token must be captured from the OAuth callback and stored in the database
- We will create a `provider_tokens` table in Supabase to persist the Microsoft access/refresh tokens
- Server actions will use the stored provider token to call Microsoft Graph API

### Related Backlog Items
- BACKLOG-016: Refactor Contact Import (Pending, Electron-focused)
- BACKLOG-018: Smart Contact Sync (Pending, Electron-focused)
- BACKLOG-492: Test Outlook/Microsoft Email Sync (Deferred, testing)
- BACKLOG-569: External Contacts Shadow Table (Completed, Electron SQLite)
- NEW: BACKLOG-625-628 created for this sprint (broker portal specific)

## Task Summary

| Task ID | Title | Priority | Phase | Status | Estimated Tokens |
|---------|-------|----------|-------|--------|------------------|
| TASK-1910 | Supabase schema: external_contacts + provider_tokens tables | P0 | 1 | COMPLETE (PR #758) | ~8K |
| TASK-1911 | OAuth scope upgrade + provider token capture | P0 | 2 | In Progress | ~15K |
| TASK-1912 | Microsoft Graph contacts API integration | P1 | 3 | Pending | ~20K |
| TASK-1913 | Contacts dashboard page + import UI | P1 | 4 | Pending | ~25K |

## Phase 1: Database Schema (Sequential prerequisite)

### TASK-1910: Supabase schema: external_contacts + provider_tokens tables

**Priority:** P0 - Critical (everything depends on this)
**Backlog:** BACKLOG-625

Create two new tables in Supabase:

1. **external_contacts** - Stores imported contacts from any source
2. **provider_tokens** - Stores Microsoft (and future Google) OAuth tokens for Graph API access

**Acceptance Criteria:**
- [ ] `external_contacts` table created with proper RLS policies
- [ ] `provider_tokens` table created with encrypted token storage
- [ ] RLS policies restrict access to own organization's contacts
- [ ] Indexes on frequently queried columns
- [ ] Migration applied successfully

## Phase 2: OAuth + Token Capture (Depends on Phase 1)

### TASK-1911: OAuth scope upgrade + provider token capture

**Priority:** P0 - Critical
**Backlog:** BACKLOG-626

Upgrade the Azure OAuth flow to request `Contacts.Read` and `offline_access` scopes, then capture and store the provider tokens in Supabase.

**Acceptance Criteria:**
- [ ] Login page requests `Contacts.Read offline_access` scopes for Azure
- [ ] Auth callback captures `provider_token` and `provider_refresh_token`
- [ ] Tokens stored in `provider_tokens` table
- [ ] Token refresh logic implemented
- [ ] Existing auth flow not broken (Google login still works)
- [ ] CSP `connect-src` updated for `graph.microsoft.com`

## Phase 3: Graph API Integration (Depends on Phase 2)

### TASK-1912: Microsoft Graph contacts API integration

**Priority:** P1 - High
**Backlog:** BACKLOG-627

Build the server-side integration with Microsoft Graph `/me/contacts` endpoint to fetch and sync Outlook contacts into `external_contacts`.

**Acceptance Criteria:**
- [ ] Server action `syncOutlookContacts` fetches contacts from Graph API
- [ ] Contacts upserted into `external_contacts` with `source = 'outlook'`
- [ ] Handles pagination (Graph API returns 10 contacts per page by default)
- [ ] Handles token expiry with automatic refresh
- [ ] Deduplication by `external_record_id` (Graph contact ID)
- [ ] Error handling for revoked permissions, expired tokens
- [ ] Proper typing for Graph API responses

## Phase 4: UI (Depends on Phase 3)

### TASK-1913: Contacts dashboard page + import UI

**Priority:** P1 - High
**Backlog:** BACKLOG-628

Create a Contacts page in the broker portal dashboard with contact listing, import trigger, and source filtering.

**Acceptance Criteria:**
- [ ] New nav item "Contacts" in dashboard layout (visible to admin/broker/it_admin)
- [ ] `/dashboard/contacts` page shows imported contacts in a table
- [ ] "Import from Outlook" button triggers sync
- [ ] Progress indicator during sync
- [ ] Source filter (All / Outlook / Manual)
- [ ] Search contacts by name/email/phone
- [ ] Contact count display
- [ ] Empty state when no contacts imported
- [ ] Error state when Microsoft permission not granted

## Dependency Graph

```
TASK-1910 (DB Schema)
    |
    v
TASK-1911 (OAuth + Tokens)
    |
    v
TASK-1912 (Graph API)
    |
    v
TASK-1913 (UI)
```

**Execution Order:** Strictly Sequential -- each task depends on the previous one.

## CSP Changes Required

The `next.config.mjs` Content-Security-Policy must be updated to allow Microsoft Graph API calls:

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clarity.ms https://graph.microsoft.com
```

This should be done in TASK-1911 alongside the OAuth changes.

## Azure AD App Registration Changes (Manual)

Before implementation begins, the Azure AD app registration in the Azure portal needs:

1. **API Permissions:** Add `Microsoft Graph > Contacts.Read` (delegated permission)
2. **Token Configuration:** Ensure access tokens include the Contacts.Read scope

This is a manual step the user must complete in the Azure portal.

## SR Engineer Technical Review

**Status:** COMPLETED (2026-02-06)

### Changes Incorporated

**TASK-1910 (4 items):**
1. [CRITICAL] Token encryption -- columns renamed to `access_token_encrypted`/`refresh_token_encrypted`, app-level encryption with `PROVIDER_TOKEN_ENCRYPTION_KEY`
2. [HIGH] Split `provider_tokens` RLS `FOR ALL` into separate SELECT/INSERT/UPDATE/DELETE policies
3. [MEDIUM] Replace table-level UNIQUE with partial unique index excluding NULL `external_record_id`
4. [LOW] Removed redundant indexes (`idx_external_contacts_org`, `idx_provider_tokens_user`)

**TASK-1911 (5 items):**
1. [CRITICAL] Added `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` env vars
2. [HIGH] Token capture must happen BEFORE membership/invite/auto-provision logic
3. [MEDIUM] Documented `expires_at` is approximate (~1 hour)
4. [MEDIUM] Noted CSP changes are forward-looking (all API calls are server-side)
5. [HIGH] Token encryption -- encrypt on write, decrypt on read in `provider-tokens.ts`

**TASK-1912 (3 items):**
1. [HIGH] Removed stale contact cleanup from initial implementation
2. [MEDIUM] Added explicit upsert batching (100 rows per batch)
3. [MEDIUM] Added safety limit in pagination loop: `while (url && contacts.length < 5000)`

**TASK-1913 (2 items):**
1. [MEDIUM] Changed from client-side filtering to server-action-driven search/filter
2. [LOW] Contacts nav link visible to all authenticated roles (PM decision)

---

## Completion Checklist

- [ ] All tasks completed and merged
- [ ] Azure AD app has Contacts.Read permission added (manual step)
- [ ] OAuth flow captures and stores Microsoft tokens
- [ ] Contacts import from Outlook works end-to-end
- [ ] Contacts page accessible from dashboard nav
- [ ] Application tested in development
- [ ] Branch ready for user functional testing
