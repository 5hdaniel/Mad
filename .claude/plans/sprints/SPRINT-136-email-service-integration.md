# Sprint Plan: SPRINT-136 — Email Service Integration

## Sprint Goal

Establish a transactional email service in the broker portal using Microsoft Graph API (M365) as the provider, then wire it into two immediate use cases: (1) automated user invite emails (replacing the current copy-paste link workflow) and (2) support ticket notification emails (agent reply notifies customer, ticket assignment notifies agent). This sprint completes the "Sprint 0" scope from the FEATURE-support-tool plan and satisfies BACKLOG-746.

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout develop && git pull origin develop`
- [ ] `cd broker-portal && npm install`
- [ ] Verify type-check passes: `npx tsc --noEmit` (from `broker-portal/`)
- [ ] Verify build passes: `npm run build` (from `broker-portal/`)
- [ ] Confirm Microsoft Graph API environment variables are available:
  - `AZURE_TENANT_ID` -- the organization's Azure AD tenant ID
  - `AZURE_CLIENT_ID` -- app registration client ID (with `Mail.Send` application permission)
  - `AZURE_CLIENT_SECRET` -- app registration client secret
  - `EMAIL_SENDER_ADDRESS` -- e.g., `noreply@keeprcompliance.com`

**Note**: This sprint does NOT touch the Electron desktop app or admin portal (except TASK-2199 which modifies admin-portal notification triggers). No native module rebuilds needed.

## In Scope

| ID | Title | Backlog | Est. Tokens |
|----|-------|---------|-------------|
| TASK-2197 | Email Service Infrastructure + Templates | BACKLOG-746 | ~15K |
| TASK-2198 | User Invite Email Delivery | BACKLOG-746 | ~12K |
| TASK-2199 | Support Ticket Notification Emails | BACKLOG-746 | ~15K |

**Total Estimated:** ~42K tokens

## Out of Scope / Deferred

- Password reset emails -- handled by Supabase built-in auth mailer (per FEATURE-support-tool routing table)
- Email verification -- handled by Supabase built-in auth mailer
- Inbound email-to-ticket (email parsing webhook) -- Sprint B scope, requires MX/DNS setup
- Rate limiting on invite sends -- deferring to follow-up; low risk at current user volume
- Desktop app email features -- separate sprint
- Admin portal email features -- separate sprint
- SPF/DKIM/DMARC domain verification -- ops task, not code; PM will configure in Azure/DNS
- Resend invite from UI (re-send expired invite) -- follow-up sprint

## Reprioritized Backlog (Top 3)

| ID | Title | Priority | Rationale | Dependencies | Conflicts |
|----|-------|----------|-----------|--------------|-----------|
| TASK-2197 | Email Service Infrastructure + Templates | 1 | Foundation for all email tasks; blocks 2198 and 2199 | None | None |
| TASK-2198 | User Invite Email Delivery | 2 | Primary use case; admin-facing workflow improvement | TASK-2197 | None |
| TASK-2199 | Support Ticket Notification Emails | 2 | Completes support ticket loop; customer-facing | TASK-2197 | None |

## Phase Plan

### Phase 1: Email Service Foundation (Sequential -- Must Complete First)

- TASK-2197: Email Service Infrastructure + Templates

Creates the `broker-portal/lib/email/` module with Microsoft Graph API integration using client credentials flow (app-only auth), typed send functions, HTML email templates, and error handling. This is the shared foundation that TASK-2198 and TASK-2199 depend on.

**Integration checkpoint**: TASK-2197 merged to `develop`, CI passes, `npm run type-check` clean.

### Phase 2: Email Consumers (Fully Parallel)

- TASK-2198: User Invite Email Delivery
- TASK-2199: Support Ticket Notification Emails

Both tasks import from `broker-portal/lib/email/` (created in Phase 1) and wire email sending into their respective flows. They touch completely different files:

- **TASK-2198** modifies: `broker-portal/lib/actions/inviteUser.ts`, `broker-portal/components/users/InviteUserModal.tsx`
- **TASK-2199** creates: `broker-portal/app/api/email/ticket-notification/route.ts`, modifies admin-portal or broker-portal support reply flows

**Why parallel is safe:**
- TASK-2198 touches invite flow files only (no support ticket files)
- TASK-2199 touches support ticket files only (no invite files)
- Both import from `lib/email/` (read-only dependency, no modifications)
- No shared mutable files

**Integration checkpoint**: Both tasks merged to `develop`, CI passes.

## Merge Plan

- **Target branch**: `develop`
- **Feature branch format**: `feature/TASK-XXXX-slug`
- **Merge order** (explicit):
  1. TASK-2197 -> develop (must merge first -- foundation)
  2. TASK-2198 -> develop (after TASK-2197 merged)
  3. TASK-2199 -> develop (after TASK-2197 merged, parallel with TASK-2198)

## Dependency Graph (Mermaid)

```mermaid
graph TD
    subgraph Phase1[Phase 1 — Foundation]
        TASK2197[TASK-2197: Email Service + Templates]
    end

    subgraph Phase2[Phase 2 — Consumers — Parallel]
        TASK2198[TASK-2198: Invite Email Delivery]
        TASK2199[TASK-2199: Ticket Notification Emails]
    end

    TASK2197 --> TASK2198
    TASK2197 --> TASK2199
