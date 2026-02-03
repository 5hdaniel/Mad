# Task TASK-1811: Edit User Role Modal

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

Implement a modal that allows admins to change a user's role within the organization. This enables role management without requiring user re-invitation.

## Non-Goals

- Do NOT implement user deactivation (TASK-1812)
- Do NOT implement bulk role changes
- Do NOT allow role change for the current user (self)
- Do NOT allow admin to assign it_admin role (only it_admin can do that)

## Deliverables

1. New file: `broker-portal/components/users/EditRoleModal.tsx`
2. New file: `broker-portal/lib/actions/updateUserRole.ts` (server action)
3. Update: `broker-portal/components/users/UserCard.tsx` (add edit button)

## Acceptance Criteria

- [ ] Edit role button appears for admin/it_admin users
- [ ] Button does NOT appear for current user (cannot edit own role)
- [ ] Modal shows current role and dropdown for new role
- [ ] Role options are filtered based on current user's permissions:
  - admin can assign: agent, broker, admin
  - it_admin can assign: agent, broker, admin, it_admin
- [ ] Submit updates organization_members.role
- [ ] Success message and list refresh
- [ ] Error handling for permission denied
- [ ] Cannot demote the last admin/it_admin
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// broker-portal/components/users/EditRoleModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserRole } from '@/lib/actions/updateUserRole';

type Role = 'agent' | 'broker' | 'admin' | 'it_admin';

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentRole: Role;
  currentUserRole: Role; // The logged-in user's role
}

export default function EditRoleModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  currentRole,
  currentUserRole,
}: EditRoleModalProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine available roles based on current user's role
  const availableRoles: { value: Role; label: string }[] = [
    { value: 'agent', label: 'Agent - Can submit transactions' },
    { value: 'broker', label: 'Broker - Can review submissions' },
    { value: 'admin', label: 'Admin - Full organization access' },
  ];

  // Only it_admin can assign it_admin role
  if (currentUserRole === 'it_admin') {
    availableRoles.push({ value: 'it_admin', label: 'IT Admin - SSO/SCIM management' });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === currentRole) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await updateUserRole({
        memberId,
        newRole: selectedRole,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Change Role for {memberName}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {availableRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedRole === currentRole}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### Server Action

```typescript
// broker-portal/lib/actions/updateUserRole.ts
'use server';

import { createClient } from '@/lib/supabase/server';

type Role = 'agent' | 'broker' | 'admin' | 'it_admin';

interface UpdateRoleInput {
  memberId: string;
  newRole: Role;
}

interface UpdateRoleResult {
  success: boolean;
  error?: string;
}

export async function updateUserRole(input: UpdateRoleInput): Promise<UpdateRoleResult> {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get target member details
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('id, user_id, role, organization_id')
    .eq('id', input.memberId)
    .single();

  if (!targetMember) {
    return { success: false, error: 'Member not found' };
  }

  // Get current user's membership
  const { data: currentMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', targetMember.organization_id)
    .single();

  if (!currentMembership) {
    return { success: false, error: 'Not authorized' };
  }

  // Permission checks
  const currentRole = currentMembership.role;

  // Only admin/it_admin can change roles
  if (!['admin', 'it_admin'].includes(currentRole)) {
    return { success: false, error: 'Not authorized to change roles' };
  }

  // Cannot change own role
  if (targetMember.user_id === user.id) {
    return { success: false, error: 'Cannot change your own role' };
  }

  // Only it_admin can assign it_admin role
  if (input.newRole === 'it_admin' && currentRole !== 'it_admin') {
    return { success: false, error: 'Only IT Admins can assign IT Admin role' };
  }

  // Check if this would remove the last admin/it_admin
  if (['admin', 'it_admin'].includes(targetMember.role) && !['admin', 'it_admin'].includes(input.newRole)) {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', targetMember.organization_id)
      .in('role', ['admin', 'it_admin'])
      .neq('id', input.memberId);

    if (count === 0) {
      return { success: false, error: 'Cannot demote the last admin. Assign another admin first.' };
    }
  }

  // Update the role
  const { error: updateError } = await supabase
    .from('organization_members')
    .update({
      role: input.newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.memberId);

  if (updateError) {
    console.error('Error updating role:', updateError);
    return { success: false, error: 'Failed to update role' };
  }

  return { success: true };
}
```

### UserCard Integration

```typescript
// Update broker-portal/components/users/UserCard.tsx
// Add to the card actions section:

{canManage && !isCurrentUser && (
  <button
    onClick={() => onEditRole?.(member)}
    className="text-sm text-indigo-600 hover:text-indigo-800"
  >
    Change Role
  </button>
)}
```

## Integration Notes

- Imports from: `@/lib/supabase/server`
- Exports to: Used by `UserCard.tsx`
- Used by: Admin/IT Admin users to manage roles
- Depends on: TASK-1809 (UserCard)

## Do / Don't

### Do:

- Check permissions on both client and server
- Prevent last admin removal
- Show clear role descriptions
- Update updated_at timestamp

### Don't:

- Don't allow self role change
- Don't allow admin to assign it_admin
- Don't show it_admin option if current user is only admin
- Don't allow role change for pending invites (no user_id)

## When to Stop and Ask

- If RLS policies prevent role updates
- If role enum values differ from expected
- If unsure about admin count logic
- If updated_at column doesn't exist

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `updateUserRole.test.ts`: Permission checks, last admin protection
  - `EditRoleModal.test.tsx`: Role filtering based on permissions

### Coverage

- Coverage impact: Should maintain or improve coverage

### Integration / Feature Tests

- Manual test: Admin changes agent to broker
- Test last admin protection
- Test permission escalation prevention

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add edit user role modal`
- **Labels**: `broker-portal`, `ui`, `service`
- **Depends on**: TASK-1809

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +8K |
| Files to modify | 1 file | +3K |
| Code volume | ~200 lines | +4K |
| Test complexity | Medium | +3K |

**Confidence:** High

**Risk factors:**
- None significant - simpler than invite flow

**Similar past tasks:** Similar modal patterns in portal

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
- [ ] broker-portal/components/users/EditRoleModal.tsx
- [ ] broker-portal/lib/actions/updateUserRole.ts

Files modified:
- [ ] broker-portal/components/users/UserCard.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Role change works correctly
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
<1-2 sentence explanation of why estimate was off>

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
