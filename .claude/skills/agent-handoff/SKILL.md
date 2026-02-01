---
name: agent-handoff
description: Defines the 15-step sprint task workflow and handoff protocol between PM, Engineer, and SR Engineer agents.
---

# Agent Handoff Workflow

This skill defines how agents hand off work during sprint task execution. Read this before starting any sprint task work.

---

## Quick Reference: Who Am I? What's Next?

### PM Agent Steps
| Step | Action | Hand Off To |
|------|--------|-------------|
| 1 | Verify task file exists with context | - (abort if missing) |
| 2-4 | Setup (worktree, branch, status) | - |
| 5 | Task ready for planning | Engineer (plan mode) |
| 8 | Plan reviewed | Engineer (implement) or User (if rejected) |
| 11 | Implementation reviewed | SR Engineer (PR) or User (manual test) |
| 14 | Record effort metrics (sum agent sessions) | - |
| 15 | All tasks complete | Close sprint |

### Engineer Agent Steps
| Step | Action | Hand Off To |
|------|--------|-------------|
| 6 | Create/revise plan in plan mode | SR Engineer (plan review) |
| 9 | Implement, commit, push | SR Engineer (impl review) |
| 12 (CI fail) | Fix CI issues | SR Engineer (re-review) |

### SR Engineer Agent Steps
| Step | Action | Hand Off To |
|------|--------|-------------|
| 7 | Review plan | Engineer (changes) or PM (approved/rejected) |
| 10 | Review implementation | Engineer (changes) or PM (approved/rejected) |
| 12 | Create PR, wait CI, merge | Step 13 |
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

4.  PM: Update task status to "in_progress"
    - Update sprint file progress table
    - Update backlog CSV status column

5.  PM → ENGINEER: Handoff task for planning (plan mode)
    - Use handoff message template
    - Specify: Task ID, task file path, branch name

PHASE B: PLANNING
-----------------
6.  ENGINEER: Enter plan mode, create/revise plan
    - Read task file thoroughly
    - Explore codebase for context
    - Write plan to plan file
    - Exit plan mode → SR ENGINEER for review

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

8.  PM: Update backlog CSV + sprint docs
    ├─ If approved → ENGINEER: Start implementation (Step 9)
    │   - Update status to "implementing"
    │   - Handoff with approval context
    └─ If rejected → Notify user, END
        - Update status to "rejected"
        - Document reason in task file

PHASE C: IMPLEMENTATION
-----------------------
9.  ENGINEER: Implement task, commit changes, push branch
    - Follow the approved plan
    - Make atomic commits
    - Push branch to remote
    - → SR ENGINEER: Handoff for implementation review

10. SR ENGINEER: Review implementation
    ├─ Request changes → Step 9 (back to Engineer)
    │   - List specific changes needed
    │   - Use handoff message template
    ├─ Approve → Step 11
    │   - Confirm implementation matches plan
    │   - Handoff to PM
    └─ Reject → Step 11 (notify PM with rejected status)
        - Document rejection reason

11. PM: Update status
    ├─ No manual testing → SR ENGINEER: Create PR (Step 12)
    │   - Update status to "pr_pending"
    │   - Handoff to SR Engineer
    └─ Manual testing required → Notify user, wait
        - Update status to "testing"
        - Wait for user confirmation
        └─ Testing complete → SR ENGINEER: Step 12

PHASE D: MERGE & CLEANUP
------------------------
12. SR ENGINEER: Create PR + Merge
    - gh pr create --base develop
    - Wait for CI
    ├─ CI passes → Step 13
    ├─ CI fails → ENGINEER: Fix issues → Step 9
        - Identify failing tests/checks
        - Handoff to Engineer with details

13. SR ENGINEER: Delete worktree
    - git worktree remove ../Mad-TASK-XXXX
    - → PM: Task merged notification

14. PM: Record effort metrics
    - Read .claude/metrics/tokens.csv
    - Sum all agent sessions for this task (filter by task_id)
    - Update task file: ## Actual Effort section
    - Update sprint file progress table
    - Update backlog CSV actual_tokens column

15. PM: When ALL sprint tasks complete → Close sprint
    - Verify all tasks are complete
    - Update sprint status to "completed"
    - Generate sprint summary
    - Include total effort across all tasks
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

### At Step 12 (CI Status)
```
Did CI pass?
├─ Yes, all checks green
│   → Merge PR
│   → Proceed to Step 13
└─ No, checks failed
    → Identify failing checks
    → Handoff to Engineer (Step 9)
    → Include failure details
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

## Related Skills

- `.claude/skills/agentic-pm/SKILL.md` - PM responsibilities
- `.claude/skills/issue-log/SKILL.md` - Issue documentation
- `.claude/docs/shared/git-branching.md` - Git workflow
- `.claude/docs/shared/pr-lifecycle.md` - PR requirements
