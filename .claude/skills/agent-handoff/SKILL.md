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
| 5 | Task ready for planning | — | Engineer (plan mode) |
| 8 | Plan reviewed | Sprint notes: "Plan approved" | Engineer (implement) or User (if rejected) |
| 11 | Implementation reviewed | CSV + Sprint → `Testing` | SR Engineer (create PR) |
| 14 | After PR merged | CSV + Sprint → `Completed` | Record effort metrics |
| 15 | All tasks complete | Sprint → `Completed` | Close sprint |

**Status update files:** `.claude/plans/sprints/SPRINT-XXX.md` + `.claude/plans/backlog/data/backlog.csv`
**Valid CSV statuses:** `Pending`, `In Progress`, `Testing`, `Completed`, `Deferred`

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
    - Update sprint file In-Scope table: Status → `In Progress`
    - Update backlog CSV status column → `In Progress`
    - Files: `.claude/plans/sprints/SPRINT-XXX.md` + `.claude/plans/backlog/data/backlog.csv`
    - Valid CSV statuses: Pending, In Progress, Testing, Completed, Deferred

5.  PM → ENGINEER: Handoff task for planning (plan mode)
    - Use handoff message template
    - Specify: Task ID, task file path, branch name
    - Instruct engineer to use plan mode (EnterPlanMode) before implementation

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
    │   - Status stays `In Progress` (plan approved, implementation starting)
    │   - Update sprint file notes: "Plan approved, implementing"
    │   - Handoff with approval context
    └─ If rejected → Notify user, END
        - Update backlog CSV status → `Deferred`
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
    - Update backlog CSV status → `Testing`
    - Update sprint file In-Scope table: Status → `Testing`
    - Files: `.claude/plans/sprints/SPRINT-XXX.md` + `.claude/plans/backlog/data/backlog.csv`
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
    - → Step 13

13. SR ENGINEER: Delete worktree
    - git worktree remove ../Mad-TASK-XXXX
    - → PM: Task merged notification

14. PM: Record effort metrics + mark Completed
    - Update backlog CSV status → `Completed`
    - Update sprint file In-Scope table: Status → `Completed`
    - Run: `python .claude/skills/log-metrics/sum_effort.py --task TASK-XXXX`
    - Copy output totals to task file `## Actual Effort` section
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

## Related Skills

- `.claude/skills/agentic-pm/SKILL.md` - PM responsibilities
- `.claude/skills/issue-log/SKILL.md` - Issue documentation
- `.claude/skills/log-metrics/SKILL.md` - Metrics scripts (Step 14)
- `.claude/docs/shared/git-branching.md` - Git workflow
- `.claude/docs/shared/pr-lifecycle.md` - PR requirements
