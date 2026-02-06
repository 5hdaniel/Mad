# TASK-1820: Domain Claim & User Capture

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1820 |
| **Backlog Item** | BACKLOG-621 |
| **Priority** | P1 - High |
| **Status** | Pending |
| **Estimated Tokens** | ~80K |
| **Depends On** | None (builds on SPRINT-070 SSO columns) |

## Summary

Implement the full domain claim and user capture flow for IT admins. When an IT admin verifies ownership of their email domain (via DNS TXT record), the system discovers all existing Magic Audit users with matching email domains and initiates a 14-day capture period. During capture, matching users are prompted to join the organization on their next login. The IT admin sees a real-time capture report dashboard. After the capture period ends, captured users are migrated to SSO authentication.

This task covers 4 phases within a single implementation:
1. Domain Verification (DNS TXT record + Settings UI)
2. 14-Day Capture Period (discovery + accept/decline flow)
3. IT Admin Capture Report (dashboard page)
4. Post-Capture & SSO Migration (period expiry + SSO switchover)

---

## Phase 1: Domain Verification

### Requirements

The IT admin needs a Settings page to claim their organization's email domain by adding a DNS TXT record that the system can verify.

### Database Migration: `domain_claims` Table

Create a new `domain_claims` table and add columns to `organizations`:

```sql
-- New table: domain_claims
CREATE TABLE public.domain_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verification_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  last_checked_at TIMESTAMPTZ,
  check_count INTEGER NOT NULL DEFAULT 0,
  capture_started_at TIMESTAMPTZ,
  capture_ends_at TIMESTAMPTZ,
  capture_extended BOOLEAN NOT NULL DEFAULT false,
  capture_extended_at TIMESTAMPTZ,
  capture_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, domain)
);

-- Add columns to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS claimed_domain TEXT,
  ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_claim_id UUID REFERENCES public.domain_claims(id);

-- RLS policies for domain_claims
ALTER TABLE public.domain_claims ENABLE ROW LEVEL SECURITY;

-- IT admins can read their own org's claims
CREATE POLICY "it_admins_read_own_claims" ON public.domain_claims
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'it_admin'
    )
  );

-- IT admins can insert claims for their org
CREATE POLICY "it_admins_insert_claims" ON public.domain_claims
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'it_admin'
    )
  );

-- IT admins can update their own org's claims
CREATE POLICY "it_admins_update_claims" ON public.domain_claims
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'it_admin'
    )
  );

-- Index for domain lookups
CREATE INDEX idx_domain_claims_domain ON public.domain_claims(domain);
CREATE INDEX idx_domain_claims_org_id ON public.domain_claims(organization_id);
CREATE INDEX idx_domain_claims_status ON public.domain_claims(status);
```

### Database Migration: `domain_capture_users` Table

Track individual user capture status during the capture period:

```sql
CREATE TABLE public.domain_capture_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_claim_id UUID NOT NULL REFERENCES public.domain_claims(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'captured', 'declined')),
  prompted_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  prompt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain_claim_id, user_id)
);

-- RLS policies
ALTER TABLE public.domain_capture_users ENABLE ROW LEVEL SECURITY;

-- IT admins can read capture users for their org's claims
CREATE POLICY "it_admins_read_capture_users" ON public.domain_capture_users
  FOR SELECT USING (
    domain_claim_id IN (
      SELECT dc.id FROM public.domain_claims dc
      JOIN public.organization_members om ON om.organization_id = dc.organization_id
      WHERE om.user_id = auth.uid() AND om.role = 'it_admin'
    )
  );

-- Users can read their own capture records
CREATE POLICY "users_read_own_capture" ON public.domain_capture_users
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own capture records (accept/decline)
CREATE POLICY "users_update_own_capture" ON public.domain_capture_users
  FOR UPDATE USING (user_id = auth.uid());

-- Index
CREATE INDEX idx_domain_capture_users_claim ON public.domain_capture_users(domain_claim_id);
CREATE INDEX idx_domain_capture_users_user ON public.domain_capture_users(user_id);
CREATE INDEX idx_domain_capture_users_status ON public.domain_capture_users(status);
```

