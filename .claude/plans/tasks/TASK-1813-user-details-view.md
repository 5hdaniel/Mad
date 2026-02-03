# Task TASK-1813: User Details View

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

Implement a detailed user profile view that shows comprehensive information about a single organization member, including their role, status, activity, and management actions.

## Non-Goals

- Do NOT implement activity audit log (future analytics sprint)
- Do NOT show user's transaction submissions list
- Do NOT implement SSO/SCIM configuration details
- Do NOT add user profile editing (users edit their own profile)

## Deliverables

1. Update: `broker-portal/app/dashboard/users/[id]/page.tsx` (full implementation)
2. New file: `broker-portal/app/dashboard/users/[id]/loading.tsx`
3. New file: `broker-portal/components/users/UserDetailsCard.tsx`
4. Update: `broker-portal/components/users/UserCard.tsx` (add link to details)

## Acceptance Criteria

- [ ] `/dashboard/users/[id]` shows full user details
- [ ] Shows profile info: name, email, avatar, role, status
- [ ] Shows dates: joined, last login, invited at
- [ ] Shows provisioning info: how user was added (invite, SSO, SCIM)
- [ ] Action buttons: Edit Role, Deactivate, Remove (reuse existing modals)
- [ ] Back link to users list
- [ ] Breadcrumb navigation
- [ ] Loading state
- [ ] 404 if user not found
- [ ] Access control: admin/it_admin only
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// broker-portal/app/dashboard/users/[id]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import UserDetailsCard from '@/components/users/UserDetailsCard';

interface PageProps {
  params: { id: string };
}

async function getUserDetails(memberId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get current user's membership
  const { data: currentMembership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!currentMembership || !['admin', 'it_admin'].includes(currentMembership.role)) {
    return null;
  }

  // Get target member with full details
  const { data: member, error } = await supabase
    .from('organization_members')
    .select(`
      id,
      user_id,
      role,
      license_status,
      invited_email,
      invited_at,
      joined_at,
      provisioned_by,
      provisioned_at,
      scim_synced_at,
      provisioning_metadata,
      idp_groups,
      invited_by,
      last_invited_at,
      created_at,
      updated_at,
      inviter:organization_members!organization_members_invited_by_fkey (
        user:users!organization_members_user_id_fkey (
          email,
          display_name
        )
      ),
      user:users!organization_members_user_id_fkey (
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        last_login_at,
        created_at,
        last_sso_login_at,
        last_sso_provider,
        is_managed
      )
    `)
    .eq('id', memberId)
    .eq('organization_id', currentMembership.organization_id)
    .single();

  if (error || !member) {
    return { notFound: true };
  }

  return {
    member,
    currentUserId: user.id,
    currentUserRole: currentMembership.role,
    organizationId: currentMembership.organization_id,
  };
}

export default async function UserDetailsPage({ params }: PageProps) {
  const data = await getUserDetails(params.id);

  if (!data) {
    redirect('/dashboard');
  }

  if ('notFound' in data) {
    notFound();
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <Link href="/dashboard" className="hover:text-gray-700">
              Dashboard
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/dashboard/users" className="hover:text-gray-700">
              Users
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900">
            {data.member.user?.display_name ||
              `${data.member.user?.first_name || ''} ${data.member.user?.last_name || ''}`.trim() ||
              data.member.invited_email ||
              'User Details'}
          </li>
        </ol>
      </nav>

      <UserDetailsCard
        member={data.member}
        currentUserId={data.currentUserId}
        currentUserRole={data.currentUserRole}
      />
    </div>
  );
}
```

### User Details Card Component

```typescript
// broker-portal/components/users/UserDetailsCard.tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import EditRoleModal from './EditRoleModal';
import DeactivateUserModal from './DeactivateUserModal';
import RemoveUserModal from './RemoveUserModal';

interface UserDetailsCardProps {
  member: OrganizationMember; // Full type from page
  currentUserId: string;
  currentUserRole: string;
}

