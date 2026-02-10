# Task TASK-1925: Create `jit_join_organization` RPC

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

---

## Goal

Create a new Supabase RPC function `jit_join_organization` that allows an authenticated Azure AD user from a KNOWN tenant to automatically join the existing organization with the org's `default_member_role`. This replaces the current behavior where ALL Azure users are auto-provisioned as IT admins in potentially new duplicate organizations.

**Prerequisite (SR Review Finding):** Before creating the RPC, a migration must fix the `member` role constraint mismatch. See "Prerequisite Migration" section below.

## Non-Goals

- Do NOT modify the login callback route (that is TASK-1926)
- Do NOT modify the `auto_provision_it_admin` RPC (it stays for the `/setup` flow)
- Do NOT implement admin consent flow (Phase 2)
- Do NOT handle Google Workspace tenants in this RPC
- Do NOT implement SCIM provisioning logic

## Deliverables

1. **Prerequisite migration:** Fix `member` role constraint mismatch (see below)
2. **New Supabase migration:** `jit_join_organization` RPC function (with unique constraint on `organization_members`)
3. RLS policy for the RPC (if needed beyond `SECURITY DEFINER`)

## Acceptance Criteria

### Prerequisite Migration (SR Review Finding)
- [ ] `organizations.default_member_role` default changed from `'member'` to `'agent'`
- [ ] Any existing rows with `default_member_role = 'member'` updated to `'agent'`
- [ ] Unique constraint added on `organization_members(user_id, organization_id)` to prevent duplicates at DB level

### JIT Join RPC
- [ ] `jit_join_organization(p_tenant_id TEXT)` RPC function exists in Supabase
- [ ] When called with a known `microsoft_tenant_id`, it returns `{success: true, organization_id, role}`
- [ ] When called with an unknown tenant, it returns `{success: false, error: 'org_not_found'}`
- [ ] Consumer tenant ID (`9188040d-6c67-4c5b-b112-36a304b66dad`) is rejected with `{success: false, error: 'consumer_tenant'}` (defense-in-depth)
- [ ] Creates `organization_members` record with `default_member_role` from org (or 'agent' fallback)
- [ ] Creates/upserts `users` record with `provisioning_source='jit'`, `jit_provisioned=true`
- [ ] Sets `provisioned_by='jit'` and `provisioned_at=NOW()` on the membership
- [ ] Idempotent: calling twice for same user+org does not create duplicate membership
- [ ] Uses `SECURITY DEFINER` with `search_path = public, auth` (same pattern as `auto_provision_it_admin`)
- [ ] Migration applies cleanly via `supabase db push` or MCP apply_migration
- [ ] All CI checks pass

## Implementation Notes

### Prerequisite Migration: Fix Member Role Constraint (SR Review Finding)

**Problem:** `organizations.default_member_role` defaults to `'member'`, but `organization_members.role` check constraint only allows `agent`, `broker`, `admin`, `it_admin`. If JIT join uses the default, the INSERT into `organization_members` will fail.

**Solution:** Apply this migration BEFORE creating the RPC:

```sql
-- Fix: Change default_member_role from 'member' to 'agent'
-- 'member' is not a valid role in organization_members and is not used anywhere
ALTER TABLE public.organizations
  ALTER COLUMN default_member_role SET DEFAULT 'agent';

-- Update any existing rows that have the old default
UPDATE public.organizations
  SET default_member_role = 'agent'
  WHERE default_member_role = 'member';
```

**Decision Reference:** Sprint Decision #4

### Unique Constraint on organization_members (SR Review Finding)

