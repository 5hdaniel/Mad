# Task TASK-2178: Invitation Email Templates + Integration

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

Create two email templates (org invite + internal user invite) and wire them into the existing invitation flows so that inviting a user automatically sends a branded email with the invite link. After this task, admins no longer need to copy/paste invite URLs.

## Non-Goals

- Do NOT modify the email service (`emailService.ts`) or base layout (`BaseLayout.tsx`) -- those are from TASK-2177
- Do NOT add support ticket notification emails -- that is TASK-2179
- Do NOT add email rate limiting beyond the simple per-action guard
- Do NOT add notification preferences or unsubscribe links
- Do NOT modify the invite token generation or acceptance logic

## Deliverables

1. New file: `broker-portal/lib/email/templates/InviteUserEmail.tsx` -- org invite email template
2. New file: `admin-portal/lib/email/templates/InternalInviteEmail.tsx` -- internal user invite email template
3. Update: `broker-portal/lib/actions/inviteUser.ts` (or equivalent server action) -- add `sendEmail()` call after invite creation
4. Update: `admin-portal/app/api/internal-users/invite/route.ts` (or equivalent) -- add `sendEmail()` call after invite creation
5. New file: `broker-portal/lib/email/__tests__/inviteEmails.test.ts` -- template rendering tests

## File Boundaries

N/A -- sequential execution.

## Acceptance Criteria

- [ ] `InviteUserEmail` template renders branded email with: org name, inviter name, invite link button, expiry notice
- [ ] `InternalInviteEmail` template renders branded email with: role being assigned, invite link button, expiry notice
- [ ] Org invite flow (`inviteUser` action) sends email after creating invite token
- [ ] Internal invite flow (admin API route) sends email after creating invite token
- [ ] Email subject format: `"You've been invited to join {org_name} on Keepr"` (org invite)
- [ ] Email subject format: `"You've been invited to Keepr as {role}"` (internal invite)
- [ ] Invite link in email is a working clickable button
- [ ] Email send failure does NOT block the invite creation (fire-and-forget)
- [ ] Resend invite action also re-sends the email
- [ ] `npx tsc --noEmit` passes in both admin-portal and broker-portal
- [ ] All CI checks pass

## Implementation Notes

### InviteUserEmail Template

```typescript
import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './BaseLayout';

interface InviteUserEmailProps {
  orgName: string;
  inviterName: string;
  inviteUrl: string;
  expiresIn: string; // e.g., "7 days"
}

export function InviteUserEmail({ orgName, inviterName, inviteUrl, expiresIn }: InviteUserEmailProps) {
  return (
    <BaseLayout preview={`${inviterName} invited you to join ${orgName} on Keepr`}>
      <Heading as="h2">You have been invited!</Heading>
      <Text>
        {inviterName} has invited you to join <strong>{orgName}</strong> on Keepr.
      </Text>
      <Button href={inviteUrl} style={buttonStyle}>
        Accept Invitation
      </Button>
      <Text style={smallText}>
        This invitation expires in {expiresIn}. If you did not expect this invitation,
        you can safely ignore this email.
      </Text>
    </BaseLayout>
  );
}
```

### Integration Pattern

In the existing invite server action/API route, add the email call AFTER the invite record is created:

```typescript
// After creating invite token and getting inviteUrl...
import { sendEmail } from '@/lib/email/emailService';
import { InviteUserEmail } from '@/lib/email/templates/InviteUserEmail';

// Fire-and-forget -- don't await or block on email
void sendEmail({
  to: inviteeEmail,
  subject: `You've been invited to join ${orgName} on Keepr`,
  template: InviteUserEmail({
    orgName,
    inviterName: currentUser.name,
    inviteUrl,
    expiresIn: '7 days',
  }),
});
```

### Finding the Invite Flows

1. **Broker portal org invite**: Look for the server action or API route that creates org invitations. Check `broker-portal/lib/actions/` or `broker-portal/app/api/` for invite-related files. The action creates an invite token and returns a URL.

2. **Admin portal internal invite**: Check `admin-portal/app/api/internal-users/` or `admin-portal/app/dashboard/` for the internal user invite flow. This likely calls a Supabase RPC to create the invite.

**IMPORTANT**: Scan for the actual file paths before implementing. The paths in deliverables are best guesses based on Next.js conventions. The actual paths may differ.

### Key Patterns

- **Fire-and-forget**: Use `void sendEmail(...)` -- do not `await` in the invite flow
- **Same invite behavior**: The invite link, token, and acceptance flow remain unchanged. Email is additive only.
- **Resend invite**: If there's a "resend invite" button/action, it should also trigger the email send

## Integration Notes

- Imports from: TASK-2177 (`sendEmail`, `BaseLayout`)
- Exports to: Nothing directly
- Used by: End users (they receive the emails)
- Depends on: TASK-2177 (email service must exist)

## Do / Don't

### Do:

- Use `BaseLayout` from TASK-2177 as the outer wrapper for all templates
- Use React Email components (`Button`, `Text`, `Heading`, etc.) for template content
- Include inline styles (email clients strip CSS classes)
- Make the invite URL a prominent, styled button
- Include expiry information in the email body

### Don't:

- Do NOT modify `emailService.ts` or `BaseLayout.tsx`
- Do NOT change invite token generation or acceptance logic
- Do NOT add email tracking (open/click)
- Do NOT use external CSS stylesheets in templates
- Do NOT add a reply-to address (these are system-generated invites)

## When to Stop and Ask

- If you cannot locate the existing invite server action / API route
- If the invite flow uses a pattern that makes fire-and-forget email difficult (e.g., edge function)
- If the invite URL construction is not straightforward (needs additional context)
- If you need to modify more than 2 existing files

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `inviteEmails.test.ts`: Test that `InviteUserEmail` and `InternalInviteEmail` render valid HTML with expected content (org name, invite link, etc.)
- Existing tests to update: None expected

### Coverage

- Coverage impact: New files only, should have >80% coverage

### Integration / Feature Tests

- Required scenarios:
  - Manual: Invite a test user via broker portal, verify email arrives with correct content and working link
  - Manual: Invite an internal user via admin portal, verify email arrives

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(email): add invitation email templates and wire into invite flows`
- **Labels**: `feature`, `email`, `SPRINT-131`
- **Depends on**: TASK-2177

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~22K-45K

**Token Cap:** 180K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new files (2 templates, 1 test) | +15K |
| Files to modify | 2 files (invite server actions) | +15K |
| Code volume | ~300 lines | +10K |
| Test complexity | Low (template rendering) | +5K |

**Confidence:** Medium

**Risk factors:**
- Locating the exact invite flow files may take exploration time
- Invite flow patterns may vary between admin-portal and broker-portal

**Similar past tasks:** Service-layer tasks typically come in at 0.5x estimate

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
- [ ] broker-portal/lib/email/templates/InviteUserEmail.tsx
- [ ] admin-portal/lib/email/templates/InternalInviteEmail.tsx
- [ ] broker-portal/lib/email/__tests__/inviteEmails.test.ts

Features implemented:
- [ ] Org invite sends email automatically
- [ ] Internal invite sends email automatically
- [ ] Resend invite also sends email
- [ ] Fire-and-forget pattern (no blocking)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**Variance:** PM Est ~45K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~45K | ~XK | +/-X% |
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
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