export default function UserDetailsCard({
  member,
  currentUserId,
  currentUserRole,
}: UserDetailsCardProps) {
  const [showEditRole, setShowEditRole] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const isCurrentUser = member.user_id === currentUserId;
  const isPending = !member.user_id;
  const canManage = ['admin', 'it_admin'].includes(currentUserRole) && !isCurrentUser;

  const displayName = member.user?.display_name ||
    `${member.user?.first_name || ''} ${member.user?.last_name || ''}`.trim() ||
    member.invited_email ||
    'Pending User';

  const email = member.user?.email || member.invited_email || '';

  const roleColors = {
    admin: 'bg-purple-100 text-purple-800',
    it_admin: 'bg-blue-100 text-blue-800',
    broker: 'bg-green-100 text-green-800',
    agent: 'bg-gray-100 text-gray-800',
  };

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800',
  };

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
              {member.user?.avatar_url ? (
                <img
                  src={member.user.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <span className="text-gray-500 text-xl font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {displayName}
                {isCurrentUser && <span className="text-gray-500 ml-2">(You)</span>}
              </h1>
              <p className="text-gray-500">{email}</p>
              <div className="flex gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                  {member.role.replace('_', ' ')}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[member.license_status]}`}>
                  {isPending ? 'Invited' : member.license_status}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditRole(true)}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Change Role
              </button>
              {!isPending && (
                <button
                  onClick={() => setShowDeactivate(true)}
                  className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                  Deactivate
                </button>
              )}
              <button
                onClick={() => setShowRemove(true)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {isPending ? 'Revoke Invite' : 'Remove'}
              </button>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Membership Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Membership</h2>
            <dl className="space-y-2">
              {member.joined_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Joined</dt>
                  <dd className="text-sm text-gray-900">{new Date(member.joined_at).toLocaleDateString()}</dd>
                </div>
              )}
              {member.invited_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Invited</dt>
                  <dd className="text-sm text-gray-900">{new Date(member.invited_at).toLocaleDateString()}</dd>
                </div>
              )}
              {member.inviter?.user && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Invited by</dt>
                  <dd className="text-sm text-gray-900">
                    {member.inviter.user.display_name || member.inviter.user.email}
                  </dd>
                </div>
              )}
              {member.provisioned_by && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Added via</dt>
                  <dd className="text-sm text-gray-900 capitalize">{member.provisioned_by}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Activity Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Activity</h2>
            <dl className="space-y-2">
              {member.user?.last_login_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last login</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(member.user.last_login_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {member.user?.last_sso_provider && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last SSO provider</dt>
                  <dd className="text-sm text-gray-900 capitalize">{member.user.last_sso_provider}</dd>
                </div>
              )}
              {member.user?.is_managed && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Managed by IdP</dt>
                  <dd className="text-sm text-gray-900">Yes</dd>
                </div>
              )}
              {member.scim_synced_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last SCIM sync</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(member.scim_synced_at).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* IdP Groups (if any) */}
        {member.idp_groups && member.idp_groups.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">IdP Groups</h2>
            <div className="flex flex-wrap gap-2">
              {member.idp_groups.map((group) => (
                <span key={group} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                  {group}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <EditRoleModal
        isOpen={showEditRole}
        onClose={() => setShowEditRole(false)}
        memberId={member.id}
        memberName={displayName}
        currentRole={member.role}
        currentUserRole={currentUserRole as any}
      />
      <DeactivateUserModal
        isOpen={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        memberId={member.id}
        memberName={displayName}
      />
      <RemoveUserModal
        isOpen={showRemove}
        onClose={() => setShowRemove(false)}
        memberId={member.id}
        memberName={displayName}
        isPending={isPending}
      />
    </>
  );
}
```

### UserCard Link

```typescript
// Update UserCard.tsx to make name clickable:
<Link href={`/dashboard/users/${member.id}`}>
  <h3 className="text-sm font-medium text-gray-900 hover:text-indigo-600">
    {displayName}
  </h3>
</Link>
```

## Integration Notes

- Imports from: All previous user modals
- Exports to: Standalone page
- Used by: Admin clicking on user in list
- Depends on: TASK-1808, 1811, 1812 (modals and actions)

## Do / Don't

### Do:

- Reuse existing modals from previous tasks
- Show breadcrumb navigation
- Display SSO/SCIM fields conditionally (when present)
- Handle 404 for invalid member IDs

### Don't:

- Don't duplicate modal logic
- Don't show empty SSO fields if null
- Don't allow viewing users from other organizations
- Don't implement edit profile (users do that themselves)

## When to Stop and Ask

- If Supabase join for inviter fails
- If SSO columns from SPRINT-070 aren't present
- If unsure about what details to show
- If modals from previous tasks don't exist

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `UserDetailsCard.test.tsx`: Render with different states (pending, active, SSO)
  - Page-level: 404 handling, permission denied

### Coverage

- Coverage impact: Should maintain or improve coverage

### Integration / Feature Tests

- Manual test: Click user in list, view details
- Test action buttons work
- Test 404 for invalid ID

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add user details page`
- **Labels**: `broker-portal`, `ui`
- **Depends on**: TASK-1811, TASK-1812

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +10K |
| Files to modify | 2 files | +5K |
| Code volume | ~350 lines | +5K |
| Test complexity | Medium | +5K |

**Confidence:** Medium

**Risk factors:**
- Complex Supabase join for inviter
- SSO field availability

**Similar past tasks:** Submission detail page (~25K)

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
- [ ] broker-portal/app/dashboard/users/[id]/loading.tsx
- [ ] broker-portal/components/users/UserDetailsCard.tsx

Files modified:
- [ ] broker-portal/app/dashboard/users/[id]/page.tsx
- [ ] broker-portal/components/users/UserCard.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] User details page works
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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~25K | ~XK | +/-X% |
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