### DNS TXT Record Generation

When the IT admin initiates domain claim:

1. Generate a unique verification token: `magic-audit-verify=<random-hex-32>`
2. Store in `domain_claims` table with `status = 'pending'`
3. Display instructions to the IT admin:
   - "Add a TXT record to your domain's DNS settings"
   - Record type: `TXT`
   - Host/Name: `_magic-audit` (or `@` if subdomain not supported)
   - Value: `magic-audit-verify=<token>`
   - TTL: 3600
4. Provide a "Verify Now" button

### Verification API Endpoint

Create a server action that:

1. Accepts `domain_claim_id`
2. Looks up the expected `verification_token` from `domain_claims`
3. Performs DNS TXT lookup on the domain using Node.js `dns.promises.resolveTxt()`
   - Check both `_magic-audit.<domain>` and root `<domain>` TXT records
4. If token found in any TXT record:
   - Update `domain_claims.status = 'verified'`, set `verified_at`, `verified_by`
   - Update `organizations.claimed_domain`, `domain_verified_at`, `domain_claim_id`
   - Trigger Phase 2 (capture period initiation)
5. If token NOT found:
   - Increment `check_count`, update `last_checked_at`
   - Return user-friendly error ("TXT record not found yet. DNS changes can take up to 48 hours to propagate.")
6. Rate limit: max 1 check per 60 seconds per claim

### Settings UI: Domain Verification Page

Add a new settings page at `/dashboard/settings/domain` (IT admin only):

**States:**
- **No Claim:** Show "Claim Your Domain" form with email domain pre-filled from IT admin's email
- **Pending Verification:** Show DNS instructions, verification token, "Verify Now" button, check count
- **Verified:** Show green checkmark, verified date, link to capture report
- **Capture Active:** Show capture period status with countdown timer

### New Files (Phase 1)

| File | Purpose |
|------|---------|
| `app/dashboard/settings/domain/page.tsx` | Domain verification settings page (server component) |
| `components/settings/DomainClaimForm.tsx` | Client component for claim initiation |
| `components/settings/DomainVerificationStatus.tsx` | Client component showing verification status & instructions |
| `lib/actions/domainClaim.ts` | Server actions: `initiateDomainClaim`, `verifyDomainClaim` |
| `lib/types/domain.ts` | TypeScript types for domain claim entities |

### Modified Files (Phase 1)

| File | Change |
|------|--------|
| `app/dashboard/layout.tsx` | Add "Settings" nav link (visible to `it_admin` role) |

### Acceptance Criteria (Phase 1)

- [ ] `domain_claims` table created with proper schema, RLS, and indexes
- [ ] `domain_capture_users` table created with proper schema, RLS, and indexes
- [ ] `organizations` table has `claimed_domain`, `domain_verified_at`, `domain_claim_id` columns
- [ ] IT admin can initiate domain claim from Settings page
- [ ] Unique DNS TXT verification token is generated and displayed
- [ ] DNS TXT record verification works via `dns.promises.resolveTxt()`
- [ ] Verification is rate-limited (1 check per 60 seconds)
- [ ] On successful verification, `domain_claims.status` transitions to `verified`
- [ ] Settings page shows correct state for each claim status
- [ ] Only `it_admin` role can access the domain settings page
- [ ] Dashboard nav shows "Settings" link for IT admins

---

## Phase 2: 14-Day Capture Period

### Requirements

Upon successful domain verification, the system discovers all existing Magic Audit users whose email matches the claimed domain and initiates a 14-day capture period. During this period, matched users see a capture modal on their next login, and new signups with the domain are auto-added.

### Discovery Query (Server Action)

On verification success (end of Phase 1), run a discovery query:

```sql
-- Find all users with matching email domain who are NOT already in the org
SELECT u.id, u.email, u.display_name, u.first_name, u.last_name, u.created_at
FROM public.users u
WHERE u.email LIKE '%@' || <claimed_domain>
  AND u.id NOT IN (
    SELECT om.user_id FROM public.organization_members om
    WHERE om.organization_id = <org_id> AND om.user_id IS NOT NULL
  )
  AND u.status = 'active';
```

For each discovered user:
1. Insert a row into `domain_capture_users` with `status = 'pending'`
2. Set `domain_claims.capture_started_at = now()`
3. Set `domain_claims.capture_ends_at = now() + interval '14 days'`

### Capture Modal (Shown to Matching Users on Login)

When a user logs in (in the auth callback route), check if they have any pending capture records:

```sql
SELECT dcu.id, dcu.domain_claim_id, dc.domain, o.name as org_name
FROM public.domain_capture_users dcu
JOIN public.domain_claims dc ON dc.id = dcu.domain_claim_id
JOIN public.organizations o ON o.id = dc.organization_id
WHERE dcu.user_id = <user_id>
  AND dcu.status = 'pending'
  AND dc.capture_ends_at > now();
```

If a pending capture exists, redirect to a capture prompt page (or show an interstitial modal) with:
- Organization name and claimed domain
- "Your email domain has been claimed by [Org Name]. Would you like to join this organization?"
- **Accept** button: Adds user to org as `agent` role (default), sets `domain_capture_users.status = 'captured'`
- **Decline** button: Sets `domain_capture_users.status = 'declined'`, user continues to their normal dashboard
- Capture period countdown ("You have X days to decide")

### Accept Flow

When user accepts:

1. Create `organization_members` record:
   - `organization_id`: from the domain claim
   - `user_id`: the accepting user
   - `role`: org's `default_member_role` (or 'agent' if not set)
   - `license_status`: 'active'
   - `joined_at`: now()
   - `provisioned_by`: 'jit' (just-in-time via domain capture)
2. Update `domain_capture_users.status = 'captured'`, `responded_at = now()`
3. Redirect user to the organization dashboard

### Decline Flow

When user declines:

1. Update `domain_capture_users.status = 'declined'`, `responded_at = now()`
2. User continues to their normal experience (no further prompts for this claim)

### Auto-Add New Signups During Capture Period

Modify the auth callback route (`/auth/callback/route.ts`) to check:
- After a new user signs up (first-time OAuth)
- If their email domain matches an active `domain_claims` where `capture_ends_at > now()`
- Auto-create a `domain_capture_users` record with `status = 'pending'`
- Show the capture modal on their first login

### New Files (Phase 2)

| File | Purpose |
|------|---------|
| `app/dashboard/capture/page.tsx` | Capture prompt interstitial page |
| `components/capture/CapturePromptModal.tsx` | Modal UI for accept/decline decision |
| `lib/actions/domainCapture.ts` | Server actions: `discoverDomainUsers`, `acceptCapture`, `declineCapture` |

### Modified Files (Phase 2)

| File | Change |
|------|--------|
| `app/auth/callback/route.ts` | Add capture check after auth success; auto-create capture record for new signups with matching domain |
| `lib/actions/domainClaim.ts` | Add `startCapturePeriod` logic called after verification succeeds |

### Acceptance Criteria (Phase 2)

- [ ] Discovery query runs on domain verification and populates `domain_capture_users`
- [ ] `domain_claims.capture_started_at` and `capture_ends_at` are set (14-day window)
- [ ] Matching users see capture prompt on next login
- [ ] Accept flow creates `organization_members` record and updates capture status
- [ ] Decline flow updates capture status and stops future prompts for this claim
- [ ] New users with matching domain during capture period get a capture record
- [ ] Capture prompt is not shown after `capture_ends_at` passes
- [ ] Users who are already members of the org are excluded from discovery

---

## Phase 3: IT Admin Capture Report

### Requirements

