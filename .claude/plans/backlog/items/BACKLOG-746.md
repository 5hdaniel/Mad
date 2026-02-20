# BACKLOG-746: Email Server Integration for Outbound Communications

**Priority:** High
**Type:** Feature
**Area:** Service
**Status:** Pending

## Description

The system currently has no mechanism for sending outbound emails. As user management, onboarding, and account workflows grow, the app needs a reliable way to deliver transactional emails — user invitations, account verification, password resets, and other account-related notifications.

This item covers selecting and integrating an email sending infrastructure (SMTP relay or transactional email service such as Resend, SendGrid, Postmark, or AWS SES) and building the email service layer that all outbound email flows can use.

## Problem

- User invites (BACKLOG-070 enterprise user management) currently have no email delivery mechanism
- Account-related communications (password reset links, verification emails, onboarding welcome messages) must be sent reliably and at scale
- No shared email service means each feature that needs to send an email would implement its own ad-hoc solution

## Requirements

### Infrastructure / Transport Layer
- Select and configure a transactional email provider (Resend recommended — simple API, developer-friendly, good deliverability, generous free tier)
- Alternatively support SMTP relay configuration for self-hosted or enterprise deployments
- API key / credentials stored as environment variables, never hardcoded
- Sender domain configured with SPF, DKIM, and DMARC records for deliverability
- "From" address configurable (e.g., `no-reply@magicaudit.com`)

### Email Service Module
- Create a shared `emailSenderService` (or equivalent) that abstracts the provider
- Supports: `sendUserInvite()`, `sendPasswordReset()`, `sendAccountVerification()`, `sendAccountNotification()`
- Template system: HTML templates with plain-text fallbacks
- Delivery error handling: retry on transient failures, surface permanent failures to caller
- Logging: all sends logged with recipient (hashed/masked), template name, timestamp, delivery status

### User Invite Flow (Primary Use Case)
- When an admin invites a new user, send an invite email with a time-limited token link
- Link format: `https://<portal-domain>/accept-invite?token=<JWT>`
- Token expires in 48 hours
- Resend invite option in admin UI if original expires
- Invite email includes: inviting org name, inviter name, expiry notice, and call-to-action button

### Account-Related Emails (Secondary Use Cases)
- **Password reset**: link with 1-hour expiry, single-use
- **Email verification**: sent on new account creation, link confirms ownership
- **Account notification**: generic template for security events (new login from unknown device, role change, org membership change)

### Rate Limiting and Abuse Prevention
- Do not allow sending to unverified domains (block obviously invalid addresses)
- Rate-limit invite sends per admin per hour
- Log all outbound sends for SOC 2 audit trail (`audit_logs` table)

## Architecture Notes

- Service lives in the backend (Supabase Edge Function or Next.js API route for broker portal)
- Desktop Electron app does NOT send emails directly — it triggers backend endpoints
- Templates stored as string constants or separate `.html` files bundled with the service
- Provider abstraction interface allows swapping providers without changing call sites

## Acceptance Criteria

- [ ] Transactional email provider configured with verified sender domain
- [ ] `emailSenderService` module created with typed send methods
- [ ] User invite email delivered within 30 seconds of invite action
- [ ] Invite link is time-limited (48h) and single-use
- [ ] Password reset email delivered with 1-hour expiry link
- [ ] All sends logged to `audit_logs` with masked recipient
- [ ] HTML templates with plain-text fallbacks
- [ ] Provider API key stored in environment variables (not in code)
- [ ] Rate limiting applied to admin invite sends
- [ ] Unit tests for service methods with mocked provider

## Dependencies

- BACKLOG-070: Enterprise User Management (primary consumer of invite emails)
- BACKLOG-621: Domain Claim & User Capture (invite flows for domain-captured users)

## Estimated Effort

~60K tokens (new service layer + provider integration + templates + tests)

## References

- [Resend](https://resend.com) — recommended provider
- [Postmark](https://postmarkapp.com) — alternative
- [RFC 5321 SMTP](https://tools.ietf.org/html/rfc5321)
- [SPF/DKIM/DMARC setup guide](https://resend.com/docs/dashboard/domains/introduction)
