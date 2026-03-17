# Task TASK-2190: Add Missing Audit Log Action Types

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

Add `log_admin_action` calls to admin RPCs that currently perform operations without audit logging. Four known missing action types: `user.delete` (account deletion), `organization.update` (org-level changes), `settings.update` (system config changes), and `data.export` (data exports). The goal is complete audit trail coverage for all admin operations.

## Non-Goals

- Do NOT modify the `log_admin_action` function signature
- Do NOT modify the `audit_logs` table schema
- Do NOT modify existing `log_admin_action` calls (that's TASK-2189)
- Do NOT modify any frontend code
- Do NOT touch support ticket RPCs

## Deliverables

1. New Supabase migration: add `log_admin_action` calls to RPCs that are missing them

## Investigation Phase (REQUIRED)

Before writing any code, the engineer MUST:

1. **Find all admin RPCs**: Search for functions prefixed with `admin_` in Supabase migrations
2. **Cross-reference with audit logging**: Check which RPCs already call `log_admin_action`
3. **Identify gaps**: List RPCs that perform state changes but don't log
4. **Prioritize**: Focus on the 4 known missing types first, then add any others discovered

### How to find gaps

```bash
# Find all admin RPCs
grep -r "CREATE.*FUNCTION admin_" supabase/migrations/ | grep -v "log_admin"

# Find which already log
grep -r "log_admin_action" supabase/migrations/ | grep -oP "admin_\w+"

# Compare the two lists to find gaps
```

### Known Missing Action Types

| Action Type | RPC(s) | Description |
|------------|--------|-------------|
| `user.delete` | `admin_delete_user` or similar | Account deletion — currently no audit trail |
| `organization.update` | `admin_update_organization` or similar | Org name, settings changes — untracked |
| `settings.update` | System config RPCs | Feature flags, config changes — untracked |
| `data.export` | Export-related RPCs | Data exports — untracked |

**Note:** Some of these RPCs may not exist yet or may have different names. The investigation phase will reveal the actual RPC names.

## File Boundaries

### Files to modify (owned by this task):

- `supabase/migrations/YYYYMMDD_add_missing_audit_log_actions.sql` (new migration)
  - Uses `CREATE OR REPLACE FUNCTION` for each RPC that needs audit logging added

### Files this task must NOT modify:

- Any files under `admin-portal/` or `broker-portal/`
- The `log_admin_action` function itself
- The `audit_logs` table schema
- Support ticket RPCs (`support_*`)
- RPCs that TASK-2189 is modifying (don't change existing calls, only add new ones)

## Acceptance Criteria

- [ ] All admin RPCs that perform state changes have `log_admin_action` calls
- [ ] New audit log entries use structured before/after payloads (following the pattern from TASK-2189 / license update RPCs)
- [ ] `user.delete` operations are logged with user details captured BEFORE deletion
- [ ] `organization.update` operations are logged with old and new values
- [ ] Any other discovered gaps are addressed
- [ ] Migration applies cleanly via Supabase MCP `apply_migration`
- [ ] All RPCs still function correctly after the migration
- [ ] No duplicate logging (don't add calls where they already exist)

## Implementation Notes

### Pattern to Follow

Use the standardized before/after payload pattern (same as TASK-2189 reference):

```sql
-- Capture old values BEFORE the change
SELECT name, settings INTO v_old_name, v_old_settings
FROM organizations WHERE id = p_org_id;

-- Perform the change
UPDATE organizations SET name = p_new_name WHERE id = p_org_id;

-- Log with before/after
PERFORM log_admin_action(
  v_admin_id,
  'organization.update',
  NULL,
  jsonb_build_object(
    'organization_id', p_org_id,
    'before', jsonb_build_object('name', v_old_name),
    'after', jsonb_build_object('name', p_new_name)
  )
);
```

### Special Case: user.delete

For deletions, capture ALL relevant user data before the DELETE:

```sql
-- Capture before deletion
SELECT id, email, full_name, role INTO v_user_data
FROM users WHERE id = p_user_id;

-- Perform deletion
DELETE FROM users WHERE id = p_user_id;

-- Log (no "after" — user is deleted)
PERFORM log_admin_action(
  v_admin_id,
  'user.delete',
  p_user_id,
  jsonb_build_object(
    'deleted_user', jsonb_build_object(
      'id', v_user_data.id,
      'email', v_user_data.email,
      'full_name', v_user_data.full_name,
      'role', v_user_data.role
    )
  )
);
```

### Merge Order Note

This task should ideally merge AFTER TASK-2189 so that new `log_admin_action` calls can follow the standardized payload format. If merging first, use the before/after pattern from the license update RPCs as reference.

## Sprint

SPRINT-134

## Backlog Items

BACKLOG-863

## Estimated Tokens

~15K

## Metrics

| Metric | Value |
|--------|-------|
| Planned tokens | 15000 |
| Actual tokens | - |
| Files changed | ~1 |
| Lines added | ~80 |
| Lines removed | ~5 |
