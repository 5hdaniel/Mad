# Task TASK-2198: User Invite Email Delivery

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

Wire up the existing user invite flow to send an actual email via the Microsoft Graph API-backed email service (TASK-2197). When an admin clicks "Send Invite" in the InviteUserModal, the system should: (1) create the invitation record (already works), (2) send a branded invite email to the recipient with the invite link, and (3) update the UI to confirm the email was sent (rather than showing a copy-paste link).

## Non-Goals

- Do NOT modify the email service module itself (`lib/email/`) -- that is TASK-2197, already merged
- Do NOT implement "resend invite" (re-send expired invite) -- follow-up sprint
- Do NOT implement rate limiting on invite sends -- deferred
- Do NOT modify the invite acceptance flow (`/invite/[token]/page.tsx`) -- already works
- Do NOT add email sending to the admin portal -- admin portal does not have the invite flow
- Do NOT change the invitation token generation or expiry logic -- already correct (7 days)

## Deliverables

1. Update: `broker-portal/lib/actions/inviteUser.ts` -- add email sending after successful invite creation
2. Update: `broker-portal/components/users/InviteUserModal.tsx` -- update success state to show "email sent" confirmation instead of copy-paste link
3. Update: `broker-portal/__tests__/lib/actions/inviteUser.test.ts` -- add test for email sending integration

## File Boundaries

### Files to modify (owned by this task):

- `broker-portal/lib/actions/inviteUser.ts`
- `broker-portal/components/users/InviteUserModal.tsx`
- `broker-portal/__tests__/lib/actions/inviteUser.test.ts`

### Files this task must NOT modify:

- `broker-portal/lib/email/*` -- owned by TASK-2197 (read-only import)
- `broker-portal/lib/support-queries.ts` -- owned by TASK-2199
- `broker-portal/app/invite/[token]/page.tsx` -- not in scope
- Any admin-portal files
- Any Electron app files

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] When admin clicks "Send Invite", an email is sent to the invited user via Microsoft Graph API
- [ ] The email contains: org name, inviter name, assigned role, invite link as a CTA button, 7-day expiry notice
- [ ] The `inviteUser` server action returns `{ success: true, emailSent: true }` on success
- [ ] The `inviteUser` server action returns `{ success: true, emailSent: false, inviteLink }` if email fails (graceful degradation -- invite is still created, link shown for manual copy)
- [ ] The InviteUserModal success state shows "Invitation email sent to {email}" when email succeeds
- [ ] The InviteUserModal success state falls back to showing the copy-paste link if email delivery failed
- [ ] The invite link in the email matches the format: `{NEXT_PUBLIC_APP_URL}/invite/{token}`
- [ ] To get the inviter's name, the server action queries the `users` table for the current user's name
- [ ] To get the org name, the server action queries the `organizations` table
- [ ] Unit test verifies `sendInviteEmail` is called with correct params when invite is created
- [ ] Unit test verifies graceful degradation when email sending fails
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No modifications to files outside the "Files to modify" list

## Implementation Notes

### Changes to `inviteUser.ts`

Add email sending after the successful insert. The key change is at the end of the function, after the invite record is created:

```typescript
// After successful insert and invite link generation...
import { sendInviteEmail } from '@/lib/email';

// Fetch inviter name and org name for the email
const { data: inviterData } = await supabase
  .from('users')
  .select('full_name, email')
  .eq('id', user.id)
  .maybeSingle();

const { data: orgData } = await supabase
  .from('organizations')
  .select('name')
  .eq('id', input.organizationId)
  .maybeSingle();

const inviterName = inviterData?.full_name || inviterData?.email || 'Your administrator';
const orgName = orgData?.name || 'your organization';

// Send the invite email (non-blocking -- invite is created regardless)
const emailResult = await sendInviteEmail({
  recipientEmail: normalizedEmail,
  organizationName: orgName,
  inviterName: inviterName,
  role: input.role,
  inviteLink,
  expiresInDays: 7,
});

return {
  success: true,
  inviteLink,
  emailSent: emailResult.success,
};
```

### Changes to `InviteUserResult` type

Update the return type to include `emailSent`:

```typescript
interface InviteUserResult {
  success: boolean;
  inviteLink?: string;
  emailSent?: boolean;
  error?: string;
}
```

### Changes to `InviteUserModal.tsx`

Update the success state to reflect whether the email was sent:

