# BACKLOG-621: Domain Claim & User Capture

**Category:** Feature
**Priority:** High
**Status:** Pending
**Created:** 2026-02-06
**Estimate:** ~120K tokens (multi-sprint)
**Complexity:** Large

---

## Summary

Allow IT admins to claim their organization's email domain (e.g., `@cbolympia.com`) via DNS TXT verification, then automatically discover and capture existing users with matching domain emails into the organization during a 14-day capture window.

---

## Background

Currently, users can sign up individually before their organization's IT admin sets up the org in Magic Audit. For example, Madison (`madison.delvigo@cbolympia.com`) signed up individually before Bret set up the CB Olympia org. There is no mechanism for Bret to discover and absorb her account into the org. This feature closes that gap by providing domain verification, user capture, and SSO migration capabilities.

---

## Requirements

### Phase 1: Domain Verification

- IT admin initiates domain claim from dashboard (Settings > Domain)
- System generates a unique DNS TXT record value (e.g., `magic-audit-verify=abc123xyz`)
- Admin adds this TXT record to their domain's DNS settings
- System provides a "Verify" button that checks for the TXT record
- Once verified, domain is marked as claimed by that org
- Only one org can claim a domain at a time
- Prevent claiming common public domains (gmail.com, outlook.com, yahoo.com, etc.)

### Phase 2: Capture Period (14 days)

- After domain verification, a 14-day capture window begins
- During this window, any existing `auth.users` with matching domain emails who log in are:
  - Shown a notification/modal: "Your organization [Org Name] has claimed this domain. Your account will be managed by your IT administrator."
  - Given option to accept (join org) or decline (must use a different email)
  - If accepted: `organization_members` row created, profile linked to org
  - If org has SSO enabled: user's auth is switched to SSO on next login
- New signups with the domain email during capture period are auto-added to the org
- Users who decline are flagged and cannot use the domain email for independent accounts going forward

### Phase 3: IT Admin Capture Report

