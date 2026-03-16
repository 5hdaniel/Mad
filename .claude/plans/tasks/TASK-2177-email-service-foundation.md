# Task TASK-2177: Email Service Foundation (Resend + Base Layout)

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

Set up Resend as the transactional email provider for both admin-portal and broker-portal. Create a shared `sendEmail()` service module and a branded base email layout component using React Email. After this task, any portal can send emails by calling `sendEmail()` with a React Email template.

## Non-Goals

- Do NOT create any specific email templates (invitation, support, etc.) -- those are TASK-2178 and TASK-2179
- Do NOT integrate with any existing flows (invite buttons, ticket creation, etc.)
- Do NOT set up email-to-ticket inbound parsing
- Do NOT add notification preferences or unsubscribe management
- Do NOT configure production DNS (SPF/DKIM/DMARC) -- that is a manual user step

## Deliverables

1. New file: `admin-portal/lib/email/emailService.ts` -- shared `sendEmail()` wrapper
2. New file: `admin-portal/lib/email/templates/BaseLayout.tsx` -- branded email layout (React Email)
3. New file: `broker-portal/lib/email/emailService.ts` -- same service for broker portal
4. New file: `broker-portal/lib/email/templates/BaseLayout.tsx` -- same layout for broker portal
5. Update: `admin-portal/package.json` -- add `resend` and `@react-email/components` packages
6. Update: `broker-portal/package.json` -- add `resend` and `@react-email/components` packages
7. New file: `admin-portal/lib/email/__tests__/emailService.test.ts` -- unit tests with mocked Resend

## File Boundaries

N/A -- sequential execution. This is the first task in the sprint.

## Acceptance Criteria

- [ ] `resend` npm package installed in both admin-portal and broker-portal
- [ ] `@react-email/components` installed in both portals
- [ ] `sendEmail()` function exported from `lib/email/emailService.ts` in both portals
- [ ] `sendEmail()` accepts a React Email component and recipient(s), calls Resend API
- [ ] `sendEmail()` handles errors gracefully (logs error, does NOT throw -- fire-and-forget pattern)
- [ ] `sendEmail()` returns `{ success: boolean; messageId?: string; error?: string }`
- [ ] `BaseLayout.tsx` renders branded email with Keepr logo, header, footer, and "Do not reply" notice
- [ ] `BaseLayout.tsx` accepts `children` prop for template content
- [ ] Environment variable `RESEND_API_KEY` is read from `process.env`
- [ ] Environment variable `EMAIL_FROM_ADDRESS` is read from `process.env` with fallback to `support@keeprcompliance.com`
- [ ] Unit tests pass with mocked Resend client
- [ ] `npx tsc --noEmit` passes in both admin-portal and broker-portal
- [ ] All CI checks pass

## Implementation Notes

### Email Service (`emailService.ts`)

```typescript
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string | string[];
  subject: string;
  template: ReactElement;
  replyTo?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[Email] RESEND_API_KEY not configured, skipping email send');
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'support@keeprcompliance.com';

    const { data, error } = await resend.emails.send({
      from: `Keepr Support <${fromAddress}>`,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      react: params.template,
      replyTo: params.replyTo,
    });

    if (error) {
      console.error('[Email] Send failed:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

### Base Layout (`BaseLayout.tsx`)

Use React Email components:

```typescript
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={header}>
            <Img
              src="https://keeprcompliance.com/logo.png"
              width="120"
              height="40"
              alt="Keepr"
            />
          </Section>

          {/* Content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated message from Keepr. Please do not reply to this email.
            </Text>
            <Text style={footerText}>
              Keepr Compliance | keeprcompliance.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Key Patterns

- **Fire-and-forget**: `sendEmail()` never throws. Callers use `void sendEmail(...)` when they don't need the result.
- **Graceful degradation**: If `RESEND_API_KEY` is missing, log a warning and return failure -- do not crash the calling flow.
- **Both portals get identical copies**: Since admin-portal and broker-portal are separate Next.js apps with separate `node_modules`, each needs its own copy of the email service and templates. They share the same code but are not symlinked.

### Important Details

- Resend SDK v4.x -- install latest: `npm install resend @react-email/components`
- React Email components are server-side only (they render to HTML string)
- The `sendEmail()` function must only be called from server-side code (API routes, server actions, server components)
- Do NOT import email service in any client component

## Integration Notes

- Exports to: TASK-2178 (invitation templates import `sendEmail` and `BaseLayout`)
- Exports to: TASK-2179 (support notification templates import `sendEmail` and `BaseLayout`)
- Depends on: Nothing (first task in sprint)
- Required by: ALL subsequent tasks in SPRINT-131

## Do / Don't

### Do:

- Use the exact `sendEmail()` interface shown above -- subsequent tasks depend on it
- Make `BaseLayout` flexible enough for any email type (invitations, notifications, alerts)
- Include inline styles in React Email components (email clients don't support CSS classes)
- Log all email send attempts with `[Email]` prefix for searchability
- Test the service with a mocked Resend client (do not make real API calls in tests)

### Don't:

- Do NOT create any specific templates (InviteEmail, TicketEmail, etc.)
- Do NOT add email sending to any existing flows
- Do NOT use CSS classes in email templates (email clients strip them)
- Do NOT store the API key in code -- it must come from environment variables
- Do NOT make `sendEmail()` throw errors -- always return a result object

## When to Stop and Ask

- If Resend SDK API has changed significantly from the pattern above (v5+ breaking changes)
- If `@react-email/components` requires a peer dependency that conflicts with existing packages
- If you need to modify any existing files beyond `package.json`
- If the BaseLayout needs to reference assets (logo) that don't exist at the expected URL

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `emailService.test.ts`: Mock Resend client, test successful send, test error handling, test missing API key graceful degradation, test array vs string `to` parameter
- Existing tests to update: None

### Coverage

- Coverage impact: New files only, must have >80% coverage on `emailService.ts`

### Integration / Feature Tests

- Required scenarios:
  - Manual: After deploying, send a test email via Resend dashboard or a quick script to verify delivery

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking (`npx tsc --noEmit` in both portals)
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(email): add Resend email service and base layout template`
- **Labels**: `feature`, `email`, `SPRINT-131`
- **Depends on**: None (first task)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 5 new files (2x emailService, 2x BaseLayout, 1x test) | +15K |
| Files to modify | 2 package.json | +5K |
| Code volume | ~200 lines | +10K |
| Test complexity | Low (mocked SDK) | +5K |

**Confidence:** High

**Risk factors:**
- Resend SDK version compatibility
- React Email component API may have changed

**Similar past tasks:** Service-layer tasks typically come in at 0.5x estimate (see task-file-authoring.md)

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
- [ ] admin-portal/lib/email/emailService.ts
- [ ] admin-portal/lib/email/templates/BaseLayout.tsx
- [ ] broker-portal/lib/email/emailService.ts
- [ ] broker-portal/lib/email/templates/BaseLayout.tsx
- [ ] admin-portal/lib/email/__tests__/emailService.test.ts

Features implemented:
- [ ] sendEmail() with fire-and-forget pattern
- [ ] BaseLayout with Keepr branding
- [ ] Graceful degradation when API key missing
- [ ] Both portals configured

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~40K | ~XK | +/-X% |
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