Add a unique constraint to prevent duplicate memberships at the database level (defense-in-depth beyond the RPC's idempotency check):

```sql
-- Prevent duplicate org memberships at DB level
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_user_org_unique
  UNIQUE (user_id, organization_id);
```

**Note:** If there are existing duplicates, they must be cleaned up before adding the constraint. Check first:
```sql
SELECT user_id, organization_id, COUNT(*)
FROM organization_members
GROUP BY user_id, organization_id
HAVING COUNT(*) > 1;
```

### Consumer Tenant ID Check (SR Review Finding)

Add a defense-in-depth check to reject the Microsoft consumer tenant ID (`9188040d-6c67-4c5b-b112-36a304b66dad`). This tenant is for personal Microsoft accounts (Outlook.com, Hotmail) and should never match a valid organization.

Add this check early in the RPC, before the organization lookup:

```sql
-- Block consumer tenant (personal Microsoft accounts)
IF p_tenant_id = '9188040d-6c67-4c5b-b112-36a304b66dad' THEN
  RETURN jsonb_build_object('success', false, 'error', 'consumer_tenant');
END IF;
```

### RPC Function Specification

```sql
CREATE OR REPLACE FUNCTION public.jit_join_organization(p_tenant_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_oauth_id TEXT;
  v_org_id UUID;
  v_org_role TEXT;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Look up organization by microsoft_tenant_id
  SELECT id, COALESCE(default_member_role, 'agent')
  INTO v_org_id, v_org_role
  FROM organizations
  WHERE microsoft_tenant_id = p_tenant_id;

  -- If org not found, return error (caller should redirect to error page)
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'org_not_found');
  END IF;

  -- Get user email with fallback chain (same as auto_provision_it_admin)
  SELECT
    COALESCE(
      email,
      raw_user_meta_data->>'email',
      raw_user_meta_data->>'mail',
      raw_user_meta_data->>'preferred_username'
    ),
    COALESCE(raw_user_meta_data->>'provider_id', id::text)
  INTO v_user_email, v_oauth_id
  FROM auth.users
  WHERE id = v_user_id;

  -- Ensure user exists in public.users table
  INSERT INTO users (id, email, oauth_provider, oauth_id, provisioning_source, jit_provisioned, jit_provisioned_at)
  VALUES (v_user_id, v_user_email, 'azure', v_oauth_id, 'jit', true, NOW())
  ON CONFLICT (id) DO UPDATE SET
    provisioning_source = CASE
      WHEN users.provisioning_source = 'manual' THEN 'jit'
      ELSE users.provisioning_source
    END,
    jit_provisioned = true,
    jit_provisioned_at = COALESCE(users.jit_provisioned_at, NOW());

  -- Check if membership already exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = v_user_id AND organization_id = v_org_id
  ) THEN
    -- Already a member, just return success
    RETURN jsonb_build_object(
      'success', true,
      'organization_id', v_org_id,
      'role', (SELECT role FROM organization_members WHERE user_id = v_user_id AND organization_id = v_org_id),
      'already_member', true
    );
  END IF;

  -- Create membership with org's default role
  INSERT INTO organization_members (
    organization_id, user_id, role, joined_at,
    license_status, provisioned_by, provisioned_at
  )
  VALUES (
    v_org_id, v_user_id, v_org_role, NOW(),
    'active', 'jit', NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'role', v_org_role,
    'already_member', false
  );
END;
$$;
```

### Key Patterns

- Follow the same `SECURITY DEFINER` + `search_path` pattern as `auto_provision_it_admin`
- Use the same email fallback chain (COALESCE) as `auto_provision_it_admin`
- Return structured JSONB for the caller to interpret

### Important Details

- The `default_member_role` column on `organizations` already exists. **After prerequisite migration**, default will be `'agent'` (changed from `'member'`).
- Fallback to `'agent'` if `default_member_role` is NULL (most orgs will have agents, not generic members)
- The `provisioning_source` check constraint on `users` allows: `manual`, `scim`, `jit`, `invite`
- The `provisioned_by` check constraint on `organization_members` allows: `manual`, `scim`, `jit`, `invite`
- **Unique constraint** on `organization_members(user_id, organization_id)` will be added (prerequisite migration) for DB-level duplicate prevention

## Integration Notes

- **Used by:** TASK-1926 (login callback will call this RPC)
- **No shared files** with any other task
- **Schema dependencies:** Uses existing columns from SPRINT-070 migrations (all deployed)

## Do / Don't

### Do:
- Use `SECURITY DEFINER` so the anon user can read `organizations` table
- Use `ON CONFLICT` for idempotent user upsert
- Return structured error codes (not just error messages) for the caller
- Follow the existing RPC pattern from `auto_provision_it_admin`

### Don't:
- Do NOT create a new org if tenant not found (that is the bug we are fixing)
- Do NOT assign `it_admin` or `admin` role -- use `default_member_role`
- Do NOT modify the `auto_provision_it_admin` function
- Do NOT add any UI changes

## When to Stop and Ask

- If `default_member_role` column does not exist on `organizations` (it should)
- If `provisioning_source` check constraint does not include `jit` (it should)
- If migration conflicts with existing migrations
- If you are unsure about the email fallback chain behavior

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (RPC tested via Supabase SQL; manual verification)
- Future: Integration tests with mock Supabase client

### Coverage

- Coverage impact: No code coverage change (SQL migration only)

### Integration / Feature Tests

- Required scenarios (verify via Supabase SQL after migration):
  1. Call `jit_join_organization` with a known tenant ID -> success with role
  2. Call `jit_join_organization` with an unknown tenant ID -> `org_not_found`
  3. Call twice for same user+org -> second call returns `already_member: true`

### CI Requirements

This task's PR MUST pass:
- [ ] Migration applies cleanly
- [ ] Type checking (no broker-portal changes, but verify)
- [ ] Lint passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(db): add jit_join_organization RPC for tenant-aware auto-join`
- **Labels**: `database`, `auth`
- **Depends on**: None (first task in sprint)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 migration files (prerequisite + RPC) | +8K |
| Code volume | ~120 lines SQL (prerequisite + RPC + constraint) | +7K |
| Complexity | Low-Medium (follows existing RPC pattern + prerequisite migration) | +5K |
| Test complexity | Low (SQL verification only) | +5K |

**Confidence:** High

**Risk factors:**
- Migration numbering conflict (low risk)
- Existing duplicate memberships may block unique constraint (check first)

**Similar past tasks:** TASK-1804 through TASK-1807 (schema migrations, actual ~3-5K each)

**Scope increase (SR Review):** +5K for prerequisite migration (member role fix, unique constraint, consumer tenant check)

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
- [ ] Supabase migration: prerequisite fix (member role default + unique constraint)
- [ ] Supabase migration for jit_join_organization RPC

Features implemented:
- [ ] Prerequisite: default_member_role changed from 'member' to 'agent'
- [ ] Prerequisite: existing 'member' rows updated to 'agent'
- [ ] Prerequisite: unique constraint on organization_members(user_id, organization_id)
- [ ] jit_join_organization RPC function
- [ ] Consumer tenant ID check (defense-in-depth)
- [ ] Known tenant -> join with default_member_role
- [ ] Unknown tenant -> return org_not_found error
- [ ] Idempotent (no duplicate memberships)

Verification:
- [ ] Migration applies cleanly
- [ ] npm run type-check passes
- [ ] npm run lint passes
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
| **Tokens** | ~20K | ~XK | +/-X% |
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
**Merged To:** project/org-setup-bulletproof

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
