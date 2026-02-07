# TASK-1912: Microsoft Graph Contacts API Integration

**Backlog ID:** BACKLOG-627
**Sprint:** SPRINT-072
**Phase:** Phase 3 - Graph API Integration
**Branch:** `feature/task-1912-graph-contacts-api`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~20K (service category x 0.5 = ~10K, but API integration has unknowns, use ~20K)
**Depends On:** TASK-1911 (OAuth token capture must be working)
**SR Review Status:** Reviewed -- 3 changes incorporated (see below)

---

## Objective

Build a server action that calls Microsoft Graph API `/me/contacts` to fetch Outlook contacts and upsert them into the `external_contacts` Supabase table with `source = 'outlook'`.

---

## Context

### Microsoft Graph Contacts API
- Endpoint: `GET https://graph.microsoft.com/v1.0/me/contacts`
- Requires: Bearer token with `Contacts.Read` scope
- Default page size: 10 contacts (can request up to 1000 via `$top`)
- Pagination: Uses `@odata.nextLink` for next page
- Returns contact objects with: `id`, `displayName`, `emailAddresses[]`, `mobilePhone`, `homePhones[]`, `businessPhones[]`, `companyName`, `jobTitle`, etc.

### Graph API Contact Response Shape
```json
{
  "@odata.context": "...",
  "value": [
    {
      "id": "AAMkAD...",
      "displayName": "Jane Smith",
      "emailAddresses": [
        { "name": "Jane", "address": "jane@example.com" }
      ],
      "mobilePhone": "+1234567890",
      "homePhones": [],
      "businessPhones": ["+1987654321"],
      "companyName": "Acme Realty",
      "jobTitle": "Agent"
    }
  ],
  "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/contacts?$skip=10"
}
```

### Dependencies
- TASK-1910 created `external_contacts` table in Supabase
- TASK-1911 captures Microsoft provider tokens and provides `getMicrosoftToken()` utility

---

## Requirements

### Must Do:

1. **Create Graph API client utility** (`lib/microsoft/graph.ts`):
   ```typescript
   /**
    * Fetch contacts from Microsoft Graph API
    * Handles pagination automatically with safety limit
    */
   export async function fetchOutlookContacts(accessToken: string): Promise<GraphContact[]> {
     const contacts: GraphContact[] = [];
     let url: string | null = 'https://graph.microsoft.com/v1.0/me/contacts?$top=100&$select=id,displayName,emailAddresses,mobilePhone,homePhones,businessPhones,companyName,jobTitle';

     // SR REVIEW [MEDIUM]: Safety limit in pagination loop to prevent runaway fetching
     while (url && contacts.length < 5000) {
       const response = await fetch(url, {
         headers: { Authorization: `Bearer ${accessToken}` },
       });

       if (!response.ok) {
         // Handle 401 (token expired), 403 (permission denied), etc.
         throw new GraphApiError(response.status, await response.text());
       }

       const data = await response.json();
       contacts.push(...data.value);
       url = data['@odata.nextLink'] || null;
     }

     return contacts;
   }
   ```

2. **Define TypeScript types** (`lib/microsoft/types.ts`):
   ```typescript
   export interface GraphContact {
     id: string;
     displayName: string | null;
     emailAddresses: Array<{ name: string; address: string }>;
     mobilePhone: string | null;
     homePhones: string[];
     businessPhones: string[];
     companyName: string | null;
     jobTitle: string | null;
   }

   export class GraphApiError extends Error {
     constructor(public status: number, public body: string) {
       super(`Microsoft Graph API error: ${status}`);
     }
   }
   ```

3. **Create server action** (`lib/actions/syncOutlookContacts.ts`):

   > **SR Engineer Note [HIGH]:** Do NOT implement stale contact cleanup (step 7 in original).
   > Stale cleanup is unsafe if the sync is partial (e.g., hits the 5000 safety limit) or
   > if the Graph API returns an incomplete result. Stale cleanup can be added in a future
   > sprint with proper safeguards (e.g., only clean up if sync was complete).

   > **SR Engineer Note [MEDIUM]:** Use batched upserts (100 rows per batch) for users with
   > large contact lists. A single upsert of 5000 rows could timeout or hit payload limits.

   ```typescript
   'use server';

   /**
    * Sync contacts from Outlook via Microsoft Graph API.
    * Fetches all contacts and upserts into external_contacts table.
    * Uses batched upserts (100 rows per batch) for large contact lists.
    *
    * NOTE: Does NOT delete stale contacts (unsafe if sync is partial).
    *
    * Returns: { success: boolean; count: number; error?: string }
    */
   export async function syncOutlookContacts(): Promise<SyncResult> {
     // 1. Get current user + organization from session
     // 2. Get Microsoft token via getMicrosoftToken(userId)
     // 3. If no token, return error asking user to re-authenticate
     // 4. Fetch contacts from Graph API (with 5000 safety limit)
     // 5. Map Graph contacts to external_contacts rows
     // 6. Upsert into external_contacts with source='outlook' in batches of 100
     // 7. Return count of synced contacts
   }
   ```

