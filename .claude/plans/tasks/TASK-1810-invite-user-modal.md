# Task TASK-1810: Invite User Modal & Service

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

Implement the invite user modal and backend service that allows admins to invite new members to their organization. This includes email validation, role selection, and invitation token generation.

## Non-Goals

- Do NOT send actual invitation emails (show copy-link UI instead)
- Do NOT implement SSO/SCIM provisioning paths
- Do NOT implement bulk invite
- Do NOT implement invitation acceptance flow (existing flow)

## Deliverables

1. New file: `broker-portal/components/users/InviteUserModal.tsx`
2. New file: `broker-portal/lib/actions/inviteUser.ts` (server action)
3. Update: `broker-portal/app/dashboard/users/page.tsx` (add invite button)
4. Update: `broker-portal/components/users/UserListClient.tsx` (integrate modal)

## Acceptance Criteria

- [ ] "Invite User" button visible to admin/it_admin roles
- [ ] Modal opens with email input and role selector
- [ ] Email validation (format + not already a member)
- [ ] Role selection dropdown (agent, broker, admin - not it_admin)
- [ ] Submit creates invitation record in organization_members
- [ ] Success shows invitation link for copying
- [ ] Error handling for duplicate email, invalid email
- [ ] Modal closes and list refreshes on success
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// broker-portal/components/users/InviteUserModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteUser } from '@/lib/actions/inviteUser';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

