# SPRINT-131: Email Integration + In-App Support Ticket Creation

**Status:** Planning
**Created:** 2026-03-13
**Backlog Items:** BACKLOG-941, BACKLOG-942, BACKLOG-943, BACKLOG-944
**Branch:** `feature/SPRINT-131-email-integration`
**Target:** develop

---

## Sprint Goal

Establish transactional email capability and wire it into the two highest-value use cases: (1) automatic delivery of user invitation emails (both org-level and internal), and (2) support ticket lifecycle notifications. Additionally, enable in-app support ticket creation with automatic diagnostics capture from both the desktop app (Electron) and broker portal (Next.js). By sprint end, admins will no longer need to copy/paste invite links, support ticket participants will receive email updates at every key event, and users can submit tickets with rich diagnostics directly from the app.

---

## Why Now

1. **Support Platform Phase 1 just shipped** (BACKLOG-938, SPRINT-130, merged as v2.9.5). The ticketing system is fully functional but has zero email notifications -- customers must check the portal manually. The requirements doc explicitly deferred email to "Phase 3."

2. **Invitation system has no email delivery.** Both the broker portal org invite and the admin portal internal invite generate tokens and links, but admins must manually copy/paste the link and communicate it out-of-band. This is the #1 usability gap in user management.

3. **Resend is the obvious provider choice.** React Email template system matches our stack (React/Next.js). Free tier covers our volume. First-class Vercel integration. No vendor lock-in (standard SMTP fallback). BACKLOG-746 already identified this direction.

4. **Desktop app has no support ticket UI.** Users must leave the app and navigate to the web form to submit tickets. The current `contactSupport` IPC handler just opens a mailto link. In-app submission with auto-captured diagnostics will dramatically improve support quality and response times.

---

## Architecture Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| Email service | `{portal}/lib/email/emailService.ts` | Shared `sendEmail()` wrapper around Resend SDK |
| Base layout | `{portal}/lib/email/templates/BaseLayout.tsx` | Branded email layout (logo, footer) |
| Invite templates | `{portal}/lib/email/templates/Invite*.tsx` | Org invite + internal invite email |
| Support templates | `admin-portal/lib/email/templates/Ticket*.tsx` | 6 support notification templates |
| Notification service | `admin-portal/lib/email/supportNotifications.ts` | Typed functions for each ticket event |
| Provider config | Environment variables (Vercel) | `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` |
| Desktop support dialog | `src/components/support/SupportTicketDialog.tsx` | In-app ticket creation with diagnostics |
| Desktop diagnostics | `electron/services/supportTicketService.ts` | Screenshot capture + diagnostics collection |
| Desktop IPC bridge | `electron/preload/supportBridge.ts` | Preload bridge for support IPC |
| Broker diagnostics | `broker-portal/app/support/components/BrowserDiagnostics.tsx` | Browser diagnostics + screenshot paste |

### Email Routing Decision

| Email Type | Sent From | Rationale |
|------------|-----------|-----------|
| Auth emails (confirm, magic link, reset) | Supabase built-in mailer | Already works, no change needed |
| Org user invitations | Broker portal (server action) | Invite flow lives here |
| Internal user invitations | Admin portal (API route) | Invite flow lives here |
| Support ticket notifications | Admin portal (after RPC calls) | Ticket management lives here |

### Why Resend (Not M365/Graph)

The FEATURE-support-tool.md originally suggested M365/Graph for email sending ("already have Graph API integration"). However:

| Factor | Resend | M365/Graph |
|--------|--------|------------|
| Setup effort | Install npm package + API key | Configure OAuth app, mail-enabled service account, Graph permissions |
| Template system | React Email (native React components) | Raw HTML string construction |
| Works from Vercel | Yes (HTTP API) | Yes but requires OAuth token refresh |
| Dependency on tenant | None | Requires M365 license + mailbox |
| Rate limits | 3K/month free, transparent | 10K/day per mailbox, opaque throttling |
| Maintenance | Zero (SaaS) | Service account password rotation, mailbox monitoring |

Resend wins decisively for transactional email. M365/Graph is better suited for *reading* emails (which the desktop app already does). Sending transactional emails from a dedicated service is industry standard practice.

---

## In-Scope

| Task ID | Title | Phase | Est. Tokens | Actual Tokens | Status |
|---------|-------|-------|-------------|---------------|--------|
| TASK-2177 | Email Service Foundation (Resend + Base Layout) | Phase 1: Foundation | ~40K | - | Pending |
| TASK-2178 | Invitation Email Templates + Integration | Phase 2: Invitations | ~45K | - | Pending |
| TASK-2179 | Support Ticket Email Notifications | Phase 3: Support Notifications | ~60K | - | Pending |
| TASK-2180 | Desktop In-App Support Ticket Dialog with Diagnostics | Phase 4: In-App Tickets (Desktop) | ~75K | - | Pending |
| TASK-2181 | Broker Portal Ticket Form Enhancements (Diagnostics + Screenshot Paste) | Phase 4: In-App Tickets (Broker) | ~30K | - | Pending |

