---
name: agent-handoff
description: Defines the 15-step sprint task workflow and handoff protocol between PM, Engineer, and SR Engineer agents.
---

# Agent Handoff Workflow

This skill defines how agents hand off work during sprint task execution. Read this before starting any sprint task work.

---

## Quick Reference: Who Am I? What's Next?

### PM Agent Steps
| Step | Action | Status Update | Hand Off To |
|------|--------|---------------|-------------|
| 1 | Verify task file exists with context | — | - (abort if missing) |
| 2-4 | Setup (worktree, branch, status) | CSV + Sprint → `In Progress` | - |
| 5 | Task ready for planning | — | Engineer (read-only exploration) |
| 8 | Plan reviewed | Sprint notes: "Plan approved" | Engineer (implement) or User (if rejected) |
| 11 | Implementation reviewed | CSV + Sprint → `Testing` | SR Engineer (create PR) |
| 14 | After PR merged | CSV + Sprint → `Completed` | Record effort metrics |
| 15 | All tasks complete | Sprint → `Completed` | Close sprint |

**Status updates at every transition (in order):**
1. Supabase RPC: `pm_update_item_status('<uuid>', '<status>')` — source of truth
2. `.claude/plans/sprints/SPRINT-XXX.md` — In-Scope table Status column
3. `.claude/plans/backlog/items/BACKLOG-XXX.md` — if detail file exists, update status there too
4. (Optional) `.claude/plans/backlog/data/backlog.csv` — backward compatibility

**Valid statuses (Supabase):** `pending`, `in_progress`, `testing`, `completed`, `deferred`

### Engineer Agent Steps
| Step | Action | Hand Off To |
|------|--------|-------------|
| 6 | Explore codebase (read-only), write plan | SR Engineer (plan review) |
| 9 | Implement, commit, push | SR Engineer (impl review) |
| 12 (CI fail) | Fix CI issues | SR Engineer (re-review) |

### SR Engineer Agent Steps
| Step | Action | Hand Off To |
|------|--------|-------------|
| 7 | Review plan | Engineer (changes) or PM (approved/rejected) |
| 10 | Review implementation | Engineer (changes) or PM (approved/rejected) |
| 12 | Create PR, review, wait CI (DO NOT MERGE) | User (testing gate) |
| 12a | **User tests and approves** | SR Engineer (merge) |
| 12b | Merge PR (only after user approval) | Step 13 |
| 13 | Delete worktree | PM (record metrics) |

---

## Full Workflow (15 Steps)

```
Sprint Task Lifecycle
=====================

PHASE A: SETUP (PM)
-------------------
1.  PM: Verify task file exists with proper context
    - Read task file from .claude/plans/tasks/TASK-XXXX-*.md
    - Confirm it has: requirements, acceptance criteria, dependencies
    - If missing or incomplete: STOP, notify user

2.  PM: Create worktree (if parallel tasks in phase)
    - git worktree add ../Mad-TASK-XXXX -b feature/TASK-XXXX develop

3.  PM: Create branch for task
    - If worktree: already created in step 2
    - If sequential: git checkout -b feature/TASK-XXXX develop

4.  PM: Update task status to "In Progress"
    - Update Supabase via RPC: `SELECT pm_update_item_status('<uuid>', 'in_progress');`
    - Update sprint file In-Scope table: Status → `In Progress`
    - (Optional) Update backlog CSV status column → `In Progress`
    - Valid statuses: pending, in_progress, testing, completed, deferred

5.  PM → ENGINEER: Handoff task for planning (read-only exploration)
    - Use handoff message template
    - Specify: Task ID, task file path, branch name
    - Instruct engineer: "Plan only — explore codebase, write plan, do NOT edit production files"

PHASE B: PLANNING
-----------------
6.  ENGINEER: Explore codebase and create implementation plan
    - Read task file thoroughly
    - Use Glob, Grep, Read tools to explore relevant code (read-only)
    - Write implementation plan to task file or plan file
    - Do NOT edit production files — planning phase is read-only
    - Return plan → SR ENGINEER for review
    NOTE: Do NOT use EnterPlanMode — it requires interactive user approval
    and does not work inside subagent context. Instead, exercise discipline:
    read and plan only, save implementation for Step 9.

7.  SR ENGINEER: Review plan
    ├─ Request changes → Step 6 (back to Engineer)
    │   - Specify what needs to change
    │   - Use handoff message template
    ├─ Approve → Write approval to plan file → Step 8
    │   - Add "## Approval" section to plan file
    │   - Handoff to PM
    └─ Reject → Step 8 (with rejected status)
        - Document rejection reason
        - Handoff to PM

8.  PM: Update Supabase + sprint docs
    ├─ If approved → ENGINEER: Start implementation (Step 9)
    │   - Status stays `in_progress` (plan approved, implementation starting)
    │   - Update sprint file notes: "Plan approved, implementing"
    │   - Handoff with approval context
    └─ If rejected → Notify user, END
        - Update Supabase: `SELECT pm_update_item_status('<uuid>', 'deferred');`
        - (Optional) Update backlog CSV status → `Deferred`
        - Document reason in task file

PHASE C: IMPLEMENTATION
-----------------------
9.  ENGINEER: Implement task, commit changes, push branch
    - Follow the approved plan
    - Make atomic commits
    - Push branch to remote
    - Engineer MUST include `### Effort` section in handoff message
      with agent_id and token count. The agent_id is returned by
      the Task tool when the agent completes.
    - → SR ENGINEER: Handoff for implementation review

