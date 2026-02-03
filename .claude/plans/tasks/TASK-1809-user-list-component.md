# Task TASK-1809: User List Component

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

Implement the main user list component that displays all organization members with search, filtering, and basic information. This is the primary view for user management.

## Non-Goals

- Do NOT implement invite functionality (TASK-1810)
- Do NOT implement role editing (TASK-1811)
- Do NOT implement deactivation (TASK-1812)
- Do NOT implement user details page (TASK-1813)
- Do NOT add SSO/SCIM indicators (future sprint)

## Deliverables

1. New file: `broker-portal/components/users/UserListClient.tsx`
2. New file: `broker-portal/components/users/UserCard.tsx`
3. New file: `broker-portal/components/users/UserSearchFilter.tsx`
4. Update: `broker-portal/app/dashboard/users/page.tsx` (integrate UserListClient)

## Acceptance Criteria

- [ ] User list displays all organization members
- [ ] Each user shows: name/email, role, status, joined date
- [ ] Search filters by name or email
- [ ] Filter by role (all, admin, broker, agent, it_admin)
- [ ] Filter by status (all, active, pending, suspended)
- [ ] Empty state shown when no users match filters
- [ ] Loading state while fetching
- [ ] Responsive layout (cards on mobile, table on desktop)
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

Follow existing `SubmissionListClient.tsx` patterns:

```typescript
// broker-portal/components/users/UserListClient.tsx
'use client';

import { useState, useMemo } from 'react';
import UserCard from './UserCard';
import UserSearchFilter from './UserSearchFilter';
import { EmptyState } from '@/components/ui/EmptyState';

interface OrganizationMember {
  id: string;
  user_id: string | null;
  role: 'agent' | 'broker' | 'admin' | 'it_admin';
  license_status: 'pending' | 'active' | 'suspended' | 'expired';
  invited_email: string | null;
  joined_at: string | null;
  invited_at: string | null;
  provisioned_by: string | null;
  user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    last_login_at: string | null;
  };
}

interface UserListClientProps {
  initialMembers: OrganizationMember[];
  currentUserId: string;
  currentUserRole: string;
}

export default function UserListClient({
  initialMembers,
  currentUserId,
  currentUserRole,
}: UserListClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredMembers = useMemo(() => {
    return initialMembers.filter((member) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const name = member.user?.display_name ||
        `${member.user?.first_name || ''} ${member.user?.last_name || ''}`.trim() ||
        member.invited_email || '';
      const email = member.user?.email || member.invited_email || '';

      const matchesSearch = !searchQuery ||
        name.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower);

      // Role filter
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;

      // Status filter
      const matchesStatus = statusFilter === 'all' || member.license_status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [initialMembers, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <UserSearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        roleFilter={roleFilter}
        onRoleChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {filteredMembers.length === 0 ? (
        <EmptyState
          title="No users found"
          description={searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
            ? "Try adjusting your filters"
            : "No users in this organization yet"}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <UserCard
              key={member.id}
              member={member}
              isCurrentUser={member.user_id === currentUserId}
              canManage={currentUserRole === 'admin' || currentUserRole === 'it_admin'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### User Card Component

```typescript
// broker-portal/components/users/UserCard.tsx
import { Card } from '@/components/ui/Card';

interface UserCardProps {
  member: OrganizationMember;
  isCurrentUser: boolean;
  canManage: boolean;
}