- Dashboard view showing:
  - All existing accounts found with the domain email (discovered at verification time)
  - Status of each: captured, pending (hasn't logged in yet), declined
  - Date captured or last login attempt
  - Capture period countdown (days remaining)
- Email notification to IT admin when capture period ends with summary

### Phase 4: Post-Capture

- After 14 days, uncaptured accounts remain independent but are flagged
- IT admin can extend capture period (additional 14-day increments) or send reminder emails
- Domain remains verified/claimed permanently (until explicitly released by admin)
- Released domains have a cooldown period before another org can claim them

---

## Technical Considerations

### DNS TXT Verification

- Use Node.js `dns.resolveTxt()` for server-side verification
- Alternatively, use an external DNS API for more reliable cross-platform resolution
- Generate cryptographically secure verification tokens (e.g., `crypto.randomUUID()`)
- Allow multiple verification attempts with exponential backoff guidance to the admin (DNS propagation can take up to 48 hours)

### Database Changes

**New tables:**

```sql
-- Domain claims tracking
CREATE TABLE domain_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  domain TEXT NOT NULL UNIQUE,
  verification_token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_verification', 'verified', 'released')),
  verified_at TIMESTAMPTZ,
  capture_period_ends_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Capture log for tracking individual user capture status
CREATE TABLE domain_capture_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_claim_id UUID NOT NULL REFERENCES domain_claims(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('discovered', 'notified', 'accepted', 'declined')),
  discovered_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**New columns on `organizations`:**

```sql
ALTER TABLE organizations
  ADD COLUMN claimed_domain TEXT,
  ADD COLUMN domain_verified_at TIMESTAMPTZ,
  ADD COLUMN capture_period_ends_at TIMESTAMPTZ;
```

### RLS Policies

- Only org admins (IT admin role) can view/manage domain claims for their org
- Capture report data visible only to the org that owns the domain claim
- Users can only see their own capture notification (not other users' statuses)
- Service role needed for the capture discovery query (scanning auth.users by domain)

### Edge Functions / Cron

- Edge function or cron job for capture period expiry notifications
- Edge function for DNS verification check (can be triggered by admin button click)
- Webhook or trigger for new user signup domain matching during active capture periods

### SSO Migration

- When a captured user's org has SSO enabled, the user's auth method must transition
- Handle the case where user has existing password-based auth and needs to switch to SSO
- Preserve user data and session continuity during migration

### Blocked Domain List

Maintain a list of public email domains that cannot be claimed:
- gmail.com, googlemail.com
- outlook.com, hotmail.com, live.com
- yahoo.com, ymail.com
- icloud.com, me.com, mac.com
- protonmail.com, proton.me
- aol.com
- (extensible list)

---

## Acceptance Criteria

- [ ] IT admin can initiate domain claim from Settings > Domain
- [ ] System generates unique DNS TXT verification value
- [ ] Admin can verify domain after adding TXT record
- [ ] Only one org can claim a domain at a time
- [ ] Public email domains (gmail, outlook, etc.) are blocked from claiming
- [ ] After verification, 14-day capture period begins automatically
- [ ] Existing users with matching domain emails are discovered and logged
- [ ] Matching users see capture modal on next login
- [ ] Users can accept (join org) or decline capture
- [ ] Accepted users get `organization_members` row created
- [ ] If org has SSO, captured users are switched to SSO auth
- [ ] New signups with domain email during capture are auto-added to org
- [ ] IT admin dashboard shows capture report with statuses
- [ ] Capture report shows countdown of days remaining
- [ ] Email notification sent to IT admin when capture period ends
- [ ] IT admin can extend capture period after expiry
- [ ] IT admin can release a domain claim
- [ ] RLS policies protect all domain claim and capture data
- [ ] Edge function handles capture period expiry

---

## Suggested Sprint Decomposition

This is a multi-sprint feature. Suggested breakdown:

### Sprint A: Domain Verification Infrastructure
1. Database migration for `domain_claims` table and `organizations` columns
2. DNS TXT verification logic (Edge function or server-side)
3. Settings > Domain UI for initiating and verifying claims
4. Blocked domain list enforcement
5. RLS policies for domain claims

### Sprint B: User Capture Mechanism
1. Database migration for `domain_capture_log` table
2. User discovery query (find existing users by domain)
3. Capture modal/notification component for matching users on login
4. Accept/decline flow with org membership creation
5. Auto-add logic for new signups during capture period

### Sprint C: Capture Report & Post-Capture
1. IT admin capture report dashboard view
2. Capture period countdown and status tracking
3. Edge function for capture period expiry notification
4. Extend capture period functionality
5. Domain release flow

### Sprint D: SSO Migration (if applicable)
1. Auth method transition for captured users when org has SSO
2. Session continuity during migration
3. Edge cases (password reset, linked accounts)

---

## Dependencies

- `/setup` flow for IT admin onboarding (BACKLOG-618 or related)
- Organization management infrastructure (existing)
- Supabase Auth user management (existing)
- SSO configuration (if Phase 4/Sprint D is included)

---

## Related Backlog Items

- BACKLOG-618: IT Admin Setup Flow (prerequisite - admin must be able to set up org first)
- BACKLOG-619: Admin Portal (domain management would live here)
- BACKLOG-620: Session Timeout (security complement)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| DNS propagation delays frustrate admins | Medium | Clear messaging about 24-48h propagation, retry guidance |
| Users decline capture and lose domain email access | High | Clear communication about what decline means, grace period |
| Multiple orgs attempt to claim same domain | Medium | Strict uniqueness constraint, clear error messaging |
| SSO migration breaks existing user sessions | High | Thorough testing, staged rollout, rollback plan |
| Capture period too short for large orgs | Low | Configurable extension in 14-day increments |

---

## Questions for Implementation

1. Should the capture period be configurable by the IT admin, or fixed at 14 days?
2. What happens if a user declines capture -- can they continue using their domain email independently, or must they change emails?
3. Should there be a "force capture" option for IT admins (no user consent required)?
4. How should we handle users with multiple orgs that share a domain (e.g., subsidiaries)?
5. Should domain verification be re-checked periodically (e.g., monthly) to ensure the org still controls the domain?
6. Should we support subdomain claims (e.g., `@sales.company.com` separate from `@company.com`)?
