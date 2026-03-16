# Task TASK-2191: Create pm_* Tables Migration

**Status:** Pending
**Backlog ID:** BACKLOG-954
**Sprint:** SPRINT-135
**Phase:** Phase 1 — Supabase Schema
**Branch From:** `feature/pm-module`
**Branch Into:** `feature/pm-module`
**Branch:** `feature/TASK-2191-pm-tables-migration`
**Estimated Tokens:** ~25K

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

## Objective

Create a Supabase migration file containing all ~14 `pm_*` tables with proper columns, data types, constraints, indexes, triggers, and foreign key relationships. This is the foundational schema for the entire PM module — every other task in SPRINT-135 depends on these tables.

---

## Context

The Keepr project currently tracks backlog items, sprints, tasks, and token metrics in flat CSV files under `.claude/plans/`. We are building an Azure DevOps Boards-inspired PM module in the admin portal backed by Supabase. This task creates the database layer.

**Reference plan:** `/Users/daniel/.claude/plans/ethereal-brewing-turing.md` (see "Phase 1: Supabase Schema" section)

**Pattern reference:** `supabase/migrations/20260313_support_schema.sql` — follow the same migration file structure (header comments, numbered sections, table-by-table creation)

---

## Requirements

### Must Do:

1. **Create migration file** `supabase/migrations/20260316_pm_schema.sql`

