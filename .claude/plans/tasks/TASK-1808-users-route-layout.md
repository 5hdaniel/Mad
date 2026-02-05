# Task TASK-1808: Users Management Route & Layout

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

Create the route structure and navigation for the Users Management section in the broker portal. This establishes the foundation for all user management features.

## Non-Goals

- Do NOT implement the actual user list component (TASK-1809)
- Do NOT implement any modals (TASK-1810, 1811)
- Do NOT implement server actions (TASK-1814)
- Do NOT add SSO configuration UI

## Deliverables

1. New file: `broker-portal/app/dashboard/users/page.tsx`
2. New file: `broker-portal/app/dashboard/users/loading.tsx`
3. New file: `broker-portal/app/dashboard/users/[id]/page.tsx` (placeholder)
4. Update: `broker-portal/app/dashboard/layout.tsx` (add Users nav link)

## Acceptance Criteria

- [x] `/dashboard/users` route exists and is accessible
- [x] Navigation shows "Users" link in header (only for admin/it_admin roles)
- [x] Loading skeleton displays while page loads
- [x] Page shows placeholder content "Users Management Coming Soon"
- [x] `/dashboard/users/[id]` route exists with placeholder
- [x] Non-admin users redirected or shown access denied
- [x] All CI checks pass

## Implementation Notes

### Key Patterns

Follow existing patterns from `broker-portal/app/dashboard/submissions/`:

```typescript
// broker-portal/app/dashboard/users/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function checkUserAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { allowed: false, reason: 'unauthenticated' };

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Only admin and it_admin can access
  const allowedRoles = ['admin', 'it_admin'];
  if (!membership || !allowedRoles.includes(membership.role)) {
    return { allowed: false, reason: 'unauthorized' };
  }

  return { allowed: true, organizationId: membership.organization_id, role: membership.role };
}

export default async function UsersPage() {
  const access = await checkUserAccess();

  if (!access.allowed) {
    redirect('/dashboard');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users Management</h1>
      <p className="text-gray-500">Users list will be displayed here.</p>
      {/* UserListClient will be added in TASK-1809 */}
    </div>
  );
}
```

### Navigation Update

Update `broker-portal/app/dashboard/layout.tsx` to conditionally show Users link:

```typescript
// Add to the nav links section, after Submissions
{(user.role === 'admin' || user.role === 'it_admin') && (
  <Link
    href="/dashboard/users"
    className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
  >
    Users
  </Link>
)}
```

### Loading Skeleton

```typescript
// broker-portal/app/dashboard/users/loading.tsx
import { Skeleton } from '@/components/ui/Skeleton';

export default function UsersLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
```

## Integration Notes

- Imports from: `@/lib/supabase/server`, `@/components/ui/Skeleton`
- Exports to: Will be consumed by TASK-1809 (UserListClient)
- Used by: All subsequent users management tasks
- Depends on: None (first task in sprint)

## Do / Don't

### Do:

- Follow existing broker portal patterns exactly
- Use server components for initial render
- Check role permissions on every page load
- Use Tailwind classes consistent with existing UI

### Don't:

- Don't add client-side state management yet
- Don't implement actual user fetching (placeholder only)
- Don't create any server actions (TASK-1814)
- Don't add any modals

## When to Stop and Ask

- If the existing layout structure is significantly different than documented
- If role-based routing patterns don't exist in the codebase
- If `@/lib/supabase/server` doesn't export `createClient`
- If unsure about redirect behavior for unauthorized users

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (page components, minimal logic)
- This is a structural task - testing will be added with TASK-1814

### Coverage

- Coverage impact: Not applicable (Next.js pages not typically unit tested)

### Integration / Feature Tests

- Manual verification that routes load correctly
- Verify role-based navigation visibility

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (existing)
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds (`npm run build` in broker-portal)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(broker-portal): add users management route structure`
- **Labels**: `broker-portal`, `ui`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~20K

**Token Cap:** 80K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 3 new files | +10K |
| Files to modify | 1 file (layout.tsx) | +5K |
| Code volume | ~150 lines | +5K |
| Test complexity | None | 0 |

**Confidence:** High

**Risk factors:**
- None significant - follows existing patterns

**Similar past tasks:** BACKLOG-398 (Portal Dashboard) - similar route setup

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
- [ ] broker-portal/app/dashboard/users/page.tsx
- [ ] broker-portal/app/dashboard/users/loading.tsx
- [ ] broker-portal/app/dashboard/users/[id]/page.tsx

Files modified:
- [ ] broker-portal/app/dashboard/layout.tsx

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm run build passes (in broker-portal)
- [ ] Routes accessible at /dashboard/users
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