```

## Dependency Graph (YAML)

```yaml
dependency_graph:
  nodes:
    - id: TASK-2197
      type: task
      phase: 1
      title: "Email Service Infrastructure + Templates"
    - id: TASK-2198
      type: task
      phase: 2
      title: "User Invite Email Delivery"
    - id: TASK-2199
      type: task
      phase: 2
      title: "Support Ticket Notification Emails"
  edges:
    - from: TASK-2197
      to: TASK-2198
      type: depends_on
      note: "TASK-2198 imports from lib/email/ created by TASK-2197"
    - from: TASK-2197
      to: TASK-2199
      type: depends_on
      note: "TASK-2199 imports from lib/email/ created by TASK-2197"
```

## Testing & Quality Plan (REQUIRED)

### Unit Testing

- TASK-2197: Test email service with mocked Graph API client (send success, send failure, validation errors)
- TASK-2198: Update existing `inviteUser.test.ts` to verify email sending is called (mock the email service)
- TASK-2199: Test notification trigger logic with mocked email service

### Coverage Expectations

- Coverage impact: Must not decrease existing coverage
- New modules (`lib/email/`) should have core send logic tested

### Integration / Feature Testing

- TASK-2197: Manual test with Graph API (send to a test mailbox via app-only auth)
- TASK-2198: Admin invites user -> email arrives within 30 seconds with correct link
- TASK-2199: Agent replies to ticket -> customer receives notification email; agent assigned to ticket -> agent receives notification email

### CI / CD Quality Gates

The following MUST pass before merge:
- [ ] Type checking (`npx tsc --noEmit`)
- [ ] Linting / formatting (`npm run lint`)
- [ ] Build step (`npm run build`)
- [ ] Unit tests (where applicable)

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Azure app registration not configured with `Mail.Send` permission | Medium | High | Engineer must check for missing env vars and fail gracefully with clear error log; PM will set up app registration |
| Graph API token acquisition failure (wrong tenant/client) | Medium | High | Clear error logging in credential bootstrap; validate config on startup |
| Email delivery delays | Low | Low | Graph API is fast; real delays would be M365-side |
| InviteUserModal test breaks from UI changes | Low | Medium | Mock the inviteUser action, not the full component tree |
| Support reply RPC is in Supabase, hard to hook into | Medium | Medium | Use Next.js API route as webhook/middleware layer between RPC and email |

## Decision Log

### Decision: Use Microsoft Graph API (M365) as the email provider

- **Date**: 2026-03-16
- **Context**: BACKLOG-746 listed Resend, SendGrid, Postmark, AWS SES, and Microsoft Graph API as options. The organization already uses M365 and the Graph API is already integrated in the Electron desktop app for Outlook email sync.
- **Decision**: Use Microsoft Graph API with app-only auth (client credentials flow)
- **Rationale**:
  1. **Already have M365** -- no new vendor, no new billing, no additional signup
  2. **Graph API already integrated** -- the Electron app already uses `@microsoft/microsoft-graph-client` and `@azure/identity` for Outlook integration, so team familiarity is high
  3. **No new vendor dependency** -- Resend/SendGrid would introduce a third-party dependency when we already have email infrastructure via M365
  4. **Unified email infrastructure** -- all email (desktop sync, transactional sends) goes through the same M365 tenant
  5. **App-only auth** -- client credentials flow with `Mail.Send` application permission allows server-side sending without user interaction
- **Impact**: `@microsoft/microsoft-graph-client` and `@azure/identity` packages added to broker-portal. Azure app registration needs `Mail.Send` application permission (admin consent required).

### Decision: Email service lives in broker-portal only (not Supabase Edge Function)

- **Date**: 2026-03-16
- **Context**: BACKLOG-746 mentions service could live in Edge Function or Next.js API route
- **Decision**: Next.js server actions and API routes in broker-portal
- **Rationale**: Invite flow is already a broker-portal server action. Support ticket replies go through broker-portal. Keeping email in the same runtime avoids cross-service complexity. Can migrate to Edge Function later if needed.

### Decision: Three tasks instead of four (templates bundled with service)

- **Date**: 2026-03-16
- **Context**: Could separate email templates into their own task
- **Decision**: Bundle templates with the email service task (TASK-2197)
- **Rationale**: Templates are tightly coupled with send functions (each template is used by exactly one send method). Separating them would create a blocker dependency with no parallelization benefit.

### Decision: Reuse existing Keepr Azure app registration

- **Date**: 2026-03-16
- **Context**: Keepr already has an Azure app registration (`3a6c341a-17ab-4739-977d-a7d71b27f945`) used for PKCE login + Outlook sync. Question was whether to create a new registration for server-side email sending or reuse the existing one.
- **Decision**: Reuse the existing registration with modifications
- **Rationale**:
  1. Adding `Mail.Send` Application permission to the existing registration does not affect existing delegated permissions (PKCE login, Mail.Read, Contacts.Read)
  2. Application permissions (server-side) and Delegated permissions (user-side) are completely separate channels — no client impact
  3. A new client secret is needed (current flow uses PKCE with no secret), but this only applies to the server-side code
  4. Less Azure admin overhead than creating a second registration
- **Impact**: Engineer must use env vars `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (not the existing `MICROSOFT_*` prefixed vars from the Electron app). PM will configure the app registration before manual testing.