**Total Estimated:** ~250K tokens

---

## Out of Scope / Deferred

| Item | Reason | Future Phase |
|------|--------|-------------|
| Email-to-ticket (inbound parsing) | Separate concern, requires MX/webhook setup | Support Phase 3+ |
| Reply-via-email (customer replies to notification email) | Requires inbound parse webhook + threading | Support Phase 3+ |
| SLA warning/breach email notifications | SLA engine not built yet (Phase 2) | Support Phase 2+ |
| Notification preferences per user | Needs settings UI + DB schema | Future sprint |
| Digest/summary emails | Low priority, needs aggregation logic | Future sprint |
| Password reset / verification emails | Already handled by Supabase built-in mailer | N/A |
| Welcome email on signup | Nice-to-have, not blocking | Future sprint |
| Email open/click tracking | Not needed for v1 | Future sprint |
| Unsubscribe management | Low volume, not legally required for transactional | Future sprint |
| Desktop ticket history/list view | Users can view tickets in broker portal | Future sprint |
| Screenshot annotation/cropping in desktop app | v1 captures full screenshot with remove option | Future sprint |

---

## Execution Plan

**Two execution tracks with different dependency chains.**

### Track A: Email Integration (SEQUENTIAL)

```
TASK-2177 (Foundation: Resend SDK + sendEmail() + Base Layout)
    |
    v
TASK-2178 (Invitations: 2 templates + wire into existing invite flows)
    |
    v
TASK-2179 (Support Notifications: 6 templates + notification service + wire into ticket RPCs)
```

**Why sequential:**
- TASK-2178 needs the email service and base layout from TASK-2177
- TASK-2179 needs the email service from TASK-2177 and can reference template patterns from TASK-2178
- All three affect overlapping files in both portals

### Track B: In-App Ticket Creation (PARALLEL with Track A)

```
TASK-2180 (Desktop: Electron support dialog + diagnostics + screenshot capture)
    |  (independent -- does NOT depend on email tasks)
    |
TASK-2181 (Broker Portal: diagnostics + screenshot paste on existing TicketForm)
    |  (independent -- does NOT depend on email tasks)
```

**TASK-2180 and TASK-2181 are SAFE FOR PARALLEL execution:**
- TASK-2180 modifies Electron-only files (`electron/`, `src/components/support/`)
- TASK-2181 modifies broker-portal-only files (`broker-portal/app/support/`)
- Neither touches admin-portal or email-related files
- No shared file overlap between them

**TASK-2180 and TASK-2181 are ALSO independent of Track A:**
- They use the existing support platform RPCs (BACKLOG-938), not the email service
- They can run in parallel with TASK-2177/2178/2179

### Recommended Execution Order

```
Phase 1:  TASK-2177 (Email Foundation)
          |  [parallel with]
          TASK-2180 (Desktop Support Dialog)  <-- can start immediately
          TASK-2181 (Broker Portal Enhancements)  <-- can start immediately

Phase 2:  TASK-2178 (Invitation Emails)  <-- needs TASK-2177

Phase 3:  TASK-2179 (Support Notifications)  <-- needs TASK-2177
```

**Branch strategy:**
- Track A: Single feature branch `feature/SPRINT-131-email-integration`. TASK-2177/2178/2179 commit sequentially.
- Track B: Separate branches per task:
  - `feature/TASK-2180-desktop-support-dialog`
  - `feature/TASK-2181-broker-ticket-enhancements`
- Each Track B task gets its own PR targeting develop.

---

## Dependency Graph

```
TASK-2177 (Email Service Foundation)
  |-- Creates: resend package install, emailService.ts, BaseLayout.tsx, env var config
  |-- Required by: TASK-2178, TASK-2179
  |
  +-> TASK-2178 (Invitation Emails)
       |-- Creates: InviteUserEmail.tsx, InternalInviteEmail.tsx
       |-- Modifies: broker-portal invite actions, admin-portal invite API routes
       |-- Required by: TASK-2179 (template patterns)
       |
       +-> TASK-2179 (Support Notifications)
            |-- Creates: 6 ticket notification templates, supportNotifications.ts
            |-- Modifies: admin-portal support pages/actions
            |-- Final task in Track A

TASK-2180 (Desktop Support Dialog)  [INDEPENDENT -- no email dependency]
  |-- Creates: supportTicketService.ts, supportBridge.ts, SupportTicketDialog.tsx
  |-- Modifies: preload/index.ts, Settings.tsx
  |-- No dependencies on Track A tasks

TASK-2181 (Broker Portal Enhancements)  [INDEPENDENT -- no email dependency]
  |-- Creates: BrowserDiagnostics.tsx, ScreenshotPaste.tsx
  |-- Modifies: TicketForm.tsx, support-queries.ts (broker-portal only)
  |-- No dependencies on Track A tasks
  |-- No file overlap with TASK-2180
```

### External Dependencies