4. **Map Graph contacts to external_contacts rows**:
   ```typescript
   function mapGraphContact(contact: GraphContact, orgId: string, userId: string) {
     return {
       organization_id: orgId,
       user_id: userId,
       name: contact.displayName,
       email: contact.emailAddresses?.[0]?.address || null,
       phone: contact.mobilePhone || contact.businessPhones?.[0] || contact.homePhones?.[0] || null,
       company: contact.companyName,
       job_title: contact.jobTitle,
       source: 'outlook' as const,
       external_record_id: contact.id,
       synced_at: new Date().toISOString(),
     };
   }
   ```

5. **Handle error cases**:
   - Token expired: Attempt refresh, if fails return `{ success: false, error: 'token_expired' }`
   - Permission denied (403): Return `{ success: false, error: 'permission_denied' }`
   - No token stored: Return `{ success: false, error: 'not_connected' }`
   - Graph API error: Return `{ success: false, error: 'graph_api_error' }`

6. **Create a server action to get contact list** (`lib/actions/contacts.ts`):
   ```typescript
   'use server';

   /**
    * Get external contacts for the current user's organization
    */
   export async function getExternalContacts(options?: {
     source?: 'outlook' | 'gmail' | 'manual';
     search?: string;
     limit?: number;
     offset?: number;
   }): Promise<{ contacts: ExternalContact[]; total: number }> {
     // Query external_contacts with filters
   }
   ```

### Must NOT Do:
- Do NOT create any UI components (TASK-1913 handles that)
- Do NOT modify the OAuth flow (TASK-1911 handles that)
- Do NOT use the Supabase service role key
- Do NOT log contact data (PII concern)
- Do NOT sync more than 5000 contacts in one request (add a safety limit)

---

## Acceptance Criteria

- [ ] `fetchOutlookContacts()` fetches all contacts with pagination and 5000-contact safety limit in loop
- [ ] `syncOutlookContacts()` server action upserts contacts into `external_contacts` in batches of 100
- [ ] No stale contact cleanup (deferred to future sprint per SR review)
- [ ] `getExternalContacts()` server action returns contacts with filtering
- [ ] TypeScript types for Graph API responses
- [ ] Token expiry handled with automatic refresh attempt
- [ ] Error cases return typed error responses (not thrown exceptions)
- [ ] No PII logged to console
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## Files to Create

- `broker-portal/lib/microsoft/graph.ts` - Graph API client (fetchOutlookContacts)
- `broker-portal/lib/microsoft/types.ts` - TypeScript types for Graph API
- `broker-portal/lib/actions/syncOutlookContacts.ts` - Server action for sync
- `broker-portal/lib/actions/contacts.ts` - Server action for reading contacts

## Files to Read (for context)

- `broker-portal/lib/auth/provider-tokens.ts` - getMicrosoftToken utility (from TASK-1911)
- `broker-portal/lib/supabase/server.ts` - Server-side Supabase client
- `broker-portal/lib/actions/users.ts` - Reference for server action patterns

---

## Testing Expectations

### Unit Tests
- **Required:** No (requires real Graph API access)
- **Manual verification:** Run sync, verify contacts appear in Supabase table

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## PR Preparation

- **Title:** `feat(contacts): add Microsoft Graph contacts API integration`
- **Branch:** `feature/task-1912-graph-contacts-api`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from main
- [ ] Noted start time: ___
- [ ] Read task file completely
- [ ] Verified TASK-1911 is merged (token capture working)

Implementation:
- [ ] Graph API client created
- [ ] TypeScript types defined
- [ ] syncOutlookContacts server action working
- [ ] getExternalContacts server action working
- [ ] Error handling for all cases
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)
- [ ] Build passes (npm run build)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No way to fetch Outlook contacts
- **After**: Server actions fetch and sync Outlook contacts into Supabase
- **Actual Tokens**: ~XK (Est: ~20K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Microsoft Graph API response format differs significantly from documented shape
- Token refresh fails consistently (may need Supabase provider config change)
- Contact count exceeds 5000 -- need to discuss pagination strategy
- You need to add npm dependencies (e.g., @microsoft/microsoft-graph-client)
- You encounter blockers not covered in the task file