The IT admin needs a dashboard page to monitor the capture period -- seeing all discovered accounts, their statuses, and the capture period countdown.

### Capture Report Page

Add a page at `/dashboard/settings/domain/capture-report`:

**Layout:**
- **Header:** "Domain Capture Report - [domain]"
- **Countdown Timer:** "Capture period ends in X days, Y hours" (or "Capture period ended on [date]")
- **Summary Cards:**
  - Total Discovered: N users
  - Captured (Accepted): N users (green)
  - Pending: N users (amber)
  - Declined: N users (gray)
- **User Table:** Sortable/filterable table with columns:
  - Email
  - Name (display_name or first_name + last_name)
  - Status (badge: Captured / Pending / Declined)
  - Account Created (user's `created_at`)
  - Prompted At (when they first saw the modal)
  - Responded At (when they accepted/declined)
- **Actions:**
  - "Extend Capture Period" button (if capture active and not already extended) -- extends by 7 more days
  - "Export CSV" button

### Data Query

```sql
SELECT
  dcu.id,
  dcu.email,
  dcu.status,
  dcu.prompted_at,
  dcu.responded_at,
  dcu.prompt_count,
  u.display_name,
  u.first_name,
  u.last_name,
  u.created_at as user_created_at
FROM public.domain_capture_users dcu
JOIN public.users u ON u.id = dcu.user_id
WHERE dcu.domain_claim_id = <claim_id>
ORDER BY dcu.status ASC, dcu.email ASC;
```

### New Files (Phase 3)

| File | Purpose |
|------|---------|
| `app/dashboard/settings/domain/capture-report/page.tsx` | Capture report server component |
| `components/settings/CaptureReportTable.tsx` | Client component for sortable/filterable user table |
| `components/settings/CaptureReportSummary.tsx` | Summary cards with capture statistics |
| `components/settings/CaptureCountdown.tsx` | Countdown timer component |
| `lib/actions/captureReport.ts` | Server actions: `getCaptureReport`, `extendCapturePeriod`, `exportCaptureCSV` |

### Modified Files (Phase 3)

| File | Change |
|------|--------|
| `components/settings/DomainVerificationStatus.tsx` | Add link to capture report when capture is active |

### Acceptance Criteria (Phase 3)

- [ ] Capture report page shows all discovered users with correct statuses
- [ ] Summary cards show accurate counts for captured/pending/declined
- [ ] Countdown timer displays remaining time in capture period
- [ ] User table is sortable by email, status, dates
- [ ] "Extend Capture Period" adds 7 days to `capture_ends_at` (one extension max)
- [ ] `domain_claims.capture_extended` and `capture_extended_at` are set on extension
- [ ] Page is only accessible to `it_admin` role
- [ ] Page handles expired capture period gracefully (shows "Capture period ended" state)

---

## Phase 4: Post-Capture & SSO Migration

### Requirements

After the capture period ends (or when the IT admin manually completes it), remaining pending users are marked as expired, and captured users are migrated to SSO authentication.

### Capture Period Expiry Handling

Create a utility function (called on page load or via cron) that:

1. Finds `domain_claims` where `capture_ends_at < now()` and `capture_completed_at IS NULL`
2. For each expired claim:
   - Update remaining `pending` `domain_capture_users` to a final state (keep as `pending` but treat as expired -- the `capture_ends_at` on the parent claim is the authority)
   - Set `domain_claims.capture_completed_at = now()`
3. Log completion in `audit_logs`

### SSO Migration for Captured Users

After capture completes, migrate captured users to SSO:

1. Query all `domain_capture_users` with `status = 'captured'` for the claim
2. For each captured user, update `users` table:
   - `is_managed = true`
   - `sso_only = true` (if org has `sso_required = true`)
   - `provisioning_source = 'jit'`
3. If the org has an identity provider configured in `organization_identity_providers`:
   - Link the user to the IDP
   - Set `users.last_sso_provider` to the provider type
4. Update `organizations.sso_enabled = true` if not already

### Manual Completion Option

Add a "Complete Capture Early" button on the capture report page that:
1. Sets `domain_claims.capture_completed_at = now()`
2. Triggers SSO migration for already-captured users
3. Remaining pending users can no longer accept

### Extend Period Option

Already covered in Phase 3. The "Extend Capture Period" button:
1. Adds 7 days to `capture_ends_at`
2. Sets `capture_extended = true`, `capture_extended_at = now()`
3. Only allowed once per claim

### New Files (Phase 4)

| File | Purpose |
|------|---------|
| `lib/actions/captureCompletion.ts` | Server actions: `completeCaptureEarly`, `processExpiredCaptures`, `migrateCapturedUsersToSSO` |

### Modified Files (Phase 4)

| File | Change |
|------|--------|
| `app/auth/callback/route.ts` | Check `sso_only` flag on login; enforce SSO for managed users |
| `components/settings/CaptureReportSummary.tsx` | Add "Complete Capture Early" button |
| `lib/actions/captureReport.ts` | Add completion action |
| `app/dashboard/settings/domain/capture-report/page.tsx` | Handle completed capture state, show SSO migration status |

### Acceptance Criteria (Phase 4)

- [ ] Expired capture periods are detected and `capture_completed_at` is set
- [ ] Pending users after expiry are no longer shown the capture prompt
- [ ] Captured users have `is_managed = true` set after capture completes
- [ ] If org has `sso_required = true`, captured users get `sso_only = true`
- [ ] "Complete Capture Early" button works and triggers SSO migration
- [ ] Audit log entry created on capture completion
- [ ] Auth callback enforces SSO-only login for managed users (redirects to SSO provider instead of allowing Google/email login)

---

## Complete File Inventory

### New Files (All Phases)

| File | Phase | Purpose |
|------|-------|---------|
| `app/dashboard/settings/domain/page.tsx` | 1 | Domain verification settings page |
| `app/dashboard/settings/domain/capture-report/page.tsx` | 3 | Capture report dashboard |
| `app/dashboard/capture/page.tsx` | 2 | Capture prompt page for end users |
| `components/settings/DomainClaimForm.tsx` | 1 | Claim initiation form |
| `components/settings/DomainVerificationStatus.tsx` | 1 | Verification status display |
| `components/settings/CaptureReportTable.tsx` | 3 | User capture status table |
| `components/settings/CaptureReportSummary.tsx` | 3 | Summary cards + actions |
| `components/settings/CaptureCountdown.tsx` | 3 | Countdown timer |
| `components/capture/CapturePromptModal.tsx` | 2 | Accept/decline modal |
| `lib/actions/domainClaim.ts` | 1 | Domain claim server actions |
| `lib/actions/domainCapture.ts` | 2 | Capture discovery/accept/decline |
| `lib/actions/captureReport.ts` | 3 | Report data + extend period |
| `lib/actions/captureCompletion.ts` | 4 | Completion + SSO migration |
| `lib/types/domain.ts` | 1 | TypeScript types |

### Modified Files (All Phases)

| File | Phase | Change |
|------|-------|--------|
| `app/dashboard/layout.tsx` | 1 | Add "Settings" nav link for IT admins |
| `app/auth/callback/route.ts` | 2, 4 | Add capture check on login; auto-add new signups; enforce SSO-only |

### Database Migrations

| Migration Name | Phase | Description |
|----------------|-------|-------------|
| `create_domain_claims` | 1 | Create `domain_claims` table with RLS and indexes |
| `create_domain_capture_users` | 1 | Create `domain_capture_users` table with RLS and indexes |
| `add_org_domain_columns` | 1 | Add `claimed_domain`, `domain_verified_at`, `domain_claim_id` to `organizations` |

---

## TypeScript Types (`lib/types/domain.ts`)

```typescript
/**
 * Domain Claim & Capture Types
 * TASK-1820: Domain claim and user capture flow
 */

// ============================================================================
// Enums / Union Types
// ============================================================================

export type DomainClaimStatus = 'pending' | 'verified' | 'failed' | 'expired';

export type CaptureUserStatus = 'pending' | 'captured' | 'declined';

// ============================================================================
// Core Interfaces
// ============================================================================

export interface DomainClaim {
  id: string;
  organization_id: string;
  domain: string;
  verification_token: string;
  status: DomainClaimStatus;
  verified_at: string | null;
  verified_by: string | null;
  last_checked_at: string | null;
  check_count: number;
  capture_started_at: string | null;
  capture_ends_at: string | null;
  capture_extended: boolean;
  capture_extended_at: string | null;
  capture_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainCaptureUser {
  id: string;
  domain_claim_id: string;
  user_id: string;
  email: string;
  status: CaptureUserStatus;
  prompted_at: string | null;
  responded_at: string | null;
  prompt_count: number;
  created_at: string;
  updated_at: string;
  // Joined data (optional)
  user?: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    created_at: string;
  };
}

// ============================================================================
// Action Result Types
// ============================================================================

export interface DomainClaimResult {
  success: boolean;
  error?: string;
  claim?: DomainClaim;
}

export interface VerificationResult {
  success: boolean;
  error?: string;
  verified?: boolean;
  usersDiscovered?: number;
}

export interface CaptureActionResult {
  success: boolean;
  error?: string;
}

export interface CaptureReportData {
  claim: DomainClaim;
  users: DomainCaptureUser[];
  summary: {
    total: number;
    captured: number;
    pending: number;
    declined: number;
  };
}
```

---

## Technical Considerations

### DNS Resolution

- Use `dns.promises.resolveTxt()` from Node.js built-in `dns` module (available in Next.js server actions)
- DNS resolution may return multiple TXT records; check all of them
- TXT records may be split across multiple strings (DNS spec allows 255-char chunks); concatenate before checking
- Handle NXDOMAIN (domain not found) and SERVFAIL gracefully

### Rate Limiting

- Store `last_checked_at` in `domain_claims` and reject checks within 60 seconds
- This prevents abuse of DNS resolution (external network calls)

### Security

- Only `it_admin` role can initiate domain claims
- Verification tokens must be cryptographically random (`crypto.randomBytes(32)`)
- Domain must be extracted from the IT admin's verified email (prevent claiming arbitrary domains)
- The claimed domain must match the IT admin's email domain OR the org's `sso_domain_restriction`
- RLS policies must ensure data isolation between organizations

### Auth Callback Modifications

The auth callback (`/auth/callback/route.ts`) is a critical file already handling:
- OAuth code exchange
- Role checking
- Pending invite linking
- IT admin auto-provisioning

Modifications must be minimal and non-breaking:
1. Add capture check AFTER existing membership check succeeds
2. Add new-signup domain matching AFTER user record creation
3. Preserve all existing behavior

### Edge Cases

| Scenario | Handling |
|----------|----------|
| User belongs to multiple orgs | Show capture prompt; they can accept to join additional org |
| IT admin claims domain already claimed by another org | Reject: "This domain is already claimed by another organization" |
| User declines then org extends capture | Decline is final; do not re-prompt |
| User signs up after capture period ends | Normal flow; no capture prompt |
| IT admin's own account | Exclude from discovery (already a member) |
| Domain with no existing users | Valid claim; capture period starts with 0 discovered users |

---

## Branch Information

**Branch From:** `develop`
**Branch Into:** `develop`
**Branch Name:** `feature/domain-claim-capture`

## Implementation Summary

*(To be filled by Engineer after implementation)*

| Field | Value |
|-------|-------|
| **Agent ID** | |
| **Actual Tokens** | |
| **Duration** | |
| **Files Changed** | |
| **Issues/Blockers** | |

### Implementation Notes

*(Document approach decisions, deviations from spec, and issues encountered)*
