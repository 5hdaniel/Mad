# Task TASK-2037: Fix Supabase RLS Policies on users/licenses/devices

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

Replace the overly permissive `FOR ALL USING (true)` RLS policies on the `users`, `licenses`, and `devices` Supabase tables with proper policies that scope access to the authenticated user's own data. This is a **P0 SECURITY** issue -- any authenticated user can currently read/write ALL rows in these tables.

## Non-Goals

- Do NOT modify RLS policies on other tables (organizations, transactions, etc.)
- Do NOT change the application code that queries these tables
- Do NOT modify the Supabase client configuration
- Do NOT add new tables or columns
- Do NOT change the authentication flow

## Deliverables

1. New Supabase SQL migration file (in the project's migration directory or applied via Supabase dashboard)
2. Documentation of the old and new policies

## Acceptance Criteria

- [ ] `users` table: Authenticated users can only SELECT/UPDATE their own row (matched by `auth.uid()`)
- [ ] `licenses` table: Authenticated users can only SELECT licenses associated with their user/organization
- [ ] `devices` table: Authenticated users can only SELECT/INSERT/UPDATE/DELETE their own devices (matched by `user_id = auth.uid()`)
- [ ] No `FOR ALL USING (true)` policies remain on these three tables
- [ ] Existing application functionality still works (user can read own profile, see own license, manage own devices)
- [ ] Migration is reversible (includes rollback SQL)
- [ ] Policy changes tested via Supabase dashboard SQL editor

## Implementation Notes

### Step 1: Audit Current Policies

First, check what policies currently exist:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('users', 'licenses', 'devices');
```

### Step 2: Understand Table Schemas

Check how each table relates to the authenticated user:

```sql
-- Check users table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';

-- Check licenses table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'licenses';

-- Check devices table structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'devices';
```

### Step 3: Write New Policies

Example patterns (adapt to actual schema):

```sql
-- USERS table: Users can only access their own row
DROP POLICY IF EXISTS "users_all_policy" ON users;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DEVICES table: Users can only access their own devices
DROP POLICY IF EXISTS "devices_all_policy" ON devices;

CREATE POLICY "devices_select_own" ON devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "devices_insert_own" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_update_own" ON devices
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_delete_own" ON devices
  FOR DELETE USING (auth.uid() = user_id);

-- LICENSES table: Depends on schema -- may need org-based access
-- If licenses have a user_id column:
CREATE POLICY "licenses_select_own" ON licenses
  FOR SELECT USING (auth.uid() = user_id);

-- If licenses are org-based, join through org membership:
CREATE POLICY "licenses_select_org" ON licenses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

### Step 4: Include Rollback SQL

```sql
-- Rollback: Restore original permissive policies (for emergency revert)
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_all_policy" ON users FOR ALL USING (true);
-- ... etc for other tables
```

### Key Patterns

- Always use `auth.uid()` to identify the current user
- Separate policies for SELECT, INSERT, UPDATE, DELETE (more granular than FOR ALL)
- Use `WITH CHECK` on INSERT and UPDATE to prevent users from assigning rows to other users
- For org-based access, join through the `organization_members` table

## Integration Notes

- This is a SQL-only change; no TypeScript files are modified
- The app's Supabase client already uses RLS-aware queries (it sends the auth token)
- No other SPRINT-091 tasks touch Supabase configuration
- Related: TASK-1164 (previous RLS audit task)

## Do / Don't

### Do:
- Audit current policies before changing anything
- Test each policy individually using the Supabase SQL editor
- Include rollback SQL in the migration
- Verify the app still works after applying policies
- Use separate policies per operation (SELECT, INSERT, UPDATE, DELETE) for clarity

### Don't:
- Use `FOR ALL` policies (too broad, defeats the purpose)
- Assume table schemas -- verify column names first
- Modify policies on tables not listed (users, licenses, devices)
- Remove RLS entirely (it should stay enabled with proper policies)
- Forget `WITH CHECK` on INSERT/UPDATE policies

## When to Stop and Ask

- If the `users` table uses a column other than `id` for the user's auth ID
- If the `licenses` table has no clear user/org relationship column
- If there are service_role operations that depend on the permissive policies
- If you find other tables with `FOR ALL USING (true)` -- report them but do not fix (out of scope)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (SQL migration, no TypeScript changes)

### Coverage

- Coverage impact: None

### Integration / Feature Tests

- Required scenarios:
  - User can read their own profile from `users` table
  - User cannot read another user's profile
  - User can see their own license(s)
  - User can register/update/delete their own devices
  - User cannot see/modify another user's devices

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (existing, no new ones)
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): scope RLS policies on users/licenses/devices to own data`
- **Labels**: `security`, `P0`, `supabase`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Tables to audit | 3 | +10K |
| Policies to write | ~10-12 individual policies | +15K |
| Testing/verification | SQL editor testing | +10K |
| Rollback SQL | Reverse migration | +5K |

**Confidence:** Medium

**Risk factors:**
- License table schema may be more complex (org-based access)
- Service role operations may depend on permissive policies
- Need to understand the full data model before writing policies

**Similar past tasks:** TASK-1164 (RLS audit) -- related but this task is the implementation.

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
- [ ] Migration SQL file

Features implemented:
- [ ] users table RLS policies
- [ ] licenses table RLS policies
- [ ] devices table RLS policies
- [ ] Rollback SQL

Verification:
- [ ] All policies tested via Supabase SQL editor
- [ ] App can read/write own data
- [ ] App cannot access other users' data
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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
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