export default function InviteUserModal({
  isOpen,
  onClose,
  organizationId,
}: InviteUserModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'agent' | 'broker' | 'admin'>('agent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await inviteUser({
        email,
        role,
        organizationId,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setInviteLink(result.inviteLink);
        router.refresh(); // Refresh the user list
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('agent');
    setError(null);
    setInviteLink(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Invite Team Member
          </h2>

          {inviteLink ? (
            // Success state - show invite link
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Invitation created! Share this link with {email}:
              </p>
              <div className="bg-gray-50 p-3 rounded-md break-all text-sm">
                {inviteLink}
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          ) : (
            // Form state
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="colleague@example.com"
                />
              </div>

              {/* Role select */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'agent' | 'broker' | 'admin')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="agent">Agent - Can submit transactions</option>
                  <option value="broker">Broker - Can review submissions</option>
                  <option value="admin">Admin - Full organization access</option>
                </select>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Server Action

```typescript
// broker-portal/lib/actions/inviteUser.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

interface InviteUserInput {
  email: string;
  role: 'agent' | 'broker' | 'admin';
  organizationId: string;
}

interface InviteUserResult {
  success: boolean;
  inviteLink?: string;
  error?: string;
}

export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const supabase = await createClient();

  // Verify current user is admin/it_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!membership || !['admin', 'it_admin'].includes(membership.role)) {
    return { success: false, error: 'Not authorized to invite users' };
  }

  // Check if email already exists in organization
  // NOTE: Use separate queries to avoid SQL injection - DO NOT use string interpolation
  const normalizedEmail = input.email.toLowerCase().trim();

  // Check for pending invitation with this email
  const { data: existingInvite } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('invited_email', normalizedEmail)
    .maybeSingle();

  if (existingInvite) {
    return { success: false, error: 'This email already has a pending invitation' };
  }

  // Check if a user with this email is already a member
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    if (existingMember) {
      return { success: false, error: 'This user is already a member of the organization' };
    }
  }

  // Generate invitation token
  const invitationToken = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

  // Create invitation record
  const { error: insertError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: input.organizationId,
      invited_email: input.email.toLowerCase(),
      role: input.role,
      license_status: 'pending',
      invitation_token: invitationToken,
      invitation_expires_at: expiresAt.toISOString(),
      invited_by: user.id,
      invited_at: new Date().toISOString(),
      provisioned_by: 'invite',
    });

  if (insertError) {
    console.error('Error creating invitation:', insertError);
    return { success: false, error: 'Failed to create invitation' };
  }

  // Generate invite link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.magicaudit.com';
  const inviteLink = `${baseUrl}/invite/${invitationToken}`;

  return {
    success: true,
    inviteLink,
  };
}
```

### Page Integration

```typescript
// Update broker-portal/app/dashboard/users/page.tsx
import InviteUserModal from '@/components/users/InviteUserModal';

// In the component, add state and button:
// ... (in UserListClient or page)
const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

// Add button in header:
<button
  onClick={() => setIsInviteModalOpen(true)}
  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
>
  Invite User
</button>

// Add modal:
<InviteUserModal
  isOpen={isInviteModalOpen}
  onClose={() => setIsInviteModalOpen(false)}
  organizationId={organizationId}
/>
```

## Integration Notes

- Imports from: `@/lib/supabase/server`, `crypto`
- Exports to: Used by `UserListClient.tsx`
- Used by: Admin users to invite new members
- Depends on: TASK-1809 (UserListClient), TASK-1814 (server actions patterns)

## Do / Don't

### Do:

- Generate cryptographically secure invitation tokens
- Validate email format before submission
- Check for existing members/invites
- Set reasonable expiration (7 days)
- Store provisioned_by as 'invite'
- Normalize email to lowercase

### Don't:

- Don't send actual emails (copy-link UI is sufficient for now)
- Don't allow it_admin role to be assigned via invite
- Don't allow inviting yourself
- Don't allow more invites than max_seats

## When to Stop and Ask

- If organization_members doesn't have invitation_token column
- If provisioned_by column doesn't exist (SPRINT-070 not complete)
- If unsure about invite link URL structure
- If RLS policies block invitation insert

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `inviteUser.test.ts`: Server action tests (validation, duplicate check, token generation)
  - `InviteUserModal.test.tsx`: Form submission, error states

### Coverage

- Coverage impact: Should maintain or improve coverage

### Integration / Feature Tests

- Manual test: Admin invites user, sees link, copies it
- Test duplicate email rejection
- Test role selection

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add invite user modal and server action`
- **Labels**: `broker-portal`, `ui`, `service`
- **Depends on**: TASK-1809

---

## PM Estimate (PM-Owned)

**Category:** `ui + service`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +15K |
| Files to modify | 2 files | +5K |
| Code volume | ~350 lines | +5K |
| Test complexity | Medium (server action) | +5K |

**Confidence:** Medium

**Risk factors:**
- Server action patterns may need research
- RLS policy testing needed

**Similar past tasks:** SPRINT-058 invitation system (~20K)

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
- [ ] broker-portal/components/users/InviteUserModal.tsx
- [ ] broker-portal/lib/actions/inviteUser.ts

Files modified:
- [ ] broker-portal/app/dashboard/users/page.tsx
- [ ] broker-portal/components/users/UserListClient.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Invite flow works end-to-end
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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: 2026-02-03*

### Agent ID

```
SR Engineer Agent ID: (interactive session - metrics tracked via session)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | TBD (session) |
| Duration | TBD seconds |
| API Calls | TBD |

### Review Summary

**Architecture Compliance:** PASS
**Security Review:** PASS
**Test Coverage:** Adequate

**Review Notes:**
- SQL injection fix verified: All queries use parameterized Supabase query builder (`.eq()`) - no string interpolation
- Self-invite prevention implemented
- Seat limit enforcement implemented
- Secure 32-byte token generation using crypto.randomBytes
- 7-day invitation expiry
- Authorization check (admin/it_admin only)
- Email normalization (lowercase + trim)
- Role validation (excludes it_admin from invitable roles)
- 74 tests covering validation logic, role selection, state management
- All CI checks pass (Test & Lint, Security Audit, Build on macOS/Windows)

### Merge Information

**PR Number:** #733
**Merge Commit:** 6a67567a72d010f153cfae5e029e9a5e5992740c
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view 733 --json state --jq '.state'
# Result: MERGED
```

- [x] PR merge command executed: `gh pr merge 733 --merge`
- [x] Merge verified: `gh pr view 733 --json state` shows `MERGED`
- [x] Task can now be marked complete
