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

Create a shared email service module in `broker-portal/lib/email/` that wraps the Microsoft Graph API (using app-only client credentials flow), provides typed send functions for each email type (invite, ticket notification), includes branded HTML email templates with plain-text fallbacks, and handles errors gracefully. This is the foundation all outbound email flows will use.

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
2. New file: `broker-portal/lib/email/graph-client.ts` -- Microsoft Graph API client with client credentials auth
3. New file: `broker-portal/lib/email/send-email.ts` -- generic send function with error handling
4. New file: `broker-portal/lib/email/templates/invite.ts` -- invite email template (HTML + plain text)
5. New file: `broker-portal/lib/email/templates/ticket-reply-notification.ts` -- ticket reply notification template
6. New file: `broker-portal/lib/email/templates/ticket-assignment-notification.ts` -- ticket assignment notification template
7. New file: `broker-portal/lib/email/templates/base-layout.ts` -- shared HTML wrapper (header, footer, styles)
8. New file: `broker-portal/lib/email/types.ts` -- TypeScript types for email payloads
9. New dependencies: `@microsoft/microsoft-graph-client` and `@azure/identity` packages added to `broker-portal/package.json`
10. New file: `broker-portal/__tests__/lib/email/send-email.test.ts` -- unit tests

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/package.json` -- add `@microsoft/microsoft-graph-client` and `@azure/identity` dependencies
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

- [ ] `@microsoft/microsoft-graph-client` and `@azure/identity` packages installed in broker-portal
- [ ] `broker-portal/lib/email/graph-client.ts` exports a configured Graph API client that uses `ClientSecretCredential` from `@azure/identity` with `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` from `process.env`
- [ ] `broker-portal/lib/email/send-email.ts` exports a `sendEmail()` function that accepts `{ to, subject, html, text }` and returns `{ success: boolean; messageId?: string; error?: string }`
- [ ] `sendEmail()` uses `POST /users/{senderAddress}/sendMail` Graph API endpoint
- [ ] `sendEmail()` gracefully handles missing env vars (returns error, does not throw)
- [ ] `sendEmail()` gracefully handles Graph API errors (catches, logs, returns error object)
- [ ] Invite template generates HTML with: org name, inviter name, role, invite link (as CTA button), expiry notice (7 days), plain-text fallback
- [ ] Ticket reply notification template generates HTML with: ticket subject, ticket number, agent name (or "Support Team"), reply preview (first 200 chars), link to view ticket, plain-text fallback
- [ ] Ticket assignment notification template generates HTML with: ticket subject, ticket number, customer name, priority, link to ticket in admin portal, plain-text fallback
- [ ] Base layout template provides consistent branding: Keepr logo area, footer with company info, responsive styling
- [ ] All templates use inline CSS (not external stylesheets) for email client compatibility
- [ ] Types file exports interfaces for all email payload types
- [ ] `index.ts` re-exports: `sendEmail`, `sendInviteEmail`, `sendTicketReplyNotification`, `sendTicketAssignmentNotification`
- [ ] Convenience functions (`sendInviteEmail`, etc.) compose template + `sendEmail` call
- [ ] Unit tests verify: successful send (mocked), API error handling, missing env vars handling, template generation
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### Microsoft Graph API Client Setup

```typescript
// broker-portal/lib/email/graph-client.ts
import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

let graphClient: Client | null = null;