export default function UserCard({ member, isCurrentUser, canManage }: UserCardProps) {
  const displayName = member.user?.display_name ||
    `${member.user?.first_name || ''} ${member.user?.last_name || ''}`.trim() ||
    member.invited_email ||
    'Pending User';

  const email = member.user?.email || member.invited_email || '';
  const isPending = !member.user_id;

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
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
            {member.user?.avatar_url ? (
              <img
                src={member.user.avatar_url}
                alt={displayName}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <span className="text-gray-500 text-sm font-medium">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-900">{displayName}</h3>
              {isCurrentUser && (
                <span className="text-xs text-gray-500">(You)</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Role badge */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
          {member.role.replace('_', ' ')}
        </span>

        {/* Status badge */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[member.license_status]}`}>
          {isPending ? 'Invited' : member.license_status}
        </span>
      </div>

      {/* Dates */}
      <div className="mt-3 text-xs text-gray-500">
        {member.joined_at ? (
          <p>Joined {new Date(member.joined_at).toLocaleDateString()}</p>
        ) : (
          <p>Invited {new Date(member.invited_at!).toLocaleDateString()}</p>
        )}
      </div>

      {/* Actions placeholder - will be added in TASK-1811/1812 */}
      {canManage && !isCurrentUser && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            disabled
            className="text-sm text-gray-400 cursor-not-allowed"
          >
            Manage user...
          </button>
        </div>
      )}
    </Card>
  );
}
```

### Server-Side Data Fetching

Update the page to fetch and pass data:

```typescript
// broker-portal/app/dashboard/users/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UserListClient from '@/components/users/UserListClient';

async function getUsersData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get current user's membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['admin', 'it_admin'].includes(membership.role)) {
    return null;
  }

  // Get all members of the organization with user details
  const { data: members, error } = await supabase
    .from('organization_members')
    .select(`
      id,
      user_id,
      role,
      license_status,
      invited_email,
      joined_at,
      invited_at,
      provisioned_by,
      user:users!organization_members_user_id_fkey (
        id,
        email,
        first_name,
        last_name,
        display_name,
        avatar_url,
        last_login_at
      )
    `)
    .eq('organization_id', membership.organization_id)
    .order('joined_at', { ascending: false, nullsFirst: true });

  if (error) {
    console.error('Error fetching members:', error);
    return null;
  }

  return {
    members: members || [],
    currentUserId: user.id,
    currentUserRole: membership.role,
    organizationId: membership.organization_id,
  };
}

export default async function UsersPage() {
  const data = await getUsersData();

  if (!data) {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
        {/* Invite button will be added in TASK-1810 */}
      </div>

      <UserListClient
        initialMembers={data.members}
        currentUserId={data.currentUserId}
        currentUserRole={data.currentUserRole}
      />
    </div>
  );
}
```

## Integration Notes

- Imports from: `@/lib/supabase/server`, `@/components/ui/Card`, `@/components/ui/EmptyState`
- Exports to: Will be used by TASK-1810, 1811, 1812 for action buttons
- Used by: `broker-portal/app/dashboard/users/page.tsx`
- Depends on: TASK-1808 (route structure), TASK-1814 (server actions for data)

## Do / Don't

### Do:

- Follow existing component patterns from SubmissionListClient
- Use Supabase join syntax for related data
- Handle null user_id (pending invites)
- Make filters client-side for instant response
- Show "(You)" indicator for current user

### Don't:

- Don't add action buttons that work (use disabled placeholders)
- Don't implement pagination yet (can add if >50 users)
- Don't fetch data client-side (server components)
- Don't add real-time subscriptions yet

## When to Stop and Ask

- If the Supabase join syntax for users table doesn't work
- If organization_members doesn't have provisioned_by column (SPRINT-070 not complete)
- If Card or EmptyState components don't exist
- If unsure about role permission checks

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `UserListClient.test.tsx`: Filter logic tests
  - `UserCard.test.tsx`: Render with different states

### Coverage

- Coverage impact: Should add ~80% coverage for new components

### Integration / Feature Tests

- Manual verification of search and filter behavior
- Verify empty states display correctly

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add user list component with search and filter`
- **Labels**: `broker-portal`, `ui`
- **Depends on**: TASK-1808, TASK-1814

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new components | +15K |
| Files to modify | 1 file (page.tsx) | +5K |
| Code volume | ~400 lines | +5K |
| Test complexity | Medium | +5K |

**Confidence:** Medium

**Risk factors:**
- Supabase join syntax may need debugging
- UI polish iterations

**Similar past tasks:** BACKLOG-398 (Submission List) - similar component

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
- [ ] broker-portal/components/users/UserListClient.tsx
- [ ] broker-portal/components/users/UserCard.tsx
- [ ] broker-portal/components/users/UserSearchFilter.tsx

Files modified:
- [ ] broker-portal/app/dashboard/users/page.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] User list displays correctly
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
