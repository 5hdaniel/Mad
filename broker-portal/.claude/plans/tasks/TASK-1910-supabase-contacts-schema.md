# TASK-1910: Supabase Schema - external_contacts + provider_tokens Tables

**Backlog ID:** BACKLOG-625
**Sprint:** SPRINT-072
**Phase:** Phase 1 - Database Schema
**Branch:** `feature/task-1910-contacts-schema`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~8K (schema category x 1.3 = ~10K with buffer)
**SR Review Status:** Reviewed -- 4 changes incorporated (see below)

---

## Objective

Create two new Supabase tables: `external_contacts` for storing imported contacts from any source (Outlook, Gmail, manual), and `provider_tokens` for storing OAuth provider tokens needed for Graph API access. Both tables need proper RLS policies.

---

## Context

The broker portal currently has NO contacts table. The Electron desktop app has an `external_contacts` table in local SQLite, but the cloud Supabase database used by the broker portal needs its own. We need:

1. **external_contacts** - Mirrors the concept from the Electron app's SQLite `external_contacts` table but adapted for cloud/multi-tenant use. Must include a `source` column from day one.
2. **provider_tokens** - Stores Microsoft (and future Google) OAuth access/refresh tokens so server actions can call Graph API on behalf of users. Supabase does NOT store provider tokens -- apps must manage them.

### Existing Related Tables
- `users` table: Has `id` (uuid), `email`, `oauth_provider`
- `organization_members` table: Links users to organizations with roles
- `organizations` table: Has `id` (uuid), `microsoft_tenant_id`

---

## Requirements

### Must Do:

1. Create `external_contacts` table with this schema:
   ```sql
   CREATE TABLE external_contacts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

     -- Contact data
     name TEXT,
     email TEXT,
     phone TEXT,
     company TEXT,
     job_title TEXT,

     -- Source tracking
     source TEXT NOT NULL CHECK (source IN ('outlook', 'gmail', 'manual')),
     external_record_id TEXT,  -- Provider-specific unique ID (e.g., Graph contact ID)

     -- Metadata
     synced_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

     -- NOTE: Uniqueness constraint is a partial index (see indexes section below).
     -- A table-level UNIQUE would incorrectly constrain NULL external_record_id values.
   );
   ```

   > **SR Engineer Note [MEDIUM]:** Replaced table-level `UNIQUE(organization_id, source, external_record_id)`
   > with a partial unique index that excludes NULL `external_record_id`. This is correct because
   > manual contacts have `external_record_id = NULL`, and a table-level UNIQUE would prevent
   > multiple manual contacts in the same org from the same source.

2. Create `provider_tokens` table with this schema:
   ```sql
   CREATE TABLE provider_tokens (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     provider TEXT NOT NULL CHECK (provider IN ('microsoft', 'google')),

     -- Token data (ENCRYPTED at application level with PROVIDER_TOKEN_ENCRYPTION_KEY env var)
     -- SR REVIEW [CRITICAL]: Tokens must be encrypted before storage.
     -- Application code must encrypt with PROVIDER_TOKEN_ENCRYPTION_KEY before INSERT/UPDATE
     -- and decrypt after SELECT. Column names reflect encryption requirement.
     access_token_encrypted TEXT NOT NULL,
     refresh_token_encrypted TEXT,
     expires_at TIMESTAMPTZ,
     scopes TEXT,  -- Space-separated scopes granted

     -- Metadata
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

     -- One token set per user per provider
     UNIQUE(user_id, provider)
   );
   ```

   > **SR Engineer Note [CRITICAL]:** Columns renamed from `access_token`/`refresh_token` to
   > `access_token_encrypted`/`refresh_token_encrypted` to make it explicit that values
   > stored in these columns MUST be encrypted at the application level using the
   > `PROVIDER_TOKEN_ENCRYPTION_KEY` environment variable (server-side only).
   > The encryption/decryption logic is implemented in TASK-1911 (`lib/auth/provider-tokens.ts`).

3. Create indexes:
   ```sql
   -- Partial unique index: prevents duplicate imports from same source when external_record_id is set
   -- SR REVIEW [MEDIUM]: Replaces table-level UNIQUE to correctly handle NULL external_record_id
   CREATE UNIQUE INDEX idx_external_contacts_dedup
     ON external_contacts(organization_id, source, external_record_id)
     WHERE external_record_id IS NOT NULL;

   -- SR REVIEW [LOW]: Removed idx_external_contacts_org (redundant -- covered by composite index above
   -- and idx_external_contacts_source below)
   CREATE INDEX idx_external_contacts_user ON external_contacts(user_id);
   CREATE INDEX idx_external_contacts_source ON external_contacts(organization_id, source);
   CREATE INDEX idx_external_contacts_name ON external_contacts(organization_id, name);

   -- SR REVIEW [LOW]: Removed idx_provider_tokens_user (redundant -- covered by UNIQUE(user_id, provider))
   ```

