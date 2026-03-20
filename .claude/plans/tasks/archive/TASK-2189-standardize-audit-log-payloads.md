# Task TASK-2189: Standardize Audit Log Before/After Payloads

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

Standardize all existing `log_admin_action` calls in Supabase admin RPCs to include structured `before` and `after` payloads for complete change tracking. Currently some RPCs (like license updates) include proper before/after data, while others (role updates, user suspension) only capture partial context. All admin audit log entries should follow the same pattern for consistent audit trail.

## Non-Goals

- Do NOT add `log_admin_action` calls to RPCs that don't already have them — that's TASK-2190
- Do NOT modify the `log_admin_action` function signature itself
- Do NOT modify the `audit_logs` table schema
- Do NOT modify any frontend code (admin portal or broker portal)
- Do NOT touch support ticket RPCs

## Deliverables

1. New Supabase migration: standardize before/after payloads in existing `log_admin_action` calls

## Investigation Phase (REQUIRED)

Before writing any code, the engineer MUST:

1. **Find the reference pattern**: Search for `log_admin_action` calls that include `before` and `after` payloads (license update RPCs are the known good example)
2. **Audit all existing calls**: Find every `log_admin_action` call across all Supabase RPCs
3. **Identify gaps**: List which calls are missing structured before/after data
4. **Plan changes**: Document which RPCs need updating and what before/after data to capture

### How to find RPCs

```bash
# Find all log_admin_action calls
grep -r "log_admin_action" supabase/migrations/

# Find the reference pattern (license updates)
grep -r "log_admin_action" supabase/migrations/ -A 10 | grep -i "license\|before\|after"
```

## File Boundaries

### Files to modify (owned by this task):

- `supabase/migrations/YYYYMMDD_standardize_audit_log_payloads.sql` (new migration)
  - This migration should use `CREATE OR REPLACE FUNCTION` for each RPC that needs updating

### Files this task must NOT modify:

- Any files under `admin-portal/` or `broker-portal/`
- The `log_admin_action` function itself
- The `audit_logs` table schema
- Support ticket RPCs (`support_*`)

## Acceptance Criteria

- [ ] All existing `log_admin_action` calls include structured `before` and `after` payloads
- [ ] Payload format follows the license update pattern (JSON with field names and values)
- [ ] Role updates capture: old role name -> new role name, old permissions -> new permissions
- [ ] User suspension captures: old status -> new status, user email, reason
- [ ] User updates capture: all changed fields with old and new values
- [ ] Organization updates capture: old values -> new values for changed fields
- [ ] No existing audit log data is lost or corrupted (migration only affects future entries)
- [ ] Migration applies cleanly via Supabase MCP `apply_migration`
- [ ] All RPCs still function correctly after the migration

## Implementation Notes

### Reference Pattern (License Updates — the gold standard)

Look for RPCs like `admin_update_license` that do something like:

```sql
PERFORM log_admin_action(
  v_admin_id,
  'license.update',
  p_target_user_id,
  jsonb_build_object(
    'before', jsonb_build_object(
      'plan', v_old_plan,
      'seats', v_old_seats,
      'status', v_old_status
    ),
    'after', jsonb_build_object(
      'plan', p_new_plan,
      'seats', p_new_seats,
      'status', p_new_status
    )
  )
);
```

### Common Gap Pattern

RPCs that only capture partial data:

```sql
-- BAD: only captures new value
PERFORM log_admin_action(v_admin_id, 'role.update', NULL,
  jsonb_build_object('role_name', p_new_name));

-- GOOD: captures before and after
PERFORM log_admin_action(v_admin_id, 'role.update', NULL,
  jsonb_build_object(
    'before', jsonb_build_object('role_name', v_old_name, 'permissions', v_old_permissions),
    'after', jsonb_build_object('role_name', p_new_name, 'permissions', p_new_permissions)
  ));
```

### Approach

1. For each RPC with `log_admin_action`: capture the old values into variables BEFORE the UPDATE/DELETE
2. Pass both old and new values in the payload
3. Use `CREATE OR REPLACE FUNCTION` so the migration updates the RPCs in place

## Sprint

SPRINT-134

## Backlog Items

BACKLOG-862

## Estimated Tokens

~15K

## Metrics

| Metric | Value |
|--------|-------|
| Planned tokens | 15000 |
| Actual tokens | - |
| Files changed | ~1 |
| Lines added | ~100 |
| Lines removed | ~30 |