export function getGraphClient(): Client | null {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn('[Email] Azure credentials not configured -- emails will not be sent');
    return null;
  }

  if (!graphClient) {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    graphClient = Client.initWithMiddleware({ authProvider });
  }

  return graphClient;
}
```

### Generic Send Function

```typescript
// broker-portal/lib/email/send-email.ts
import { getGraphClient } from './graph-client';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string; // defaults to EMAIL_SENDER_ADDRESS env var
  replyTo?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getGraphClient();
  if (!client) {
    return { success: false, error: 'Email service not configured (missing Azure credentials)' };
  }

  const senderAddress = params.from || process.env.EMAIL_SENDER_ADDRESS;
  if (!senderAddress) {
    return { success: false, error: 'Email service not configured (missing EMAIL_SENDER_ADDRESS)' };
  }

  const toRecipients = (Array.isArray(params.to) ? params.to : [params.to]).map(
    (address) => ({ emailAddress: { address } })
  );

  try {
    await client.api(`/users/${senderAddress}/sendMail`).post({
      message: {
        subject: params.subject,
        body: {
          contentType: 'HTML',
          content: params.html,
        },
        toRecipients,
        ...(params.replyTo
          ? { replyTo: [{ emailAddress: { address: params.replyTo } }] }
          : {}),
      },
    });

    return { success: true };
  } catch (err) {
    console.error('[Email] Graph API error sending email:', err);
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

- The sender address is read from `EMAIL_SENDER_ADDRESS` env var (e.g., `noreply@keeprcompliance.com`)
- The Azure app registration must have `Mail.Send` application permission (not delegated) with admin consent
- App-only auth uses client credentials flow -- no user interaction needed for server-side sending
- The Graph API endpoint is `POST /users/{senderAddress}/sendMail` -- the sender must be a valid mailbox or shared mailbox in the M365 tenant
- All CSS must be inline (Gmail, Outlook strip `<style>` tags)
- Use table-based layout for email client compatibility (not flexbox/grid)
- Template functions are pure (no side effects, no async) -- only the send function is async
- Keep templates simple -- no complex Tailwind or component libraries
- Graph API `sendMail` does not return a message ID in the response body (unlike Resend); `messageId` in the result will be undefined on success. Success is indicated by a 202 Accepted status (no error thrown).

## Integration Notes

- Imports from: `@microsoft/microsoft-graph-client`, `@azure/identity` npm packages
- Exports to: `broker-portal/lib/email/index.ts` (used by TASK-2198 and TASK-2199)
- Used by: TASK-2198 (invite emails), TASK-2199 (ticket notification emails)
- Depends on: Nothing -- this is the foundation task

## Do / Don't

### Do:

- Use Microsoft Graph API with client credentials flow (`ClientSecretCredential` from `@azure/identity`)
- Use `POST /users/{senderAddress}/sendMail` endpoint for sending
- Return structured results (`{ success, messageId, error }`) -- never throw
- Log all errors with `[Email]` prefix for easy filtering
- Use inline CSS in all HTML templates
- Include plain-text fallback for every template
- Make the sender address configurable via `EMAIL_SENDER_ADDRESS` env var
- Use TypeScript strict types for all template params
- Abstract the provider behind `sendEmail()` so it could be swapped later

### Don't:

- Don't throw errors from `sendEmail()` -- always return a result object
- Don't hardcode Azure credentials -- always read from `process.env`
- Don't use external CSS or `<style>` tags in email HTML
- Don't use flexbox, grid, or modern CSS in email templates
- Don't import from any existing broker-portal files (this module should be self-contained)
- Don't add Graph API email packages to admin-portal -- only broker-portal
- Don't add logging with PII (email addresses) -- mask or omit recipient details in logs
- Don't use delegated auth / user tokens -- use app-only client credentials

## When to Stop and Ask

- If `@microsoft/microsoft-graph-client` or `@azure/identity` have breaking API changes from what is documented here
- If `npm run build` fails due to Graph SDK being server-only and imported in client components
- If you discover the `broker-portal/lib/email/` directory already exists
- If you need to modify any file outside `broker-portal/lib/email/` and `broker-portal/package.json`
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `broker-portal/__tests__/lib/email/send-email.test.ts`:
    - Test `sendEmail` success path with mocked Graph client
    - Test `sendEmail` when Graph API returns error
    - Test `sendEmail` when Azure credentials are missing (returns graceful error, no throw)
    - Test `sendEmail` when `EMAIL_SENDER_ADDRESS` is missing (returns graceful error, no throw)
    - Test `sendEmail` when Graph client throws unexpected error
  - Template tests (can be in same file or separate):
    - Test `buildInviteEmail` returns valid HTML with all params interpolated
    - Test `buildTicketReplyNotification` returns valid HTML with all params
    - Test `buildTicketAssignmentNotification` returns valid HTML with all params
    - Test plain-text fallbacks contain essential content

### Coverage

- Coverage impact: New module, establishes baseline coverage for `lib/email/`

### Integration / Feature Tests

- Manual test with Graph API after app registration is configured (PM will set up after merge)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(email): add email service infrastructure with Microsoft Graph API and templates`
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
| Test complexity | Medium (mocking Graph API client) | +2K |

**Confidence:** High

**Risk factors:**
- Graph API client setup with client credentials may require additional configuration (TokenCredentialAuthenticationProvider)
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
- [ ] broker-portal/lib/email/graph-client.ts
- [ ] broker-portal/lib/email/send-email.ts
- [ ] broker-portal/lib/email/types.ts
- [ ] broker-portal/lib/email/templates/base-layout.ts
- [ ] broker-portal/lib/email/templates/invite.ts
- [ ] broker-portal/lib/email/templates/ticket-reply-notification.ts
- [ ] broker-portal/lib/email/templates/ticket-assignment-notification.ts
- [ ] broker-portal/__tests__/lib/email/send-email.test.ts

Features implemented:
- [ ] Graph API client with client credentials auth
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
