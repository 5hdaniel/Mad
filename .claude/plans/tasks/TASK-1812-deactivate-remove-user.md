# Task TASK-1812: Deactivate/Remove User Flow

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

Implement user deactivation and removal functionality. Deactivation suspends a user's access (soft delete), while removal completely deletes them from the organization.

## Non-Goals

- Do NOT implement user data deletion (GDPR/CCPA - future sprint)
- Do NOT implement reactivation flow yet (just suspension)
- Do NOT remove associated transaction submissions
- Do NOT implement bulk deactivation

## Deliverables

1. New file: `broker-portal/components/users/UserActionsDropdown.tsx`
2. New file: `broker-portal/components/users/DeactivateUserModal.tsx`
3. New file: `broker-portal/components/users/RemoveUserModal.tsx`
4. New file: `broker-portal/lib/actions/deactivateUser.ts`
5. New file: `broker-portal/lib/actions/removeUser.ts`
6. Update: `broker-portal/components/users/UserCard.tsx` (integrate dropdown)

## Acceptance Criteria

- [ ] Actions dropdown with "Deactivate" and "Remove" options
- [ ] Dropdown only visible to admin/it_admin, not for self
- [ ] Deactivate sets license_status to 'suspended'
- [ ] Deactivated users cannot access broker portal
- [ ] Remove deletes the organization_members record
- [ ] Cannot deactivate/remove the last admin
- [ ] Confirmation modal for both actions
- [ ] Success message and list refresh
- [ ] Pending invites can only be "removed" (revoke invite)
- [ ] All CI checks pass

## Implementation Notes

### Actions Dropdown

```typescript
// broker-portal/components/users/UserActionsDropdown.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface UserActionsDropdownProps {
  memberId: string;
  memberName: string;
  isPending: boolean; // No user_id yet
  isCurrentUser: boolean;
  onDeactivate: () => void;
  onRemove: () => void;
}

export default function UserActionsDropdown({
  memberId,
  memberName,
  isPending,
  isCurrentUser,
  onDeactivate,
  onRemove,
}: UserActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isCurrentUser) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-gray-100"
        aria-label="User actions"
      >
        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            {!isPending && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onDeactivate();
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Deactivate User
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                onRemove();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              {isPending ? 'Revoke Invitation' : 'Remove from Organization'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Deactivate Modal

```typescript
// broker-portal/components/users/DeactivateUserModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deactivateUser } from '@/lib/actions/deactivateUser';

interface DeactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

export default function DeactivateUserModal({
  isOpen,
  onClose,
  memberId,
  memberName,
}: DeactivateUserModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await deactivateUser({ memberId });

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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Deactivate User
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to deactivate <strong>{memberName}</strong>?
            They will no longer be able to access the broker portal or submit transactions.
          </p>

          <p className="text-sm text-gray-500 mb-6">
            You can reactivate this user later if needed.
          </p>

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isSubmitting}
              className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Remove Modal

```typescript
// broker-portal/components/users/RemoveUserModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeUser } from '@/lib/actions/removeUser';

interface RemoveUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  isPending: boolean;
}

export default function RemoveUserModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  isPending,
}: RemoveUserModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await removeUser({ memberId });

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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isPending ? 'Revoke Invitation' : 'Remove User'}
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            {isPending ? (
              <>Are you sure you want to revoke the invitation for <strong>{memberName}</strong>?</>
            ) : (
              <>Are you sure you want to remove <strong>{memberName}</strong> from the organization?</>
            )}
          </p>

          {!isPending && (
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. The user will need to be re-invited.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isSubmitting}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Removing...' : (isPending ? 'Revoke' : 'Remove')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Server Actions

```typescript
// broker-portal/lib/actions/deactivateUser.ts
'use server';

import { createClient } from '@/lib/supabase/server';

interface DeactivateInput {
  memberId: string;
}

interface DeactivateResult {
  success: boolean;
  error?: string;
}

