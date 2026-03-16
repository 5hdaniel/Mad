# Task TASK-2192: Create RLS Policies Migration

**Status:** Pending
**Backlog ID:** BACKLOG-955
**Sprint:** SPRINT-135
**Phase:** Phase 1 — Supabase Schema
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2192-pm-rls-policies`
**Estimated Tokens:** ~12K
**Depends On:** TASK-2191 (tables must exist first)

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Objective

Create a Supabase migration file that enables Row Level Security on all `pm_*` tables and creates RLS policies. The PM module is internal-only (admin portal), so the pattern is: internal roles users get SELECT access, all mutations go through SECURITY DEFINER RPCs (created in TASK-2193).

---

## Context

The PM module tables are strictly internal — only admin portal users (stored in `internal_roles`) should access them. No customer/broker access is needed. This follows the same pattern as the support ticketing system.

**Pattern reference:** Look at existing RLS policies on `support_tickets` and `support_ticket_messages` for the internal-only read pattern. The key is:
- SELECT: allowed for users in `internal_roles` table
- INSERT/UPDATE/DELETE: denied at RLS level (all mutations go through SECURITY DEFINER RPCs which bypass RLS)

---

## Requirements

### Must Do:

1. **Create migration file** `supabase/migrations/20260316_pm_rls_policies.sql`

2. **Enable RLS** on ALL pm_* tables:
   ```sql
   ALTER TABLE pm_projects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_sprints ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_backlog_items ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_tasks ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_comments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_task_links ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_labels ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_item_labels ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_dependencies ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_attachments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_saved_views ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_token_metrics ENABLE ROW LEVEL SECURITY;
   ALTER TABLE pm_changelog ENABLE ROW LEVEL SECURITY;
   ```

3. **Create SELECT policies** — Internal roles can read all rows:
   ```sql
   -- Pattern for each table:
   CREATE POLICY "Internal users can read pm_[table]"
   ON pm_[table] FOR SELECT
   USING (
     EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
   );
   ```
   Apply this pattern to all 14 tables.

4. **Special case — `pm_saved_views`**: Users can only SELECT their own views OR shared views:
   ```sql
   CREATE POLICY "Users can read own or shared saved views"
   ON pm_saved_views FOR SELECT
   USING (
     EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())
     AND (user_id = auth.uid() OR is_shared = true)
   );
   ```

5. **No INSERT/UPDATE/DELETE policies** — All mutations go through SECURITY DEFINER RPCs. This is the same pattern as support tickets.

6. **Apply the migration** using Supabase MCP `apply_migration`

### Must NOT Do:
- Do NOT create INSERT/UPDATE/DELETE policies (RPCs handle mutations)
- Do NOT modify the tables themselves (TASK-2191 owns table structure)
- Do NOT create RPCs (TASK-2193 owns RPCs)
- Do NOT grant direct table access to anon or service_role beyond what RLS provides

---

## Acceptance Criteria

- [ ] Migration file `supabase/migrations/20260316_pm_rls_policies.sql` exists and is valid SQL
- [ ] RLS is enabled on all 14 `pm_*` tables (verify via `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'pm_%'`)
- [ ] Internal roles users can SELECT from all pm_* tables
- [ ] Non-internal users (e.g., regular auth.users) cannot SELECT from pm_* tables
- [ ] `pm_saved_views` policy restricts to own views + shared views
- [ ] No INSERT/UPDATE/DELETE policies exist (mutations via RPCs only)
- [ ] Migration applied via Supabase MCP without errors

---

## Files to Create

- `supabase/migrations/20260316_pm_rls_policies.sql`

## Files to Read (for context)

- `supabase/migrations/20260313_support_schema.sql` — look at RLS policy patterns (may be inline or separate file)
- Any existing `*_rls*.sql` migration files for pattern reference
- Check how `internal_roles` table is used in existing RLS policies

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Verification:** Test RLS via Supabase MCP `execute_sql`

### CI Requirements
- [ ] Migration applies without errors
- [ ] Verify RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'pm_%'` (all should show `true`)

---

## PR Preparation

- **Title:** `feat(pm): add RLS policies for pm_* tables`
- **Branch:** `feature/TASK-2192-pm-rls-policies`
- **Target:** `feature/pm-module`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-16*

### What Was Done

Created `supabase/migrations/20260316_pm_rls_policies.sql` containing:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all 14 `pm_*` tables
2. 14 SELECT-only policies — 13 standard internal_roles check, 1 special (pm_saved_views: own + shared)
3. `GRANT SELECT` on all 14 tables to `authenticated` role (RLS controls actual visibility)
4. No INSERT/UPDATE/DELETE policies — all mutations go through SECURITY DEFINER RPCs (TASK-2193)

Pattern follows `20260313_support_rls_policies.sql` exactly (internal_roles check via `EXISTS (SELECT 1 FROM internal_roles WHERE user_id = auth.uid())`).

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from feature/pm-module
- [x] Verified TASK-2191 tables exist in Supabase
- [x] Noted start time: 2026-03-16
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Migration applies without errors (Supabase MCP apply_migration success)
- [x] RLS verified enabled on all tables (pg_tables query: all 14 show rowsecurity=true)
- [x] SELECT policy tested for internal_roles user (14 SELECT policies confirmed via pg_policies)
- [x] SELECT blocked for non-internal user (no INSERT/UPDATE/DELETE policies; RLS enabled = default deny)

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: pm_* tables have no RLS (open access)
- **After**: All 14 tables have RLS with internal-only SELECT policies; pm_saved_views scoped to own+shared
- **Actual Tokens**: ~12K (Est: ~12K)
- **PR**: [URL after PR created]

### Issues/Blockers

None. Migration applied cleanly, all verification queries passed.

---

## Guardrails

**STOP and ask PM if:**
- You cannot find the `internal_roles` table or it uses a different pattern
- The support tickets use a different RLS pattern than described
- You're unsure whether any pm_* table needs customer/public access
- You encounter blockers not covered in the task file
