---
name: sprint-close
description: Close a sprint by aggregating metrics, collecting lessons learned from all tasks, populating the retrospective, and creating the rollup PR. Designed to run as a background agent so the user can keep working.
---

# Sprint Close Skill

Close a completed sprint by aggregating metrics, collecting lessons/insights from all task handoffs, populating the retrospective section, and creating the rollup PR.

**Designed for background execution** — the PM should invoke this as a background agent so the user can continue other work.

---

## When to Use

- All tasks in the sprint are completed and PRs merged
- PM is at Step 15 of the agent-handoff workflow
- User says "close the sprint" or PM determines all tasks are done

## How the PM Should Invoke This

```
Agent(
  subagent_type="general-purpose",
  description="Close SPRINT-XXX",
  prompt="Run /sprint-close for SPRINT-XXX. Sprint file: .claude/plans/sprints/SPRINT-XXX-slug.md",
  run_in_background=true
)
```

---

## Sprint Close Checklist (Execute in Order)

### Phase 1: Verification (BLOCKING — stop if any fail)

1. **Verify all PRs are merged**
   ```bash
   gh pr list --state open --search "TASK-"
   gh pr list --state open --search "SPRINT-"
   ```
   If any sprint-related PRs are open → STOP, report to PM.

2. **Verify all tasks are complete**
   - Read the sprint file's In-Scope table
   - Check each task's status in backlog CSV
   - If any task is not `Completed` → STOP, report to PM.

### Phase 2: Metrics Collection

3. **Label all agent metrics**
   - Read each task file in the sprint
   - Find all Agent IDs from `### Agent ID` sections (Engineer + SR)
   - Label each in tokens.csv:
     ```bash
     python .claude/skills/log-metrics/log_metrics.py \
       --label --agent-id <ID> -t <type> -i TASK-XXXX -d "<desc>"
     ```

4. **Aggregate per-task totals**
   ```bash
   python .claude/skills/log-metrics/sum_effort.py --task TASK-XXXX --pretty
   ```
   Record results for each task.

5. **Build estimation accuracy table**
   | Task | Est Tokens | Actual Tokens | Variance | Notes |
   |------|-----------|---------------|----------|-------|

### Phase 3: Lessons & Insights Collection (THE KEY STEP)

6. **Read every task file** in the sprint and extract:
   - `**Issues encountered:**` from Engineer's Implementation Summary
   - `**Lessons / Insights:**` from Engineer's Implementation Summary
   - `**Lessons / Insights:**` from SR Engineer Review section
   - `**Review Notes:**` from SR Engineer Review section (for architectural insights)

7. **Read all handoff messages** referenced in the sprint (if available in task files)
   - Extract `### Issues/Blockers` sections
   - Extract `### Lessons / Insights` sections

8. **Categorize collected insights** into:
   - **Estimation insights** — what made estimates accurate or inaccurate
   - **Architecture insights** — patterns validated, decisions that should be repeated or avoided
   - **Process insights** — workflow improvements, things that slowed down or sped up work
   - **Codebase insights** — areas of unexpected complexity, patterns discovered
   - **Tooling insights** — CI, testing, or build system observations

### Phase 4: Retrospective Population

9. **Populate the sprint file `## Sprint Retrospective` section**

   Use this structure:

   ```markdown
   ## Sprint Retrospective

   ### Estimation Accuracy
   | Task | Est Tokens | Actual Tokens | Variance | Notes |
   |------|-----------|---------------|----------|-------|
   | TASK-XXXX | ~XK | ~YK | +/-X% | <note> |

   ### Issues Encountered
   | # | Task | Issue | Severity | Resolution | Time Impact |
   |---|------|-------|----------|------------|-------------|
   | 1 | TASK-XXXX | <issue> | <severity> | <resolution> | <time> |

   ### Lessons Learned

   #### What Went Well
   - <aggregated from task insights — things that worked>

   #### What Didn't Go Well
   - <aggregated from task issues — things that caused problems>

   #### Estimation Insights
   - <patterns in estimate accuracy — which categories were over/under>

   #### Architecture & Codebase Insights
   - <architectural patterns validated or reversed, codebase discoveries>

   #### Process Improvements
   - <workflow observations, things to change for next sprint>

   #### Recommendations for Next Sprint
   - <actionable items based on the above>
   ```

10. **If no insights were captured in task files** (legacy tasks without the new fields):
    - Note this gap in the retrospective
    - Derive what you can from the code diff, PR descriptions, and issues
    - Add a note: "Lessons collection was limited — task files did not include Lessons/Insights sections"

### Phase 5: Systemic Lessons → Memory

11. **Evaluate if any lessons are systemic** (would help future sprints, not just this one)
    - Check if a similar lesson already exists in MEMORY.md
    - If a new systemic lesson is identified:
      - Create a memory file in `/Users/daniel/.claude/projects/-Users-daniel-Documents-Mad/memory/`
      - Add it to MEMORY.md
    - Examples of systemic lessons:
      - "Refactor tasks consistently come in at 0.5x estimate" → update estimation guidance
      - "Handler files over 1500 lines always need splitting" → architecture guardrail
      - "Parallel tasks touching the same service layer cause conflicts" → parallel safety rule

### Phase 6: Sprint Rollup PR

12. **Update sprint status**
    - Sprint file status → `Completed`
    - All backlog CSV entries → `Completed`
    - All backlog item detail files → `Completed`

13. **Clean up worktrees**
    ```bash
    git worktree list
    # Remove any sprint-related worktrees
    git worktree prune
    ```

14. **Create sprint rollup PR** (if sprint used an integration branch)
    - PR from `int/sprint-XXX-*` → `develop`
    - Include `## Engineer Metrics` section (required by CI)
    - Include sprint retrospective summary in PR body

15. **Final report**
    - Output a summary of:
      - Tasks completed and PRs merged
      - Total tokens (est vs actual)
      - Top 3 lessons learned
      - Any items escalated to backlog or memory

---

## Output Format

When complete, report back to PM with:

```markdown
## Sprint Close Complete: SPRINT-XXX

### Summary
- **Tasks:** X completed, X PRs merged
- **Tokens:** Est ~XK vs Actual ~YK (X% variance)
- **Rollup PR:** #XXX (if applicable)

### Top Lessons Learned
1. <most impactful lesson>
2. <second most impactful>
3. <third most impactful>

### Memory Updates
- <new memory file created, if any>
- <existing memory updated, if any>
- None (if no systemic lessons)

### Issues for Attention
- <any unresolved items, if any>
- None
```

---

## Related

- `.claude/skills/agent-handoff/SKILL.md` — Step 15 references this skill
- `.claude/skills/agentic-pm/modules/sprint-management.md` — Sprint closure checklist
- `.claude/skills/log-metrics/` — Metrics aggregation scripts
- `.claude/skills/issue-log/SKILL.md` — Issue documentation format
- `.claude/skills/agentic-pm/templates/sprint-summary.template.md` — Full summary template
