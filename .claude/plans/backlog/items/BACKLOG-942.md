# BACKLOG-942: Invitation Email Delivery (Org + Internal Users)

**Priority:** High
**Type:** Feature
**Area:** Service
**Status:** Pending
**Created:** 2026-03-13

---

## Summary

Wire up email delivery to both existing invitation flows -- org user invitations (broker portal) and internal user invitations (admin portal). Currently both flows generate invite tokens and links but require manual copy/paste. This adds automatic email delivery using the Resend service from BACKLOG-941.

---

## Current State

### Org User Invitations (Broker Portal)
- **Flow:** Admin clicks "Invite User" -> enters email + role -> `inviteUser()` server action creates `organization_members` record with `invitation_token` + `invitation_expires_at` -> returns `inviteLink` string -> **admin must copy link and send manually**
- **Files:** `broker-portal/lib/actions/inviteUser.ts`, `broker-portal/app/invite/[token]/page.tsx`
- **Accept flow:** Recipient visits link -> validates token -> signs in with Google/Microsoft -> auth callback claims the invite

### Internal User Invitations (Admin Portal)
- **Flow:** Admin clicks "Add Internal User" -> enters email + role -> `POST /api/internal-users/invite` -> if user exists, assigns role directly; if not, creates `pending_internal_invitations` record -> **returns success message, no email sent**
- **Files:** `admin-portal/app/api/internal-users/invite/route.ts`
- **Accept flow:** User logs in normally -> auth callback checks `pending_internal_invitations` -> auto-assigns role

---

## Requirements

### 1. Org Invitation Email Template
- React Email template: `InviteUserEmail`
- Content:
  - Greeting: "You've been invited to join {orgName} on Keepr"
  - Invited by: "{inviterName} ({inviterEmail})"
  - Role: "{role}"
  - CTA button: "Accept Invitation" -> invite link
  - Expiry notice: "This invitation expires in 7 days"
  - Footer: "If you didn't expect this invitation, you can ignore this email."

### 2. Internal User Invitation Email Template
- React Email template: `InternalInviteEmail`
- Content:
  - Greeting: "You've been invited to the Keepr Admin Portal"
  - Invited by: "{inviterName}"
  - Role: "{roleName}"
  - CTA button: "Sign In to Accept" -> admin portal login URL
  - Note: "Your role will be assigned automatically when you sign in."
  - Footer: standard

### 3. Integration Points

#### Broker Portal (`inviteUser.ts`)
- After successful `organization_members` insert, call `sendEmail()` with the `InviteUserEmail` template
- Pass: `to: normalizedEmail`, `orgName`, `inviterName`, `role`, `inviteLink`
- If email send fails: still return success (invite record exists), but include `emailSent: false` in response
- Add `emailSent` field to `InviteUserResult`

#### Admin Portal (`/api/internal-users/invite/route.ts`)
- After successful `pending_internal_invitations` insert (Case B), call `sendEmail()` with `InternalInviteEmail`
- Pass: `to: email`, `inviterName`, `roleName`, admin portal URL
- If email send fails: still return success, add `emailSent: false` to response

### 4. Resend Invite
- Both portals: add a "Resend Invitation" button/action for pending invitations
- Rate limit: max 3 resends per invitation per 24 hours
- Log each resend in audit trail

---

## Acceptance Criteria

- [ ] Org user invitation sends email automatically on invite creation
- [ ] Internal user invitation sends email automatically on invite creation
- [ ] Email includes correct org name, inviter, role, and CTA link
- [ ] Email delivery failure does not block the invitation (graceful degradation)
- [ ] Resend invitation action works with rate limiting
- [ ] Audit log captures all email send attempts
- [ ] Existing invite acceptance flow unchanged (token validation, OAuth, role assignment)

---

## Dependencies

- BACKLOG-941 (Transactional Email Service Layer) -- must be completed first

## Estimated Effort

~45K tokens (2 email templates + integration into 2 existing flows + resend action + rate limiting)