### Decision: Defer rate limiting to follow-up sprint

- **Date**: 2026-03-16
- **Context**: BACKLOG-746 lists rate limiting as a requirement
- **Decision**: Defer to a follow-up sprint
- **Rationale**: At current user volume (<50 orgs), rate limiting adds complexity without proportional value. M365 has its own sending limits (10,000 emails/day per mailbox). We can add application-level rate limiting when user volume increases.

## Unplanned Work Log

| Task | Source | Root Cause | Added Date | Est. Tokens | Actual Tokens |
|------|--------|------------|------------|-------------|---------------|
| - | - | - | - | - | - |

### Unplanned Work Summary (Updated at Sprint Close)

| Metric | Value |
|--------|-------|
| Unplanned tasks | 0 |
| Unplanned PRs | 0 |
| Unplanned lines changed | +0/-0 |
| Unplanned tokens (est) | 0 |
| Unplanned tokens (actual) | 0 |
| Discovery buffer | 0% |

### Root Cause Categories

| Category | Count | Examples |
|----------|-------|----------|
| Integration gaps | 0 | - |
| Validation discoveries | 0 | - |
| Review findings | 0 | - |
| Dependency discoveries | 0 | - |
| Scope expansion | 0 | - |

## Sprint Retrospective

*Populated at sprint close by `/sprint-close` skill. Do not fill manually -- the skill aggregates from task files.*

### Estimation Accuracy

| Task | Est Tokens | Actual Tokens | Variance | Notes |
|------|-----------|---------------|----------|-------|
| TASK-2197 | ~15K | - | - | - |
| TASK-2198 | ~12K | - | - | - |
| TASK-2199 | ~15K | - | - | - |

### Issues Encountered

| # | Task | Issue | Severity | Resolution | Time Impact |
|---|------|-------|----------|------------|-------------|
| - | - | - | - | - | - |

### Lessons Learned

#### What Went Well
- *TBD*

#### What Didn't Go Well
- *TBD*

#### Estimation Insights
- *TBD*

#### Architecture & Codebase Insights
- *TBD*

#### Process Improvements
- *TBD*

#### Recommendations for Next Sprint
- *TBD*

---

## End-of-Sprint Validation Checklist

- [ ] All tasks merged to develop
- [ ] All CI checks passing
- [ ] All acceptance criteria verified
- [ ] Testing requirements met
- [ ] No unresolved conflicts
- [ ] Documentation updated (if applicable)
- [ ] Ready for release (if applicable)
- [ ] **Sprint retrospective populated** (via `/sprint-close`)
- [ ] **Worktree cleanup complete**

## Worktree Cleanup (Post-Sprint)

```bash
git worktree list
git worktree remove Mad-task-2197 --force
git worktree remove Mad-task-2198 --force
git worktree remove Mad-task-2199 --force
git worktree list
```
