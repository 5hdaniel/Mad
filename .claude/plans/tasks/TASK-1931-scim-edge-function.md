# Task TASK-1931: Create SCIM 2.0 Edge Function

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**
See `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow.

---

## Goal

Create a Supabase Edge Function (`scim`) that implements the SCIM 2.0 specification for user provisioning. Azure AD (Microsoft Entra ID) will call this endpoint to automatically create, update, and deactivate users in Magic Audit when they are assigned/unassigned in the Azure enterprise application.

## Non-Goals

- Do NOT implement SCIM Groups endpoint (users only in v1)
- Do NOT create the token management UI (TASK-1932)
- Do NOT modify any broker portal code
- Do NOT create new database tables (they already exist: `scim_tokens`, `scim_sync_log`)
- Do NOT implement bulk operations (SCIM POST /Bulk)
- Do NOT implement schema discovery endpoint (/Schemas, /ResourceTypes, /ServiceProviderConfig) -- these are optional in SCIM spec and Azure AD does not require them

## Deliverables

1. New Edge Function: `supabase/functions/scim/index.ts`
2. Helper modules within the function directory (if needed for clean separation)

## Acceptance Criteria

- [ ] `POST /scim/v2/Users` -- creates user + org membership, returns SCIM User resource
- [ ] `GET /scim/v2/Users` -- lists users with `filter` support (at minimum `userName eq "email"`)
- [ ] `GET /scim/v2/Users/:id` -- returns single SCIM User resource
- [ ] `PATCH /scim/v2/Users/:id` -- updates user attributes (name, active status)
- [ ] `DELETE /scim/v2/Users/:id` -- deactivates user (soft-delete: set `suspended_at`, do NOT hard delete)
- [ ] Authentication via `Authorization: Bearer <token>` header, validated against `scim_tokens.token_hash` (SHA-256)
- [ ] Invalid/revoked/expired token returns `401 Unauthorized`
- [ ] All operations logged in `scim_sync_log` table
- [ ] SCIM responses follow RFC 7644 format (schemas, id, meta, etc.)
- [ ] Edge Function deploys successfully
- [ ] Function uses `verify_jwt: false` (SCIM uses bearer tokens, not Supabase JWT)

## Implementation Notes

### Edge Function Structure

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// SCIM 2.0 User Provisioning Endpoint
// Auth: Bearer token validated against scim_tokens table
// Routes:
//   POST   /scim/v2/Users       - Create user
//   GET    /scim/v2/Users       - List/filter users
//   GET    /scim/v2/Users/:id   - Get user
//   PATCH  /scim/v2/Users/:id   - Update user
//   DELETE /scim/v2/Users/:id   - Deactivate user

Deno.serve(async (req: Request) => {
  // ... routing and auth logic
});
```

### Authentication Flow

```typescript
async function authenticateScimRequest(
  req: Request,
  supabaseAdmin: SupabaseClient
): Promise<{ orgId: string; tokenId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return scimError(401, 'Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7);
  // Hash the token with SHA-256 and compare against scim_tokens.token_hash
  const tokenHash = await sha256(token);

  const { data: tokenRecord } = await supabaseAdmin
    .from('scim_tokens')
    .select('id, organization_id, can_create_users, can_update_users, can_delete_users, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .single();

  if (!tokenRecord) {
    return scimError(401, 'Invalid or revoked token');
  }

  if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
    return scimError(401, 'Token expired');
  }

  // Update last_used_at and request_count using atomic SQL increment
  // IMPORTANT (SR Review): Use raw SQL for atomic increment to avoid race conditions.
  // The Supabase JS client's .update() would read-then-write which is not atomic.
  await supabaseAdmin.rpc('exec_sql', {
    query: `UPDATE scim_tokens SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = '${tokenRecord.id}'`
  });
  // Alternative: Use supabaseAdmin.from('scim_tokens').update() with a raw SQL fragment
  // if the above RPC doesn't exist. The key requirement is atomic increment:

  return { orgId: tokenRecord.organization_id, tokenId: tokenRecord.id };
}
```

### SCIM User Resource Format (RFC 7644)

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "<user-uuid>",
  "externalId": "<azure-ad-object-id>",
  "userName": "user@example.com",
  "name": {
    "givenName": "Jane",
    "familyName": "Doe"
  },
  "emails": [
    {
      "value": "user@example.com",
      "type": "work",
      "primary": true
    }
  ],
  "active": true,
  "meta": {
    "resourceType": "User",
    "created": "2026-01-01T00:00:00.000Z",
    "lastModified": "2026-01-01T00:00:00.000Z",
    "location": "https://<project>.supabase.co/functions/v1/scim/v2/Users/<id>"
  }
}
```

### Key Operations

**POST /Users (Create):**
1. Extract `externalId`, `userName` (email), `name` from SCIM request
2. Check if user already exists by `scim_external_id` or email
3. Create `users` record with `provisioning_source='scim'`, `is_managed=true`
4. Create `organization_members` record with org's `default_member_role`
5. Log to `scim_sync_log`
6. Return 201 with SCIM User resource

**GET /Users (List/Filter):**
1. Parse `filter` parameter (Azure AD sends `userName eq "email@example.com"`)
2. Query users in the org, optionally filtered
3. Return SCIM ListResponse with `totalResults`, `Resources`

**GET /Users/:id:**
1. Look up user by UUID
2. Verify user belongs to this org
3. Return SCIM User resource

**PATCH /Users/:id (Update):**
1. Parse SCIM PatchOp (Azure AD sends `Operations` array)
2. Handle `replace` operations for `active`, `name.givenName`, `name.familyName`
3. If `active=false`, set `suspended_at=NOW()`, `suspension_reason='scim_deprovisioned'`
4. If `active=true`, clear `suspended_at`
5. Log to `scim_sync_log`
6. Return updated SCIM User resource

**DELETE /Users/:id (Deactivate):**
1. Set `suspended_at=NOW()`, `suspension_reason='scim_deleted'`
2. Update `organization_members.license_status='suspended'`
3. Log to `scim_sync_log`
4. Return 204 No Content

### SHA-256 Helper

```typescript
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### SCIM Error Response Format