| Dependency | Owner | Status | Blocking? |
|------------|-------|--------|-----------|
| Resend account + API key | User (Daniel) | Needed before TASK-2177 | Yes (Track A only) |
| Domain verification (SPF/DKIM/DMARC) | User (Daniel) via DNS | Needed before testing | Yes for production |
| `RESEND_API_KEY` in Vercel env vars | User (Daniel) | Needed before deploy | Yes for production |
| Support Platform Phase 1 merged | SPRINT-130 | Merged (v2.9.5) | No |

**STOP-AND-ASK:** Before starting TASK-2177, the user must:
1. Create a Resend account at resend.com
2. Generate an API key
3. Add the verified sender domain (keeprcompliance.com) or use Resend's test domain for development
4. Provide the API key for environment variable setup

**NOTE:** TASK-2180 and TASK-2181 have NO external dependencies and can start immediately.

---

## Pre-Sprint Setup Checklist

- [ ] Resend account created (Track A only)
- [ ] API key generated and added to Vercel env vars (`RESEND_API_KEY`) (Track A only)
- [ ] Sender domain verified (or using Resend test domain for dev) (Track A only)
- [ ] `EMAIL_FROM_ADDRESS` env var set (e.g., `support@keeprcompliance.com`) (Track A only)
- [ ] SPRINT-130 merged to develop (confirmed: v2.9.5, PR #1145)

---

## Quality Gates

| Gate | When | Method | Pass Criteria |
|------|------|--------|---------------|
| Email service smoke test | After TASK-2177 | Send test email via Resend | Email arrives in inbox |
| Type check (both portals) | After each task | `npx tsc --noEmit` | Zero errors |
| Invite email delivery | After TASK-2178 | Invite a test user, verify email received | Email arrives with correct content and working link |
| Support notification delivery | After TASK-2179 | Create ticket, reply, resolve -- verify emails | All 6 notification types deliver correctly |
| Graceful degradation | After TASK-2179 | Set invalid API key, perform actions | Actions succeed, emails fail silently with logging |
| Desktop ticket creation | After TASK-2180 | Create ticket from Settings -> Contact Support | Ticket appears in admin portal with diagnostics attachment |
| Desktop screenshot capture | After TASK-2180 | Capture screenshot in dialog | Screenshot preview shows and attaches to ticket |
| Broker portal diagnostics | After TASK-2181 | Submit ticket from broker portal | browser-diagnostics.json attachment present |
| Broker portal screenshot paste | After TASK-2181 | Paste screenshot from clipboard | Image attaches to ticket |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Resend API key not available at sprint start | Blocks Track A (not Track B) | Medium | Use Resend test domain for development; start Track B tasks immediately |
| Domain verification delays (DNS propagation) | Blocks production email | Low | Can develop against test domain; DNS usually propagates in <1 hour |
| Email deliverability (spam folder) | Medium | Low | Resend handles SPF/DKIM/DMARC automatically for verified domains |
| Token overrun on TASK-2179 (6 templates + integration) | Medium | Medium | Templates follow consistent pattern; notification service is straightforward typed functions |
| Support notification missing an edge case | Low | Medium | Fire-and-forget pattern means ticket actions always succeed; missed notification is non-critical |
| macOS screen recording permission for desktopCapturer | Medium | Low | `desktopCapturer` thumbnails may not require permission; if they do, handle gracefully with "permission needed" message |
| Supabase RPC access from Electron renderer | Medium | Medium | Existing `supabaseService` should handle this; if not, use IPC to call from main process |
| Token overrun on TASK-2180 (Electron IPC + UI + diagnostics) | Medium | Medium | IPC tasks historically underestimated by 1.5x; cap set at 300K |

---

## Testing Plan

| Surface | Strategy | Owner |
|---------|----------|-------|
| Email service module | Unit test with mocked Resend client | Engineer |
| Email templates | Visual verification (send to test inbox) | User (post-PR) |
| Invite email integration | End-to-end: invite user -> verify email arrives -> click link -> accept | User (post-PR) |
| Support notifications | End-to-end: create ticket -> reply -> resolve -> verify emails at each step | User (post-PR) |
| Graceful degradation | Set bad API key, verify actions succeed without email | Engineer |
| Type safety | `npx tsc --noEmit` on both portals | Engineer |
| Desktop support dialog | Unit test diagnostics service; manual: open dialog, capture screenshot, submit | Engineer + User |
| Broker portal diagnostics | Unit test hook; manual: paste screenshot, verify attachment | Engineer + User |
| Diagnostics PII safety | Review sanitization output for tokens/paths/PII | SR Engineer |

---

## Sprint Retrospective

*To be completed after sprint close.*

### Estimation Accuracy

| Task | Est. Tokens | Actual Tokens | Variance |
|------|-------------|---------------|----------|
| TASK-2177 | ~40K | - | - |
| TASK-2178 | ~45K | - | - |
| TASK-2179 | ~60K | - | - |
| TASK-2180 | ~75K | - | - |
| TASK-2181 | ~30K | - | - |
| **Total** | **~250K** | - | - |

### Issues Summary

*Aggregated from task handoffs after completion.*

### What Went Well

*TBD*

### What Didn't Go Well

*TBD*

### Lessons Learned

*TBD*