4. Create RLS policies for `external_contacts`:
   ```sql
   ALTER TABLE external_contacts ENABLE ROW LEVEL SECURITY;

   -- Users can read contacts in their organization
   CREATE POLICY "Users can view org contacts"
     ON external_contacts FOR SELECT
     USING (
       organization_id IN (
         SELECT organization_id FROM organization_members
         WHERE user_id = auth.uid()
       )
     );

   -- Users can insert contacts for their organization
   CREATE POLICY "Users can insert org contacts"
     ON external_contacts FOR INSERT
     WITH CHECK (
       organization_id IN (
         SELECT organization_id FROM organization_members
         WHERE user_id = auth.uid()
       )
       AND user_id = auth.uid()
     );

   -- Users can update contacts they imported
   CREATE POLICY "Users can update own contacts"
     ON external_contacts FOR UPDATE
     USING (user_id = auth.uid());

   -- Users can delete contacts they imported
   CREATE POLICY "Users can delete own contacts"
     ON external_contacts FOR DELETE
     USING (user_id = auth.uid());
   ```

5. Create RLS policies for `provider_tokens`:
   ```sql
   ALTER TABLE provider_tokens ENABLE ROW LEVEL SECURITY;

   -- SR REVIEW [HIGH]: Split FOR ALL into separate policies with proper WITH CHECK on INSERT.
   -- A FOR ALL policy lacks WITH CHECK, which means INSERT would silently use USING as the check,
   -- but explicit policies are clearer and more secure.

   CREATE POLICY "Users can view own tokens"
     ON provider_tokens FOR SELECT
     USING (user_id = auth.uid());

   CREATE POLICY "Users can insert own tokens"
     ON provider_tokens FOR INSERT
     WITH CHECK (user_id = auth.uid());

   CREATE POLICY "Users can update own tokens"
     ON provider_tokens FOR UPDATE
     USING (user_id = auth.uid())
     WITH CHECK (user_id = auth.uid());

   CREATE POLICY "Users can delete own tokens"
     ON provider_tokens FOR DELETE
     USING (user_id = auth.uid());
   ```

### Must NOT Do:
- Do NOT create any Next.js code -- this is schema only
- Do NOT modify existing tables
- Do NOT add columns to the `users` table
- Do NOT use the service role key in migration

---

## Acceptance Criteria

- [ ] `external_contacts` table created with all columns as specified
- [ ] `provider_tokens` table created with encrypted column names (`access_token_encrypted`, `refresh_token_encrypted`)
- [ ] Both tables have RLS enabled with appropriate policies
- [ ] `provider_tokens` RLS uses separate SELECT/INSERT/UPDATE/DELETE policies (not FOR ALL)
- [ ] Partial unique index on `external_contacts` prevents duplicates only when `external_record_id IS NOT NULL`
- [ ] No redundant indexes (no `idx_external_contacts_org`, no `idx_provider_tokens_user`)
- [ ] Migration applied successfully via Supabase MCP `apply_migration` tool
- [ ] Tables visible in `list_tables` output

---

## Files to Modify

- None (this is a Supabase migration only, applied via MCP tool)

## Files to Read (for context)

- `/Users/daniel/Documents/Mad/broker-portal/app/auth/callback/route.ts` - To understand the auth callback flow
- `/Users/daniel/Documents/Mad/electron/services/db/externalContactDbService.ts` - Reference for the Electron external_contacts design

---

## Testing Expectations

### Unit Tests
- **Required:** No (schema migration only)
- **Verification:** Run `list_tables` after migration to confirm tables exist

### CI Requirements
- [ ] Migration applies without errors

---

## PR Preparation

- **Title:** `feat(db): add external_contacts and provider_tokens tables`
- **Branch:** `feature/task-1910-contacts-schema`
- **Target:** `develop`

---

## Implementation Summary

*Completed: 2026-02-06*

### Engineer Checklist

```
Pre-Work:
- [x] Read task file completely
- [x] Verified SR Engineer feedback incorporated

Implementation:
- [x] Migration applied via Supabase MCP apply_migration tool
- [x] Tables verified via list_tables -- both external_contacts and provider_tokens visible
- [x] RLS policies verified -- 4 policies on external_contacts, 4 separate policies on provider_tokens
- [x] Security advisors checked -- no new warnings for new tables
- [x] Partial unique index confirmed (idx_external_contacts_dedup)
- [x] Encrypted column names confirmed (access_token_encrypted, refresh_token_encrypted)

Completion:
- [x] Migration-only task -- no PR needed (applied directly to Supabase)
- [x] Tables ready for TASK-1911 to build on
```

### Results

- **Before**: No contacts tables in Supabase
- **After**: external_contacts and provider_tokens tables with RLS, partial unique index, encrypted column names
- **Migration Name**: `add_external_contacts_and_provider_tokens`

### Notes

**Deviations from plan:** None. All SR Engineer feedback incorporated directly.

**Issues/Blockers:** None. Migration applied cleanly on first attempt.

---

## Guardrails

**STOP and ask PM if:**
- The migration fails for any reason
- You need to modify existing tables
- RLS policy design seems insufficient for multi-tenant security
- You encounter blockers not covered in the task file