10. SR ENGINEER: Review implementation
    ├─ Request changes → Step 9 (back to Engineer)
    │   - List specific changes needed
    │   - Use handoff message template
    ├─ Approve → Step 11
    │   - Confirm implementation matches plan
    │   - SR Engineer MUST include own `### Effort` section in handoff
    │   - Handoff to PM
    └─ Reject → Step 11 (notify PM with rejected status)
        - Document rejection reason

11. PM: Update status
    - Update Supabase: `SELECT pm_update_item_status('<uuid>', 'testing');`
    - Update sprint file In-Scope table: Status → `Testing`
    - (Optional) Update backlog CSV status → `Testing`
    - → SR ENGINEER: Create PR (Step 12)

PHASE D: PR, TEST & MERGE
--------------------------
12. SR ENGINEER: Create PR + Review (DO NOT MERGE)
    - gh pr create --base develop
    - Review code quality, security, architecture
    - Wait for CI
    ├─ CI passes → Step 12a
    ├─ CI fails → ENGINEER: Fix issues → Step 9
        - Identify failing tests/checks
        - Handoff to Engineer with details

    *** MANDATORY: NEVER merge without explicit user approval ***

12a. USER TESTING GATE (MANDATORY)
    - Notify user: PR is ready for testing
    - Provide: PR URL, branch name, what to test
    - User tests on the branch (git checkout <branch> && npm run dev)
    - WAIT for user confirmation before proceeding
    ├─ User approves → Step 12b
    ├─ User finds issues → ENGINEER: Fix issues → Step 9
    └─ User requests changes → ENGINEER: Make changes → Step 9

12b. SR ENGINEER: Merge PR (only after user approval)
    - gh pr merge <PR> --merge
    - Verify merge succeeded
    - SR Engineer MUST include own `### Effort` section in handoff to PM
    - If fix agents were spawned for CI failures, include those agent_ids too
    - → Step 13

13. SR ENGINEER: Delete worktree
    - git worktree remove ../Mad-TASK-XXXX
    - → PM: Task merged notification

14. PM: Record effort metrics + mark Completed
    - Update Supabase: `SELECT pm_update_item_status('<uuid>', 'completed');`
    - Update sprint file In-Scope table: Status → `Completed`
    - (Optional) Update backlog CSV status → `Completed`
    - Collect agent_ids from ALL handoff messages for this task
    - Label each agent entry in tokens.csv:
      python .claude/skills/log-metrics/log_metrics.py \
        --label --agent-id <ID> -t <type> -i TASK-XXXX -d "<desc>"
    - Aggregate totals:
      python .claude/skills/log-metrics/sum_effort.py --task TASK-XXXX --pretty
    - Copy aggregated totals to task file `## Actual Effort` section
    - Update sprint file In-Scope table `Actual Tokens` column
    - Collect issues from handoff messages → sprint file `## Issues Summary`