2. **Create all 14 tables** (in FK-dependency order):

   **a. `pm_projects`** — Group related work (initiatives/epics)
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - name TEXT NOT NULL
   - description TEXT
   - status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
   - owner_id UUID REFERENCES auth.users(id)
   - sort_order INT NOT NULL DEFAULT 0
   - deleted_at TIMESTAMPTZ  -- soft-delete
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

   **b. `pm_sprints`** — Sprint definitions
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - legacy_id TEXT UNIQUE  -- e.g., 'SPRINT-042'
   - name TEXT NOT NULL
   - goal TEXT
   - body TEXT  -- full markdown content from .md files
   - status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled'))
   - start_date DATE
   - end_date DATE
   - project_id UUID REFERENCES pm_projects(id)
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

   **c. `pm_backlog_items`** — All work items
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - legacy_id TEXT UNIQUE  -- e.g., 'BACKLOG-001'
   - item_number SERIAL  -- auto-incrementing display number
   - title TEXT NOT NULL
   - description TEXT
   - body TEXT  -- full markdown content from .md files
   - type TEXT NOT NULL DEFAULT 'feature' CHECK (type IN ('feature', 'bug', 'chore', 'spike', 'epic'))
   - area TEXT  -- e.g., 'admin-portal', 'desktop', 'service'
   - priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low'))
   - status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred', 'obsolete', 'reopened'))
   - sprint_id UUID REFERENCES pm_sprints(id)
   - project_id UUID REFERENCES pm_projects(id)
   - parent_id UUID REFERENCES pm_backlog_items(id)  -- hierarchy (Epic -> Feature -> Story)
   - assignee_id UUID REFERENCES auth.users(id)
   - est_tokens INT  -- normalized: ~30K -> 30000
   - actual_tokens INT
   - variance NUMERIC(8,2)  -- percentage: -72% -> -72.00
   - sort_order INT NOT NULL DEFAULT 0
   - start_date DATE
   - due_date DATE
   - search_vector TSVECTOR
   - deleted_at TIMESTAMPTZ  -- soft-delete
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - completed_at TIMESTAMPTZ
   - file TEXT  -- original .md filename reference
   ```

   **d. `pm_tasks`** — Sub-tasks within a sprint
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - legacy_id TEXT UNIQUE  -- e.g., 'TASK-2188'
   - title TEXT NOT NULL
   - description TEXT
   - body TEXT  -- full markdown content
   - status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'testing', 'completed', 'blocked', 'deferred'))
   - backlog_item_id UUID REFERENCES pm_backlog_items(id)
   - sprint_id UUID REFERENCES pm_sprints(id)
   - assignee_id UUID REFERENCES auth.users(id)
   - est_tokens INT
   - actual_tokens INT
   - sort_order INT NOT NULL DEFAULT 0
   - deleted_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - completed_at TIMESTAMPTZ
   ```

   **e. `pm_comments`** — Discussion comments on items/tasks
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - item_id UUID REFERENCES pm_backlog_items(id) ON DELETE CASCADE
   - task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE
   - author_id UUID REFERENCES auth.users(id)
   - body TEXT NOT NULL
   - deleted_at TIMESTAMPTZ
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   -- CHECK: exactly one of item_id or task_id must be set
   ```

   **f. `pm_events`** — Activity audit trail
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - item_id UUID REFERENCES pm_backlog_items(id) ON DELETE CASCADE
   - task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE
   - actor_id UUID REFERENCES auth.users(id)
   - event_type TEXT NOT NULL  -- e.g., 'status_changed', 'assigned', 'commented', 'priority_changed', 'sprint_changed', 'created', 'deleted'
   - old_value TEXT
   - new_value TEXT
   - metadata JSONB
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

   **g. `pm_task_links`** — Item relationships
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - source_id UUID NOT NULL REFERENCES pm_backlog_items(id) ON DELETE CASCADE
   - target_id UUID NOT NULL REFERENCES pm_backlog_items(id) ON DELETE CASCADE
   - link_type TEXT NOT NULL CHECK (link_type IN ('blocked_by', 'blocks', 'related_to', 'parent_child', 'duplicates'))
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - UNIQUE(source_id, target_id, link_type)
   ```

   **h. `pm_labels`** — Label/tag definitions
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - name TEXT NOT NULL
   - color TEXT NOT NULL DEFAULT '#6B7280'  -- gray default
   - project_id UUID REFERENCES pm_projects(id)  -- NULL = global
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - UNIQUE(name, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'))
   ```

   **i. `pm_item_labels`** — M:N join items to labels
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - item_id UUID NOT NULL REFERENCES pm_backlog_items(id) ON DELETE CASCADE
   - label_id UUID NOT NULL REFERENCES pm_labels(id) ON DELETE CASCADE
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - UNIQUE(item_id, label_id)
   ```

   **j. `pm_dependencies`** — Task dependency graph
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - source_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE
   - target_id UUID NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE
   - dependency_type TEXT NOT NULL DEFAULT 'depends_on' CHECK (dependency_type IN ('depends_on', 'blocks'))
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - UNIQUE(source_id, target_id)
   - CHECK(source_id != target_id)
   ```

   **k. `pm_attachments`** — File attachments on items
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - item_id UUID REFERENCES pm_backlog_items(id) ON DELETE CASCADE
   - task_id UUID REFERENCES pm_tasks(id) ON DELETE CASCADE
   - uploader_id UUID REFERENCES auth.users(id)
   - file_name TEXT NOT NULL
   - file_size INT NOT NULL
   - file_type TEXT NOT NULL
   - storage_path TEXT NOT NULL
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

   **l. `pm_saved_views`** — Saved filter configurations
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - name TEXT NOT NULL
   - user_id UUID NOT NULL REFERENCES auth.users(id)
   - filters JSONB NOT NULL DEFAULT '{}'
   - is_shared BOOLEAN NOT NULL DEFAULT false
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

   **m. `pm_token_metrics`** — Agent token usage tracking
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - legacy_id TEXT  -- original row reference
   - agent_id TEXT
   - agent_type TEXT  -- 'engineer', 'sr-engineer', 'pm', 'main'
   - task_id TEXT  -- e.g., 'TASK-2188'
   - description TEXT
   - input_tokens INT
   - output_tokens INT
   - total_tokens INT
   - cache_creation_tokens INT
   - cache_read_tokens INT
   - cost_usd NUMERIC(10,4)
   - duration_ms INT
   - api_calls INT
   - model TEXT
   - session_id TEXT
   - recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

   **n. `pm_changelog`** — Historical change log
   ```sql
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - legacy_id TEXT
   - change_date DATE
   - category TEXT
   - description TEXT NOT NULL
   - details TEXT
   - sprint_ref TEXT  -- e.g., 'SPRINT-042'
   - task_ref TEXT  -- e.g., 'TASK-2188'
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   ```

3. **Create indexes:**
   - `pm_backlog_items`: GIN index on `search_vector`, B-tree on `status`, `priority`, `sprint_id`, `project_id`, `parent_id`, `assignee_id`, `legacy_id`
   - `pm_tasks`: B-tree on `backlog_item_id`, `sprint_id`, `status`, `assignee_id`, `legacy_id`
   - `pm_comments`: B-tree on `item_id`, `task_id`
   - `pm_events`: B-tree on `item_id`, `task_id`, composite `(assignee_id, created_at)` for notifications query
   - `pm_token_metrics`: B-tree on `task_id`, `agent_id`, `recorded_at`
   - `pm_sprints`: B-tree on `legacy_id`, `status`
   - `pm_changelog`: B-tree on `change_date`, `sprint_ref`

4. **Create triggers:**
   - `updated_at` trigger on all tables that have `updated_at` (reuse the `set_updated_at()` trigger function if it exists, or create `pm_set_updated_at()`)
   - Search vector update trigger on `pm_backlog_items`: auto-update `search_vector` from `title`, `description`, `body` using `to_tsvector('english', ...)`
   - Auto-close trigger on `pm_tasks`: when a task is marked `completed`, check if ALL sibling tasks for the same `backlog_item_id` are `completed` -> auto-set the backlog item status to `completed`

5. **Apply the migration** using Supabase MCP `apply_migration`

### Must NOT Do:
- Do NOT create RLS policies (that's TASK-2192)
- Do NOT create RPCs (that's TASK-2193)
- Do NOT seed RBAC permissions (that's TASK-2194)
- Do NOT modify any existing tables (all `pm_*` tables are new)
- Do NOT add `ENABLE ROW LEVEL SECURITY` statements (TASK-2192 handles this)

---

## Acceptance Criteria

- [ ] Migration file `supabase/migrations/20260316_pm_schema.sql` exists and is valid SQL
- [ ] All 14 `pm_*` tables are created in Supabase (verify via `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pm_%'`)
- [ ] All indexes are created (verify via `SELECT indexname FROM pg_indexes WHERE tablename LIKE 'pm_%'`)
- [ ] `legacy_id` columns are UNIQUE indexed on `pm_backlog_items`, `pm_sprints`, `pm_tasks`
- [ ] `search_vector` GIN index exists on `pm_backlog_items`
- [ ] `updated_at` trigger fires on all applicable tables
- [ ] Search vector trigger auto-updates on `pm_backlog_items` INSERT/UPDATE
- [ ] Auto-close trigger works: setting all tasks for an item to `completed` auto-closes the item
- [ ] CHECK constraints enforce valid enum values for status, priority, type, etc.
- [ ] Self-referencing FK on `pm_backlog_items.parent_id` works (insert parent, then child)
- [ ] `pm_dependencies` CHECK prevents self-referencing (source_id != target_id)
- [ ] `pm_comments` CHECK ensures exactly one of item_id/task_id is set
- [ ] Migration applied via Supabase MCP without errors

---

## Files to Create

- `supabase/migrations/20260316_pm_schema.sql` — the complete tables migration

## Files to Read (for context)

- `supabase/migrations/20260313_support_schema.sql` — follow this exact pattern for migration file structure
- `/Users/daniel/.claude/plans/ethereal-brewing-turing.md` — master plan with all table specifications

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **Verification:** SQL migration applies cleanly via Supabase MCP

### CI Requirements
- [ ] Migration applies without errors
- [ ] Verify tables via `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pm_%'` (should return 14 rows)
- [ ] Verify indexes via `SELECT indexname FROM pg_indexes WHERE tablename LIKE 'pm_%'`
- [ ] Test auto-close trigger: insert a backlog item + 2 tasks, mark both tasks `completed`, verify item auto-transitions

---

## PR Preparation

- **Title:** `feat(pm): create pm_* tables schema migration`
- **Branch:** `feature/TASK-2191-pm-tables-migration`
- **Target:** `feature/pm-module`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-03-16*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from feature/pm-module
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Migration applies without errors
- [x] Tables verified in Supabase (14/14)
- [x] Indexes verified (47 total: 28 custom + 14 PKs + 5 unique constraints)
- [x] Triggers verified (9 total: 6 updated_at + 2 search vector + 1 auto-close)

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: No pm_* tables in Supabase
- **After**: 14 pm_* tables with 47 indexes, 9 triggers, CHECK constraints, FKs
- **Actual Tokens**: ~25K (Est: ~25K)
- **PR**: https://github.com/5hdaniel/Mad/pull/1168

### Verification Results

All acceptance criteria verified via Supabase MCP:

1. 14 tables created: pm_projects, pm_sprints, pm_backlog_items, pm_tasks, pm_comments, pm_events, pm_task_links, pm_labels, pm_item_labels, pm_dependencies, pm_attachments, pm_saved_views, pm_token_metrics, pm_changelog
2. GIN index on search_vector confirmed
3. UNIQUE indexes on legacy_id for pm_backlog_items, pm_sprints, pm_tasks confirmed
4. updated_at triggers fire on all 6 applicable tables
5. Search vector trigger auto-populates on INSERT/UPDATE (verified with test data)
6. Auto-close trigger: completing all tasks for an item auto-sets item to completed with completed_at timestamp
7. Self-referencing FK on parent_id works (Epic -> Feature hierarchy)
8. pm_dependencies CHECK prevents self-referencing (source_id != target_id)
9. pm_comments CHECK enforces exactly one of item_id/task_id
10. pm_labels unique index on (name, COALESCE(project_id, nil-uuid)) created
11. All test data cleaned up after verification

### Notes

**Deviations from plan:**
- pm_labels UNIQUE constraint: The task specified `UNIQUE(name, COALESCE(project_id, '00000000-...'))` as an inline table constraint, but PostgreSQL does not allow function expressions in inline UNIQUE constraints. Converted to `CREATE UNIQUE INDEX` instead -- functionally equivalent, enforces the same uniqueness rule.
- Reused existing `public.update_updated_at_column()` trigger function instead of creating a new `pm_set_updated_at()` -- the existing function does exactly `NEW.updated_at = now()` which is what we need.

**Issues encountered:**

### Issue #1: Inline UNIQUE with COALESCE expression
- **When:** First migration apply attempt
- **What happened:** `UNIQUE(name, COALESCE(project_id, '00000000-...'))` caused syntax error -- PostgreSQL does not support function expressions in inline UNIQUE constraints
- **Root cause:** SQL standard limitation; only column names allowed in inline UNIQUE
- **Resolution:** Changed to `CREATE UNIQUE INDEX idx_pm_labels_name_project ON pm_labels(name, COALESCE(...))` which supports expressions
- **Time spent:** ~2 minutes

---

## Guardrails

**STOP and ask PM if:**
- Any table definition in the plan seems ambiguous or contradictory
- You discover an existing `pm_*` table that would conflict
- The `set_updated_at()` trigger function doesn't exist and you need to create one
- The auto-close trigger logic is unclear
- Migration file exceeds ~500 lines (consider splitting, but ask first)
- You encounter blockers not covered in the task file
