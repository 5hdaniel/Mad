# Task TASK-1932: Create SCIM Token Management UI

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**
See `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow.

---

## Goal

Create a SCIM Token Management page in the broker portal settings where IT admins can generate SCIM bearer tokens, view the SCIM endpoint URL, see sync logs, and revoke tokens. This enables IT admins to configure Azure AD SCIM provisioning for their organization.

## Non-Goals

- Do NOT implement the SCIM Edge Function (TASK-1931)
- Do NOT create new database tables (they already exist)
- Do NOT implement SCIM group management
- Do NOT add SCIM token rotation/auto-renewal
- Do NOT implement sync monitoring/alerting

## Deliverables

1. New page: `broker-portal/app/dashboard/settings/scim/page.tsx` -- SCIM settings page
2. New component: `broker-portal/components/settings/ScimTokenManager.tsx` -- token management
3. New component: `broker-portal/components/settings/ScimSyncLog.tsx` -- sync log viewer
4. New server actions: `broker-portal/lib/actions/scim.ts` -- server actions for token CRUD

## Acceptance Criteria

- [ ] IT admin can access `/dashboard/settings/scim` page
- [ ] Page shows SCIM endpoint URL: `https://<project-ref>.supabase.co/functions/v1/scim/v2/Users`
- [ ] "Generate Token" button creates a new SCIM token
- [ ] Token plaintext is shown ONCE immediately after generation (with copy button)
- [ ] Token is stored as SHA-256 hash in `scim_tokens` table
- [ ] Token list shows: description, created date, last used, request count, status
- [ ] IT admin can revoke tokens (sets `revoked_at`)
- [ ] Sync log section shows recent entries from `scim_sync_log` (operation, status, timestamp)
- [ ] Page is only accessible to `it_admin` role
- [ ] Non-IT-admin users see "access denied" or are redirected
- [ ] TypeScript compiles clean
- [ ] All CI checks pass

## Implementation Notes

### Page Structure

```
/dashboard/settings/scim
├── Header: "SCIM Provisioning"
├── Endpoint URL section (copyable)
├── Token Management section
│   ├── Generate Token button + description input
│   ├── One-time token display (after generation)
│   └── Token list (active/revoked)
└── Sync Log section
    └── Recent sync entries (last 50)
```

### Server Actions (`broker-portal/lib/actions/scim.ts`)

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';

export async function generateScimToken(description: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify IT admin role
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .eq('role', 'it_admin')
    .single();

  if (!membership) throw new Error('Not authorized');

  // Generate random token
  const plainToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(plainToken).digest('hex');

  // Store hashed token
  const { error } = await supabase
    .from('scim_tokens')
    .insert({
      organization_id: membership.organization_id,
      token_hash: tokenHash,
      description: description || 'SCIM Token',
      created_by: user.id,
    });

  if (error) throw new Error('Failed to create token');

  // Return plaintext token (shown once)
  return { token: plainToken };
}

export async function revokeScimToken(tokenId: string) {
  const supabase = await createClient();
  // ... verify IT admin, then update revoked_at
}

export async function listScimTokens() {
  const supabase = await createClient();
  // ... return tokens for user's org (exclude token_hash from response)
}

export async function listScimSyncLogs(limit = 50) {
  const supabase = await createClient();
  // ... return recent sync log entries
}
```

### Token Display Component

After generating a token, show it in a highlighted box with:
- Warning: "This token will only be shown once. Copy it now."
- Copy to clipboard button
- The token value in a monospace font
- Dismiss button

### Key Patterns

- Follow existing settings page patterns in the broker portal
- Use server actions (Next.js 14+ pattern) for data mutations
- Use `crypto` module (Node.js built-in) for token generation and hashing
- Return token metadata (id, description, created_at, last_used_at, request_count) but NEVER the hash

### SCIM Endpoint URL

The endpoint URL depends on the Supabase project:
```
https://<NEXT_PUBLIC_SUPABASE_URL>/functions/v1/scim/v2/Users
```

Or construct from `process.env.NEXT_PUBLIC_SUPABASE_URL`:
```typescript
const scimEndpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scim/v2/Users`;
```

## Integration Notes

- **Depends on:** TASK-1931 (SCIM Edge Function, for endpoint URL format)
- **Database tables used:** `scim_tokens`, `scim_sync_log` (both exist from SPRINT-070)
- **No shared files** with other tasks in this sprint
- **Role check:** Only `it_admin` can access this page

## Do / Don't

### Do:
- Show the plaintext token ONCE and never again
- Store ONLY the SHA-256 hash
- Verify `it_admin` role in every server action
- Show the endpoint URL prominently with copy button
- Include sync log for debugging visibility

### Don't:
- Do NOT return `token_hash` in any API response
- Do NOT allow non-IT-admin access
- Do NOT implement token auto-rotation (future)
- Do NOT show full request payloads in sync log (could contain PII)

## When to Stop and Ask

- If `scim_tokens` table structure differs from what is expected
- If there is no existing settings page structure to follow
- If `crypto` module is not available in the Next.js server action context

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (UI page with server actions)
- Future: Server action tests with mock Supabase

### Integration / Feature Tests
- Required scenarios (manual):
  1. IT admin visits SCIM settings -> sees endpoint URL
  2. Generate token -> plaintext shown once, copy works
  3. Refresh page -> token listed but no plaintext
  4. Revoke token -> marked as revoked in list
  5. Non-IT-admin user -> access denied
  6. Sync log shows entries after SCIM operations

### CI Requirements
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Build passes

## PR Preparation

- **Title**: `feat(broker-portal): add SCIM token management UI for IT admins`
- **Labels**: `feature`, `ui`, `auth`
- **Depends on**: TASK-1931

---

## PM Estimate (PM-Owned)

**Category:** `ui + service`

**Estimated Tokens:** ~30K-40K

**Token Cap:** 160K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new files | +20K |
| Code volume | ~300 lines | +10K |
| Complexity | Medium (token generation, role checks) | +5K |
| Test complexity | Low (manual testing) | +5K |

**Confidence:** Medium

**Risk factors:**
- Settings page structure may not exist yet
- `crypto` module availability in server actions
- RLS policies on scim_tokens may need updates

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
- [ ] broker-portal/app/dashboard/settings/scim/page.tsx
- [ ] broker-portal/components/settings/ScimTokenManager.tsx
- [ ] broker-portal/components/settings/ScimSyncLog.tsx
- [ ] broker-portal/lib/actions/scim.ts

Features implemented:
- [ ] SCIM endpoint URL display with copy
- [ ] Token generation (plaintext shown once)
- [ ] Token list with metadata
- [ ] Token revocation
- [ ] Sync log viewer
- [ ] IT admin role check

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm run build passes
```

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information
**PR Number:** #XXX
**Merged To:** project/org-setup-bulletproof

- [ ] PR merge verified
