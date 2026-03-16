# BACKLOG-941: Transactional Email Service Layer (Resend)

**Priority:** High
**Type:** Feature
**Area:** Service
**Status:** Pending
**Created:** 2026-03-13

---

## Summary

Set up Resend as the transactional email provider and build a shared email service module that all outbound email flows (invitations, support notifications, account alerts) can use. This is the foundational layer -- no email triggers or templates are included here, just the plumbing.

---

## Context

The codebase currently has zero email-sending capability. Two systems already need it:

1. **Org user invitations** (broker portal) -- admin invites a user, generates a token link, but must manually copy/paste it. No email is sent.
2. **Internal user invitations** (admin portal) -- same pattern, no email sent.
3. **Support ticket notifications** -- Phase 1 just shipped (BACKLOG-938) with full ticketing but no email notifications. Requirements explicitly called this out as Phase 3.

BACKLOG-746 originally scoped this work. This item supersedes BACKLOG-746 with a narrower, implementation-ready scope.

---

## Why Resend

| Factor | Resend | SendGrid | Postmark |
|--------|--------|----------|----------|
| API simplicity | Excellent (1 SDK call) | Moderate | Good |
| Free tier | 3K emails/month | 100/day | 100/month |
| Next.js integration | First-class (same company as Vercel) | SDK available | SDK available |
| React Email templates | Native support | No | No |
| Deliverability | Good (shared IPs + dedicated available) | Good | Excellent |
| Cost at scale | $20/mo for 50K | $20/mo for 50K | $15/mo for 10K |

Resend wins on developer experience and the React Email template system, which lets us write email templates as React components -- matching our existing stack.

---

## Requirements

### 1. Provider Setup
- Install `resend` npm package in admin-portal and broker-portal
- Install `@react-email/components` for template authoring
- API key stored as `RESEND_API_KEY` environment variable (Vercel env vars)
- Verified sender domain: `keeprcompliance.com` with SPF, DKIM, DMARC
- From address: `Keepr Support <support@keeprcompliance.com>` (configurable)

### 2. Shared Email Service Module
- Create `lib/email/emailService.ts` in each portal (or a shared package)
- Single `sendEmail()` function that wraps the Resend API
- Typed interface for all email sends:
  ```typescript
  interface SendEmailParams {
    to: string | string[];
    subject: string;
    template: React.ReactElement; // React Email component
    replyTo?: string;
    tags?: { name: string; value: string }[];
  }
  ```
- Error handling: retry on transient 5xx, surface 4xx to caller
- Logging: all sends logged (recipient masked, template name, status, timestamp)
- Audit trail: insert into `audit_logs` table for compliance

### 3. Shared Email Layout
- Create a base email layout component with Keepr branding:
  - Logo header
  - Content slot
  - Footer with company info, unsubscribe placeholder
  - Responsive design (mobile-friendly)
  - Dark mode support (optional, nice-to-have)

### 4. Environment Configuration
- `RESEND_API_KEY` -- Resend API key
- `EMAIL_FROM_ADDRESS` -- default from address (fallback: `support@keeprcompliance.com`)
- `EMAIL_FROM_NAME` -- default from name (fallback: `Keepr`)
- `NEXT_PUBLIC_APP_URL` -- already exists, used for link generation

---

## Acceptance Criteria

- [ ] `resend` and `@react-email/components` installed in both portals
- [ ] `sendEmail()` function works end-to-end (send a test email)
- [ ] Base email layout component renders correctly
- [ ] API key stored in environment variable, not in code
- [ ] Sender domain verified with SPF/DKIM/DMARC
- [ ] Error handling for transient failures (retry) and permanent failures (surface)
- [ ] All sends logged to audit trail

---

## Dependencies

- None (this is foundational)

## Supersedes

- BACKLOG-746 (Email Server Integration for Outbound Communications) -- narrower scope, implementation-ready

## Estimated Effort

~40K tokens (provider setup + service module + base layout + configuration)