export async function deactivateUser(input: DeactivateInput): Promise<DeactivateResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get target member
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('id, user_id, role, organization_id')
    .eq('id', input.memberId)
    .single();

  if (!targetMember) {
    return { success: false, error: 'Member not found' };
  }

  // Verify current user is admin
  const { data: currentMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', targetMember.organization_id)
    .single();

  if (!currentMembership || !['admin', 'it_admin'].includes(currentMembership.role)) {
    return { success: false, error: 'Not authorized' };
  }

  // Cannot deactivate yourself
  if (targetMember.user_id === user.id) {
    return { success: false, error: 'Cannot deactivate yourself' };
  }

  // Check last admin protection
  if (['admin', 'it_admin'].includes(targetMember.role)) {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', targetMember.organization_id)
      .in('role', ['admin', 'it_admin'])
      .eq('license_status', 'active')
      .neq('id', input.memberId);

    if (count === 0) {
      return { success: false, error: 'Cannot deactivate the last admin' };
    }
  }

  // Update status to suspended
  const { error: updateError } = await supabase
    .from('organization_members')
    .update({
      license_status: 'suspended',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.memberId);

  if (updateError) {
    return { success: false, error: 'Failed to deactivate user' };
  }

  return { success: true };
}
```

```typescript
// broker-portal/lib/actions/removeUser.ts
'use server';

import { createClient } from '@/lib/supabase/server';

interface RemoveInput {
  memberId: string;
}

interface RemoveResult {
  success: boolean;
  error?: string;
}

export async function removeUser(input: RemoveInput): Promise<RemoveResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get target member
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('id, user_id, role, organization_id')
    .eq('id', input.memberId)
    .single();

  if (!targetMember) {
    return { success: false, error: 'Member not found' };
  }

  // Verify current user is admin
  const { data: currentMembership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', targetMember.organization_id)
    .single();

  if (!currentMembership || !['admin', 'it_admin'].includes(currentMembership.role)) {
    return { success: false, error: 'Not authorized' };
  }

  // Cannot remove yourself
  if (targetMember.user_id === user.id) {
    return { success: false, error: 'Cannot remove yourself' };
  }

  // Check last admin protection (only for active members with a role)
  if (targetMember.user_id && ['admin', 'it_admin'].includes(targetMember.role)) {
    const { count } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', targetMember.organization_id)
      .in('role', ['admin', 'it_admin'])
      .not('user_id', 'is', null) // Only count actual users
      .neq('id', input.memberId);

    if (count === 0) {
      return { success: false, error: 'Cannot remove the last admin' };
    }
  }

  // Delete the membership record
  const { error: deleteError } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', input.memberId);

  if (deleteError) {
    return { success: false, error: 'Failed to remove user' };
  }

  return { success: true };
}
```

## Integration Notes

- Imports from: `@/lib/supabase/server`
- Exports to: Used by `UserCard.tsx`
- Used by: Admin users to manage team
- Depends on: TASK-1810 (similar modal patterns), TASK-1811 (edit modal)

## Do / Don't

### Do:

- Show confirmation dialogs
- Check last admin before deactivate/remove
- Distinguish between pending invites and active users
- Use yellow for deactivate, red for remove (visual distinction)

### Don't:

- Don't allow self-deactivation or self-removal
- Don't delete associated transaction_submissions
- Don't send notification emails (future sprint)
- Don't cascade delete to users table

## When to Stop and Ask

- If organization_members has cascade delete to other tables
- If RLS policies prevent deletion
- If unsure about what happens to user's submissions
- If license_status values differ from expected

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `deactivateUser.test.ts`: Permission checks, last admin protection
  - `removeUser.test.ts`: Permission checks, cascade behavior
  - `UserActionsDropdown.test.tsx`: Visibility logic

### Coverage

- Coverage impact: Should maintain or improve coverage

### Integration / Feature Tests

- Manual test: Deactivate user, verify they cannot login
- Test remove user, verify record deleted
- Test last admin protection

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add user deactivation and removal`
- **Labels**: `broker-portal`, `ui`, `service`
- **Depends on**: TASK-1810, TASK-1811

---

## PM Estimate (PM-Owned)

**Category:** `ui + service`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 5 new files | +12K |
| Files to modify | 1 file | +3K |
| Code volume | ~400 lines | +5K |
| Test complexity | Medium | +5K |

**Confidence:** Medium

**Risk factors:**
- Need to verify cascade behavior
- RLS testing needed

**Similar past tasks:** TASK-1811 (similar modal patterns)

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
- [ ] broker-portal/components/users/UserActionsDropdown.tsx
- [ ] broker-portal/components/users/DeactivateUserModal.tsx
- [ ] broker-portal/components/users/RemoveUserModal.tsx
- [ ] broker-portal/lib/actions/deactivateUser.ts
- [ ] broker-portal/lib/actions/removeUser.ts

Files modified:
- [ ] broker-portal/components/users/UserCard.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Deactivation works correctly
- [ ] Removal works correctly
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