```typescript
// In handleSubmit success path:
if (result.inviteLink) {
  setInviteLink(result.inviteLink);
  setEmailSent(result.emailSent ?? false);
  router.refresh();
}

// In the success UI:
{emailSent ? (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-green-600">
      <CheckIcon />
      <span className="font-medium">Invitation Email Sent</span>
    </div>
    <p className="text-sm text-gray-600">
      An invitation email has been sent to <strong>{email}</strong>.
      They will receive a link to join your organization.
    </p>
    {/* Still show the link as a fallback option */}
    <details className="text-sm">
      <summary className="text-gray-500 cursor-pointer">
        Or copy the invite link manually
      </summary>
      <div className="mt-2 bg-gray-50 p-3 rounded-md border">
        <p className="break-all text-sm text-gray-800 font-mono">{inviteLink}</p>
      </div>
      <button onClick={handleCopyLink} className="mt-2 ...">
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </details>
  </div>
) : (
  // Existing copy-paste link UI (fallback when email failed)
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-yellow-600">
      <WarningIcon />
      <span className="font-medium">Invitation Created</span>
    </div>
    <p className="text-sm text-gray-600">
      The invitation was created but the email could not be sent.
      Please share this link with {email} manually:
    </p>
    {/* Existing link display + copy button */}
  </div>
)}
```

### Important Details

- The email sending must NOT block invite creation -- if `sendInviteEmail` fails, the invite record already exists and the user gets the fallback copy-paste link
- The server action already fetches `user` (for auth check) and `organization` (for seat limit check) -- reuse those queries where possible to avoid extra DB calls
- The `inviteUser` function already normalizes the email -- pass the normalized email to `sendInviteEmail`
- The existing copy-paste link functionality must remain as a fallback -- do not remove it

## Integration Notes

- Imports from: `broker-portal/lib/email` (TASK-2197 -- must be merged first)
- Exports to: Nothing -- modifies existing exports
- Used by: InviteUserModal component (already wired)
- Depends on: TASK-2197 (email service must exist before this task can run)

## Do / Don't

### Do:

- Keep the email send as a non-blocking addition to the existing flow
- Preserve the existing copy-paste link as a fallback
- Reuse existing DB queries (user, organization) where possible
- Add the `emailSent` field to the return type
- Show clear UI feedback about whether the email was sent

### Don't:

- Don't make invite creation dependent on email success (invite should be created even if email fails)
- Don't remove the copy-paste link entirely -- keep it as a secondary option
- Don't modify the `lib/email/` module
- Don't add new environment variables (Azure credentials and EMAIL_SENDER_ADDRESS are already handled by TASK-2197)
- Don't change the invitation token format, expiry, or acceptance flow

## When to Stop and Ask

- If `sendInviteEmail` is not exported from `broker-portal/lib/email` (TASK-2197 may not be merged yet)
- If the `users` table doesn't have a `full_name` column (check schema first)
- If the existing `inviteUser.test.ts` has complex mocking that makes adding email tests difficult
- If you need to modify `broker-portal/lib/email/` to support additional parameters
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write in `broker-portal/__tests__/lib/actions/inviteUser.test.ts`:
  - Test that `sendInviteEmail` is called with correct params after successful invite creation
  - Test that invite creation succeeds even when `sendInviteEmail` fails (graceful degradation)
  - Test that `emailSent: true` is returned when email succeeds
  - Test that `emailSent: false` and `inviteLink` are returned when email fails
- Mock strategy: Mock `@/lib/email` module entirely (`jest.mock('@/lib/email')`)

### Coverage

- Coverage impact: Extends existing inviteUser test coverage

### Integration / Feature Tests

- Manual test: Admin invites user, email arrives in inbox with correct content and working link

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(invite): send invite email via Graph API when admin invites user`
- **Labels**: `feature`, `email`, `broker-portal`
- **Depends on**: TASK-2197 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 3 files (action, modal, test) | +6K |
| Code volume | ~80 lines added/changed | +3K |
| Test complexity | Medium (mocking server action + email module) | +3K |

**Confidence:** High

**Risk factors:**
- Existing test file may need significant refactoring to add email mocks
- `users` table column name for full name may differ (need to verify schema)

**Similar past tasks:** Wiring existing service into existing UI -- typically straightforward. Applying 0.5x service multiplier but keeping estimate moderate due to test updates.

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
- (none -- this task only modifies existing files)

Files modified:
- [ ] broker-portal/lib/actions/inviteUser.ts
- [ ] broker-portal/components/users/InviteUserModal.tsx
- [ ] broker-portal/__tests__/lib/actions/inviteUser.test.ts

Features implemented:
- [ ] Email sent automatically when admin invites user
- [ ] UI shows "email sent" confirmation on success
- [ ] UI falls back to copy-paste link on email failure
- [ ] Graceful degradation -- invite created regardless of email status

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

**Variance:** PM Est ~12K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~12K | ~XK | +/-X% |
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
