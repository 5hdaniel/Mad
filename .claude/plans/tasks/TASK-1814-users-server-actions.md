# Task TASK-1814: Users List Server Actions

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

Create the foundational server actions directory and shared types for the user management feature. This establishes patterns that will be used by subsequent tasks.

## Non-Goals

- Do NOT implement invite, update, or delete actions (separate tasks)
- Do NOT implement any UI components
- Do NOT add user fetching logic (already in page.tsx)

## Deliverables

1. New file: `broker-portal/lib/actions/users.ts` (shared types and utilities)
2. New directory: `broker-portal/lib/actions/` (if doesn't exist)
3. New file: `broker-portal/lib/types/users.ts` (shared TypeScript types)

## Acceptance Criteria

- [ ] `lib/actions/` directory exists with proper structure
- [ ] `lib/types/users.ts` exports shared types for user management
- [ ] Types match Supabase schema (including SPRINT-070 SSO columns)
- [ ] Utility functions for common permission checks
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// broker-portal/lib/types/users.ts

export type Role = 'agent' | 'broker' | 'admin' | 'it_admin';

export type LicenseStatus = 'pending' | 'active' | 'suspended' | 'expired';

export type ProvisioningSource = 'manual' | 'scim' | 'jit' | 'invite';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  // SSO fields from SPRINT-070
  last_sso_login_at: string | null;
  last_sso_provider: string | null;
  is_managed: boolean;
  scim_external_id: string | null;
  sso_only: boolean;
  jit_provisioned: boolean;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  role: Role;
  license_status: LicenseStatus;
  invited_email: string | null;
  invitation_token: string | null;
  invitation_expires_at: string | null;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  last_invited_at: string | null;
  created_at: string;
  updated_at: string;
  // SPRINT-070 provisioning fields
  provisioned_by: ProvisioningSource | null;
  provisioned_at: string | null;
  scim_synced_at: string | null;
  provisioning_metadata: Record<string, unknown> | null;
  idp_groups: string[] | null;
  group_sync_enabled: boolean;
  // Joined data
  user?: User;
}

export interface OrganizationMemberWithInviter extends OrganizationMember {
  inviter?: {
    user?: Pick<User, 'email' | 'display_name'>;
  };
}

export interface UserActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export const ADMIN_ROLES: Role[] = ['admin', 'it_admin'];

export const ASSIGNABLE_ROLES_BY_ADMIN: Role[] = ['agent', 'broker', 'admin'];
export const ASSIGNABLE_ROLES_BY_IT_ADMIN: Role[] = ['agent', 'broker', 'admin', 'it_admin'];
```

### Shared Utilities

```typescript
// broker-portal/lib/actions/users.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { Role, OrganizationMember, ADMIN_ROLES } from '@/lib/types/users';

/**
 * Get the current user's membership and verify they have admin access
 */
export async function getCurrentUserMembership(organizationId?: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated', membership: null };
  }

  const query = supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, license_status')
    .eq('user_id', user.id);

  if (organizationId) {
    query.eq('organization_id', organizationId);
  }

  const { data: membership, error } = await query.maybeSingle();

  if (error || !membership) {
    return { error: 'Membership not found', membership: null };
  }

  return { error: null, membership, userId: user.id };
}

/**
 * Check if the current user can manage members
 */
export async function canManageMembers(organizationId: string): Promise<boolean> {
  const result = await getCurrentUserMembership(organizationId);
  if (result.error || !result.membership) {
    return false;
  }
  return ['admin', 'it_admin'].includes(result.membership.role);
}

/**
 * Check if removing/demoting a member would leave no admins
 */
export async function wouldRemoveLastAdmin(
  memberId: string,
  organizationId: string,
  action: 'demote' | 'remove' | 'deactivate'
): Promise<boolean> {
  const supabase = await createClient();

  // Get the target member's current role
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('role, license_status')
    .eq('id', memberId)
    .single();

  if (!targetMember) {
    return false; // Member doesn't exist, not our problem
  }

  // Only check if target is currently an admin
  if (!['admin', 'it_admin'].includes(targetMember.role)) {
    return false;
  }

  // Count remaining active admins (excluding target)
  const { count } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('role', ['admin', 'it_admin'])
    .eq('license_status', 'active')
    .neq('id', memberId);

  return (count || 0) === 0;
}

/**
 * Get roles that can be assigned by the current user
 */
export function getAssignableRoles(currentUserRole: Role): Role[] {
  if (currentUserRole === 'it_admin') {
    return ['agent', 'broker', 'admin', 'it_admin'];
  }
  if (currentUserRole === 'admin') {
    return ['agent', 'broker', 'admin'];
  }
  return [];
}

/**
 * Format a user's display name from various fields
 */
export function formatUserDisplayName(
  user: { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null,
  fallbackEmail?: string | null
): string {
  if (user?.display_name) {
    return user.display_name;
  }

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  return fallbackEmail || 'Unknown User';
}
```

### Directory Structure

```
broker-portal/lib/
├── actions/
│   ├── users.ts          # Shared utilities (this task)
│   ├── inviteUser.ts     # TASK-1810
│   ├── updateUserRole.ts # TASK-1811
│   ├── deactivateUser.ts # TASK-1812
│   └── removeUser.ts     # TASK-1812
└── types/
    └── users.ts          # Shared types (this task)
```

## Integration Notes

- Imports from: `@/lib/supabase/server`
- Exports to: All user management tasks (1810, 1811, 1812, 1813)
- Used by: All server actions and components
- Depends on: TASK-1808 (route exists), SPRINT-070 (SSO columns)

## Do / Don't

### Do:

- Export types that match Supabase schema exactly
- Include all SSO/SCIM columns from SPRINT-070
- Create reusable utility functions
- Use 'use server' directive in actions file

### Don't:

- Don't implement full CRUD actions (separate tasks)
- Don't add UI code
- Don't duplicate Supabase types (reference schema)
- Don't add complex business logic (keep utilities simple)

## When to Stop and Ask

- If SSO columns from SPRINT-070 don't exist in schema
- If lib/actions directory structure differs
- If unsure about type definitions
- If createClient function signature differs

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `users.test.ts`: Test utility functions (wouldRemoveLastAdmin, getAssignableRoles)
  - `formatUserDisplayName.test.ts`: Test name formatting edge cases

### Coverage

- Coverage impact: New files should have >80% coverage

### Integration / Feature Tests

- Not required - these are foundational utilities

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add user management types and utilities`
- **Labels**: `broker-portal`, `service`
- **Depends on**: TASK-1808

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files | +8K |
| Files to modify | 0 | 0 |
| Code volume | ~200 lines | +4K |
| Test complexity | Low (utilities) | +3K |

**Confidence:** High

**Risk factors:**
- None significant - straightforward types and utilities

**Similar past tasks:** Type definition tasks (~10K)

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
- [ ] broker-portal/lib/types/users.ts
- [ ] broker-portal/lib/actions/users.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Types match Supabase schema
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