15. PM: When ALL sprint tasks complete → Close sprint
    - Verify all tasks are complete
    - Aggregate all task metrics for the sprint:
      python .claude/skills/log-metrics/sum_effort.py --task TASK-XXXX --pretty
      (repeat for each task)
    - Populate sprint file `## Sprint Retrospective` section:
      - Estimation accuracy table (est vs actual per task)
      - Issues summary (aggregated from all task handoffs)
      - What went well / didn't / lessons learned
    - Create sprint rollup PR (sprint/* → develop) with
      `## Engineer Metrics` section populated from aggregated data
      (this passes the CI pr-metrics-check)
    - Include Agent ID, Total Tokens, Duration, Variance in PR body
    - Update sprint status to "completed"
```

---

## Handoff Message Template

Every handoff MUST use this format:

```markdown
## Handoff: [FROM_AGENT] → [TO_AGENT]

**Task:** TASK-XXXX
**Current Step:** X
**Status:** [approved/rejected/changes-requested/complete]
**Next Action:** [what the receiving agent should do]
**Context:** [any relevant info - branch, PR, blockers]
**Issues/Blockers:** [problems encountered, workarounds used, or "None"]
```

See `templates/handoff-message.template.md` for the full template.

---

## Decision Trees

### At Step 7 (Plan Review)
```
Is the plan complete and correct?
├─ Yes, fully approved
│   → Write approval to plan file
│   → Handoff to PM (Step 8, approved)
├─ Mostly good, minor changes needed
│   → List specific changes
│   → Handoff to Engineer (Step 6)
└─ Fundamentally flawed or out of scope
    → Document rejection reason
    → Handoff to PM (Step 8, rejected)
```

### At Step 10 (Implementation Review)
```
Does implementation match the approved plan?
├─ Yes, all requirements met
│   → Handoff to PM (Step 11, approved)
├─ Partially complete, changes needed
│   → List specific changes
│   → Handoff to Engineer (Step 9)
└─ Does not meet requirements
    → Document rejection reason
    → Handoff to PM (Step 11, rejected)
```

### At Step 12 (PR + CI)
```
Did CI pass?
├─ Yes, all checks green
│   → Notify user: PR ready for testing
│   → DO NOT MERGE — wait for user approval (Step 12a)
└─ No, checks failed
    → Identify failing checks
    → Handoff to Engineer (Step 9)
    → Include failure details
```

### At Step 12a (User Testing Gate)
```
*** MANDATORY — NEVER skip this step ***

Has the user explicitly approved the merge?
├─ Yes, user says "merge it" / "looks good" / "approved"
│   → SR Engineer merges PR (Step 12b)
│   → Proceed to Step 13
├─ User found issues
│   → Handoff to Engineer (Step 9)
│   → Include user's feedback
└─ User hasn't responded yet
    → WAIT — do not proceed
    → Never auto-merge on timeout
```

---

## Issue Documentation

**MANDATORY:** Before every handoff, document any issues encountered.

Reference: `.claude/skills/issue-log/SKILL.md`

If nothing went wrong, explicitly state in handoff:
```
**Issues/Blockers:** None
```

---

## Supabase RPC Quick Reference

All status updates should use Supabase RPCs via the `mcp__supabase__execute_sql` tool:

```sql
-- Update item status (Steps 4, 8, 11, 14)
SELECT pm_update_item_status('<uuid>', 'in_progress');

-- Look up item by legacy ID to get UUID
SELECT pm_get_item_by_legacy_id('BACKLOG-746');

-- Query metrics (alternative to CSV, Step 14)
SELECT * FROM pm_token_metrics WHERE task_id = 'TASK-1234';
```

---

## Mandatory Supabase Updates

At each step below, the responsible agent MUST run these SQL commands via `mcp__supabase__execute_sql`.

### Step 1: Resolve Task UUID
```sql
SELECT pm_get_task_by_legacy_id('TASK-XXXX');
-- Returns: {"id": "<uuid>", "status": "pending", "backlog_item_id": "<uuid>", "sprint_id": "<uuid>"}
-- Save the task UUID and backlog_item_id for all subsequent calls
```

### Step 4: PM marks task In Progress
```sql
SELECT pm_update_task_status('<task_uuid>', 'in_progress');
SELECT pm_update_item_status('<backlog_item_uuid>', 'in_progress');
```

### Step 5: PM handoff comment
```sql
SELECT pm_add_comment('<backlog_item_uuid>', 'Handed off to Engineer for planning');
```

### Step 8 (Approved): PM updates status
```sql
SELECT pm_add_comment('<backlog_item_uuid>', 'Plan approved, starting implementation');
```

### Step 8 (Rejected): PM defers task
```sql
SELECT pm_update_task_status('<task_uuid>', 'deferred');
SELECT pm_update_item_status('<backlog_item_uuid>', 'deferred');
```

### Step 11: PM marks Testing (PR created)
```sql
SELECT pm_update_task_status('<task_uuid>', 'testing');
SELECT pm_update_item_status('<backlog_item_uuid>', 'testing');
```

### Step 14: PM marks Completed + Records Tokens
```sql
SELECT pm_update_task_status('<task_uuid>', 'completed');
SELECT pm_record_task_tokens(
  '<task_uuid>',
  <total_actual_tokens>,
  '<engineer_agent_id>',
  'engineer',
  <input_tokens>, <output_tokens>, <cache_read>, <cache_create>,
  <duration_ms>, <api_calls>, '<session_id>'
);
```

### Step 15: PM closes sprint (if all tasks done)
```sql
SELECT pm_update_sprint_status('<sprint_uuid>', 'completed');
```

---

## Related Skills

- `.claude/skills/agentic-pm/SKILL.md` - PM responsibilities
- `.claude/skills/issue-log/SKILL.md` - Issue documentation
- `.claude/skills/log-metrics/SKILL.md` - Metrics scripts (Step 14)
- `.claude/docs/shared/git-branching.md` - Git workflow
- `.claude/docs/shared/pr-lifecycle.md` - PR requirements