```typescript
function scimError(status: number, detail: string, scimType?: string): Response {
  return new Response(JSON.stringify({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail,
    scimType: scimType || 'invalidValue',
    status,
  }), {
    status,
    headers: { 'Content-Type': 'application/scim+json' },
  });
}
```

### Atomic Request Count Increment (SR Review Finding)

**IMPORTANT:** The `request_count` update MUST use atomic SQL increment to avoid race conditions under concurrent SCIM requests. Do NOT read the current count and add 1 in application code.

**Preferred approach:** Use the Supabase admin client to execute raw SQL:

```typescript
// Atomic increment -- no race condition
const { error } = await supabaseAdmin.rpc('execute_sql', {
  sql: `UPDATE scim_tokens SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = $1`,
  params: [tokenRecord.id]
});
```

If no `execute_sql` RPC exists, use the Supabase REST API with a raw PostgreSQL query, or create a small helper RPC (`increment_scim_token_usage`) that does the atomic update.

The key SQL is:
```sql
UPDATE scim_tokens SET last_used_at = NOW(), request_count = request_count + 1 WHERE id = token_id;
```

### Supabase Client Configuration

The Edge Function needs a service role client (not anon) to bypass RLS:

```typescript
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### Important Details

- **Content-Type**: SCIM spec requires `application/scim+json`, but also accept `application/json`
- **Case sensitivity**: SCIM attribute names are case-sensitive per spec
- **Filter parsing**: Azure AD primarily uses `userName eq "email"` -- support at minimum this format
- **Pagination**: Azure AD sends `startIndex` and `count` -- implement basic pagination
- **ETag**: Not required for Azure AD integration, skip for v1
- Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables (available in Edge Functions by default)

## Integration Notes

- **No dependencies** on other sprint tasks (SCIM tables already exist from SPRINT-070)
- **Used by:** TASK-1932 (SCIM Token Management UI needs to know the endpoint URL format)
- **Database tables used:** `scim_tokens`, `scim_sync_log`, `users`, `organization_members`, `organizations`

## Do / Don't

### Do:
- Use `SECURITY DEFINER` equivalent (service role key) to bypass RLS
- Follow RFC 7644 response format strictly
- Log all operations to `scim_sync_log`
- Handle Azure AD's specific SCIM dialect (they send PatchOp with `Operations` array)
- Use `crypto.subtle.digest` for SHA-256 (available in Deno)
- Set `verify_jwt: false` when deploying (SCIM uses bearer tokens, not JWT)

### Don't:
- Do NOT hard-delete users on DELETE -- always soft-delete (suspend)
- Do NOT store bearer tokens in plaintext -- always hash
- Do NOT expose internal error details in SCIM responses
- Do NOT implement Groups endpoint (defer to future sprint)
- Do NOT require Supabase JWT auth (SCIM uses its own bearer token)

## When to Stop and Ask

- If `scim_tokens` or `scim_sync_log` tables do not exist
- If Edge Function deployment fails
- If you are unsure about Azure AD's SCIM request format
- If you need to create new database tables or columns

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (Edge Function testing is done via HTTP)
- Future: Add Deno test file for SCIM parsing logic

### Integration / Feature Tests
- Required scenarios (manual via curl or Postman):
  1. POST /Users with valid token -> 201, user created
  2. GET /Users?filter=userName eq "test@example.com" -> matching user
  3. PATCH /Users/:id with active=false -> user suspended
  4. DELETE /Users/:id -> 204, user suspended
  5. Any request with invalid token -> 401
  6. Any request with revoked token -> 401
  7. POST /Users with duplicate externalId -> 409 Conflict

### CI Requirements
- [ ] Edge Function deploys successfully
- [ ] No TypeScript errors in function code

## PR Preparation

- **Title**: `feat(edge-function): add SCIM 2.0 user provisioning endpoint`
- **Labels**: `feature`, `edge-function`, `auth`
- **Depends on**: None (SCIM tables already exist)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~45K-60K

**Token Cap:** 240K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1-3 files (main + helpers) | +20K |
| Code volume | ~400-500 lines | +20K |
| Complexity | Medium-High (SCIM spec compliance) | +15K |
| Test complexity | Medium (curl testing) | +5K |

**Confidence:** Medium

**Risk factors:**
- Azure AD SCIM dialect quirks
- Edge Function deployment issues
- SCIM filter parsing complexity

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist
```
Files created:
- [ ] supabase/functions/scim/index.ts
- [ ] Any helper modules

Features implemented:
- [ ] POST /Users (create)
- [ ] GET /Users (list/filter)
- [ ] GET /Users/:id (get)
- [ ] PATCH /Users/:id (update)
- [ ] DELETE /Users/:id (deactivate)
- [ ] Bearer token auth
- [ ] scim_sync_log logging
- [ ] SCIM error responses

Verification:
- [ ] Edge Function deploys
- [ ] Manual testing with curl
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information
**PR Number:** #XXX
**Merged To:** project/org-setup-bulletproof

- [ ] PR merge verified
