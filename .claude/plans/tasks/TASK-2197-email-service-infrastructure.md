# Task TASK-2197: Email Service Infrastructure + Templates

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Create a shared email service module in `broker-portal/lib/email/` that wraps the Resend SDK, provides typed send functions for each email type (invite, ticket notification), includes branded HTML email templates with plain-text fallbacks, and handles errors gracefully. This is the foundation all outbound email flows will use.

## Non-Goals

- Do NOT implement the invite flow wiring (that is TASK-2198)
- Do NOT implement the support ticket notification wiring (that is TASK-2199)
- Do NOT set up inbound email parsing (Sprint B scope)
- Do NOT implement rate limiting (deferred)
- Do NOT configure SPF/DKIM/DMARC (ops task, not code)
- Do NOT modify any existing files -- this task only creates new files
- Do NOT add email sending to Supabase Edge Functions -- keep it in broker-portal

## Deliverables

1. New file: `broker-portal/lib/email/index.ts` -- main exports
2. New file: `broker-portal/lib/email/resend-client.ts` -- Resend SDK client singleton
3. New file: `broker-portal/lib/email/send-email.ts` -- generic send function with error handling
4. New file: `broker-portal/lib/email/templates/invite.ts` -- invite email template (HTML + plain text)
5. New file: `broker-portal/lib/email/templates/ticket-reply-notification.ts` -- ticket reply notification template
6. New file: `broker-portal/lib/email/templates/ticket-assignment-notification.ts` -- ticket assignment notification template
7. New file: `broker-portal/lib/email/templates/base-layout.ts` -- shared HTML wrapper (header, footer, styles)
8. New file: `broker-portal/lib/email/types.ts` -- TypeScript types for email payloads
9. New dependency: `resend` package added to `broker-portal/package.json`
10. New file: `broker-portal/__tests__/lib/email/send-email.test.ts` -- unit tests

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/package.json` -- add `resend` dependency
- All new files listed in Deliverables (all under `broker-portal/lib/email/`)

### Files this task must NOT modify:

- `broker-portal/lib/actions/inviteUser.ts` -- owned by TASK-2198
- `broker-portal/components/users/InviteUserModal.tsx` -- owned by TASK-2198
- `broker-portal/lib/support-queries.ts` -- owned by TASK-2199
- Any admin-portal files
- Any Electron app files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `resend` package installed in broker-portal (`npm install resend`)
- [ ] `broker-portal/lib/email/resend-client.ts` exports a configured Resend client that reads `RESEND_API_KEY` from `process.env`
- [ ] `broker-portal/lib/email/send-email.ts` exports a `sendEmail()` function that accepts `{ to, subject, html, text }` and returns `{ success: boolean; messageId?: string; error?: string }`
- [ ] `sendEmail()` gracefully handles missing API key (returns error, does not throw)
- [ ] `sendEmail()` gracefully handles Resend API errors (catches, logs, returns error object)
- [ ] Invite template generates HTML with: org name, inviter name, role, invite link (as CTA button), expiry notice (7 days), plain-text fallback
- [ ] Ticket reply notification template generates HTML with: ticket subject, ticket number, agent name (or "Support Team"), reply preview (first 200 chars), link to view ticket, plain-text fallback
- [ ] Ticket assignment notification template generates HTML with: ticket subject, ticket number, customer name, priority, link to ticket in admin portal, plain-text fallback
- [ ] Base layout template provides consistent branding: Keepr logo area, footer with company info, responsive styling
- [ ] All templates use inline CSS (not external stylesheets) for email client compatibility
- [ ] Types file exports interfaces for all email payload types
- [ ] `index.ts` re-exports: `sendEmail`, `sendInviteEmail`, `sendTicketReplyNotification`, `sendTicketAssignmentNotification`
- [ ] Convenience functions (`sendInviteEmail`, etc.) compose template + `sendEmail` call
- [ ] Unit tests verify: successful send (mocked), API error handling, missing API key handling, template generation
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### Resend SDK Setup

```typescript
// broker-portal/lib/email/resend-client.ts
import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured -- emails will not be sent');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}
```

### Generic Send Function

```typescript
// broker-portal/lib/email/send-email.ts
import { getResendClient } from './resend-client';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string; // defaults to configured sender
  replyTo?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const DEFAULT_FROM = 'Keepr <no-reply@keeprcompliance.com>';

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    return { success: false, error: 'Email service not configured (missing RESEND_API_KEY)' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: params.from || DEFAULT_FROM,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    });

    if (error) {
      console.error('[Email] Resend API error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('[Email] Unexpected error sending email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}
```

### Template Pattern

Each template file exports a function that takes typed params and returns `{ subject, html, text }`:

```typescript
// broker-portal/lib/email/templates/invite.ts
import { baseLayout } from './base-layout';

interface InviteEmailParams {
  recipientEmail: string;
  organizationName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  expiresInDays: number;
}

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildInviteEmail(params: InviteEmailParams): EmailContent {
  const subject = `You've been invited to join ${params.organizationName} on Keepr`;

  const html = baseLayout({
    preheader: `${params.inviterName} invited you to join ${params.organizationName}`,
    body: `
      <h1 style="...">You're Invited!</h1>
      <p>${params.inviterName} has invited you to join
         <strong>${params.organizationName}</strong> as a
         <strong>${params.role}</strong>.</p>
      <a href="${params.inviteLink}" style="...CTA button styles...">
        Accept Invitation
      </a>
      <p style="...">This invitation expires in ${params.expiresInDays} days.</p>
    `,
  });

  const text = [
    `You've been invited to join ${params.organizationName} on Keepr`,
    '',
    `${params.inviterName} has invited you to join ${params.organizationName} as a ${params.role}.`,
    '',
    `Accept your invitation: ${params.inviteLink}`,
    '',
    `This invitation expires in ${params.expiresInDays} days.`,
  ].join('\n');

  return { subject, html, text };
}
```

### Base Layout Pattern

```typescript
// broker-portal/lib/email/templates/base-layout.ts
interface LayoutParams {
  preheader: string;
  body: string;
}

export function baseLayout({ preheader, body }: LayoutParams): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Keepr</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial,sans-serif;">
  <!-- Preheader text (hidden) -->
  <div style="display:none; max-height:0; overflow:hidden;">
    ${preheader}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px; background-color:#4f46e5;">
              <h2 style="margin:0; color:#ffffff; font-size:20px;">Keepr</h2>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:12px; color:#6b7280;">
                Keepr Compliance | Real Estate Transaction Auditing
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

### Convenience Functions

```typescript
// broker-portal/lib/email/index.ts
export { sendEmail } from './send-email';
export { buildInviteEmail } from './templates/invite';
export { buildTicketReplyNotification } from './templates/ticket-reply-notification';
export { buildTicketAssignmentNotification } from './templates/ticket-assignment-notification';
export type { SendEmailResult } from './send-email';

// Convenience wrappers that compose template + send
import { sendEmail } from './send-email';
import { buildInviteEmail } from './templates/invite';
// ... etc

export async function sendInviteEmail(params: InviteEmailParams) {
  const { subject, html, text } = buildInviteEmail(params);
  return sendEmail({ to: params.recipientEmail, subject, html, text });
}

// Similar for sendTicketReplyNotification, sendTicketAssignmentNotification
```

### Important Details

- The `from` address should be `Keepr <no-reply@keeprcompliance.com>` -- match the existing `NEXT_PUBLIC_APP_URL` domain
- All CSS must be inline (Gmail, Outlook strip `<style>` tags)
- Use table-based layout for email client compatibility (not flexbox/grid)
- Template functions are pure (no side effects, no async) -- only the send function is async
- Keep templates simple -- no complex Tailwind or component libraries

## Integration Notes

- Imports from: `resend` npm package
- Exports to: `broker-portal/lib/email/index.ts` (used by TASK-2198 and TASK-2199)
- Used by: TASK-2198 (invite emails), TASK-2199 (ticket notification emails)
- Depends on: Nothing -- this is the foundation task

## Do / Don't

### Do:

- Use the Resend SDK v2+ API (`resend.emails.send()`)
- Return structured results (`{ success, messageId, error }`) -- never throw
- Log all errors with `[Email]` prefix for easy filtering
- Use inline CSS in all HTML templates
- Include plain-text fallback for every template
- Make the sender address configurable via `DEFAULT_FROM` constant
- Use TypeScript strict types for all template params

### Don't:

- Don't throw errors from `sendEmail()` -- always return a result object
- Don't hardcode the API key -- always read from `process.env.RESEND_API_KEY`
- Don't use external CSS or `<style>` tags in email HTML
- Don't use flexbox, grid, or modern CSS in email templates
- Don't import from any existing broker-portal files (this module should be self-contained)
- Don't add Resend to admin-portal -- only broker-portal
- Don't add logging with PII (email addresses) -- mask or omit recipient details in logs

## When to Stop and Ask

- If the `resend` package has breaking API changes from what is documented here
- If `npm run build` fails due to Resend SDK being server-only and imported in client components
- If you discover the `broker-portal/lib/email/` directory already exists
- If you need to modify any file outside `broker-portal/lib/email/` and `broker-portal/package.json`
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `broker-portal/__tests__/lib/email/send-email.test.ts`:
    - Test `sendEmail` success path with mocked Resend client
    - Test `sendEmail` when API returns error
    - Test `sendEmail` when API key is missing (returns graceful error, no throw)
    - Test `sendEmail` when Resend throws unexpected error
  - Template tests (can be in same file or separate):
    - Test `buildInviteEmail` returns valid HTML with all params interpolated
    - Test `buildTicketReplyNotification` returns valid HTML with all params
    - Test `buildTicketAssignmentNotification` returns valid HTML with all params
    - Test plain-text fallbacks contain essential content

### Coverage

- Coverage impact: New module, establishes baseline coverage for `lib/email/`

### Integration / Feature Tests

- Manual test with Resend test API key (PM will provide after merge)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(email): add email service infrastructure with Resend and templates`
- **Labels**: `feature`, `email`, `broker-portal`
- **Depends on**: None (foundation task)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 9 new files | +8K |
| Files to modify | 1 file (package.json) | +1K |
| Code volume | ~400 lines (service + templates + types) | +4K |
| Test complexity | Medium (mocking Resend SDK) | +2K |

**Confidence:** High

**Risk factors:**
- Resend SDK API might differ slightly from documented examples
- Template HTML could need iteration for email client compatibility (but that is cosmetic, not blocking)

**Similar past tasks:** Service module creation tasks typically run 0.5x estimate per service multiplier. Adjusting up slightly because templates add volume.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] broker-portal/lib/email/index.ts
- [ ] broker-portal/lib/email/resend-client.ts
- [ ] broker-portal/lib/email/send-email.ts
- [ ] broker-portal/lib/email/types.ts
- [ ] broker-portal/lib/email/templates/base-layout.ts
- [ ] broker-portal/lib/email/templates/invite.ts
- [ ] broker-portal/lib/email/templates/ticket-reply-notification.ts
- [ ] broker-portal/lib/email/templates/ticket-assignment-notification.ts
- [ ] broker-portal/__tests__/lib/email/send-email.test.ts

Features implemented:
- [ ] Resend client singleton with env var config
- [ ] Generic sendEmail function with error handling
- [ ] Invite email template (HTML + plain text)
- [ ] Ticket reply notification template (HTML + plain text)
- [ ] Ticket assignment notification template (HTML + plain text)
- [ ] Base layout template with Keepr branding
- [ ] Convenience wrapper functions (sendInviteEmail, etc.)
- [ ] TypeScript types for all email payloads

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] npm run build passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
