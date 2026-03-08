# Analysis: Parallel Agent Shared File Conflicts

**Date:** 2026-03-06
**Triggered by:** BACKLOG-883 / BACKLOG-889 conflict in SettingsManager.tsx
**Type:** Process improvement analysis (no sprint/backlog changes)

---

## Incident Summary

Two parallel agents worked on tasks branched from the same base commit. Both modified `SettingsManager.tsx`:

| Agent | Task | Changes to SettingsManager.tsx |
|-------|------|-------------------------------|
| Agent A | BACKLOG-883 | Changed `userToRemove` to `usersToRemove[]`, added `onBulkRemoveClick` |
| Agent B | BACKLOG-889 | Added `refreshPermissions` but used old `userToRemove` pattern |

Agent B's branch, when merged, would silently revert Agent A's refactor because Agent B never had Agent A's changes in its worktree. The main session had to manually cherry-pick the correct parts of Agent B's diff.

This is not a traditional merge conflict (Git would not flag it because the changes may touch different lines in the same file). It is a **semantic conflict** -- the code compiles but the behavior is wrong.

---

## Root Cause

The existing workflow has the right building blocks but a gap in enforcement:

1. **Dependency graph module** already defines `conflicts_with` edges for tasks touching the same files -- but this was either not applied or not enforced during sprint planning.

2. **SR Technical Review** is supposed to identify shared file dependencies and recommend parallel vs sequential execution -- but there is no checklist item that forces an explicit shared-file inventory.

3. **Task files** list "Deliverables" (files to create/modify) but do not list files the task must NOT modify.

4. **Worktree isolation** prevents filesystem race conditions but does nothing to prevent semantic conflicts across branches.

---

## Recommendations

### 1. Add "Shared File Inventory" to SR Technical Review (HIGH PRIORITY)

During Step 2 of sprint planning (SR Engineer Technical Review), require the SR to produce an explicit cross-task file overlap matrix before approving any tasks for parallel execution.

**Proposed addition to the Technical Review Request template:**

```markdown
### Shared File Analysis (SR REQUIRED)

| File | Modified By | Conflict Type |
|------|-------------|---------------|
| src/renderer/components/SettingsManager.tsx | TASK-A, TASK-B | semantic (same component, different concerns) |

**Recommendation:** Sequential / Parallel with constraints / Safe parallel
```

If any file appears in more than one task's modification list, SR must explicitly classify the conflict and recommend one of:
- **Sequential execution** (default safe choice)
- **Parallel with owner constraint** (one task "owns" the file, the other must not touch it)
- **Parallel with rebase checkpoint** (merge first task, rebase second before implementation)

### 2. Add "Files This Task Must NOT Modify" to Task Template (HIGH PRIORITY)

Add a new section to the task file template between "Deliverables" and "Acceptance Criteria":

```markdown
## File Boundaries

### Files to modify (owned by this task):
- `path/to/file1.ts`
- `path/to/file2.tsx`

### Files this task must NOT modify:
- `path/to/shared-component.tsx` - Owned by TASK-XXX in this sprint
- `path/to/types.ts` - Frozen; changes here require sequential execution

### If you need to modify a restricted file:
STOP and notify PM. The task may need to be resequenced.
```

This makes the constraint visible to the engineer agent. Currently, the agent has no way to know that another parallel task is modifying the same file.

### 3. Default to Sequential When Files Overlap (MEDIUM PRIORITY)

Update the sprint-selection module rules to make the default explicit:

```
Current: "Do not schedule conflicting tasks in parallel unless you introduce
         explicit integration branches, merge order, contract ownership."

Proposed addition: "When two tasks modify the same file and neither can be
         scoped to avoid the overlap, default to sequential execution.
         The cost of manual diff surgery after a semantic conflict exceeds
         the time saved by parallel execution."
```

The dependency graph module already supports `conflicts_with` edges. The gap is that PM does not always populate them. Making sequential the default for overlapping files removes the need for a judgment call.

### 4. Rebase-After-Merge Protocol for Unavoidable Parallel Execution (LOW PRIORITY)

When parallel execution is genuinely necessary despite file overlap (rare), add a checkpoint:

```
1. Agent A completes and merges first
2. Agent B's branch is rebased onto the updated base BEFORE Agent B's PR is reviewed
3. SR verifies Agent B's changes still make sense on top of Agent A's merge
4. Agent B's PR is then reviewed and merged
```

This is essentially sequential execution with overlapping implementation time. It saves wall-clock time when Agent A finishes well before Agent B, but requires PM coordination.

### 5. Add "Parallel Safety" Acceptance Criterion (LOW PRIORITY)

For any task running in parallel with others, add this standard acceptance criterion:

```markdown
- [ ] No modifications to files outside the "Files to modify" list
```

This gives the SR reviewer an explicit checklist item to verify during PR review.

---

## What NOT to Change

- **Do not add file-locking or git hooks.** The overhead is not justified for the frequency of this issue. Process clarity is sufficient.
- **Do not require agents to check other branches before starting.** Agents in isolated worktrees cannot easily inspect other in-flight worktrees, and this would add complexity without reliability.
- **Do not ban parallel execution entirely.** The vast majority of parallel tasks touch different files and complete successfully. The fix is better scoping, not less parallelism.

---

## Implementation Plan

| Change | Where | Effort |
|--------|-------|--------|
| Add Shared File Analysis to SR review template | Handoff/sprint planning templates | Template update |
| Add "File Boundaries" section to task template | `.claude/skills/agentic-pm/templates/task-file.template.md` | Template update |
| Update sprint-selection module with default-sequential rule | `.claude/skills/agentic-pm/modules/sprint-selection.md` | One paragraph |
| Add parallel safety acceptance criterion to task template | `.claude/skills/agentic-pm/templates/task-file.template.md` | One checkbox |

All changes are template/documentation updates. No code changes required.

---

## Summary of Answers to Your Questions

**Q1: Should task descriptions explicitly list "files this task must NOT modify"?**
Yes. Recommendation #2 above. This is the single highest-impact change. It makes the constraint visible to the agent at implementation time, not just at planning time.

**Q2: Should we add a section to the handoff template warning about shared files?**
Not the handoff template specifically -- the SR Technical Review request is the right place (Recommendation #1). The handoff template is per-task and per-phase; the shared file analysis needs to be cross-task and happens once during sprint planning. However, the "File Boundaries" section in each task file (Recommendation #2) serves the same purpose at handoff time because the engineer reads the task file before starting.

**Q3: Should we change the workflow to merge sequentially?**
Yes, as the default when files overlap (Recommendation #3). The current rules technically already require this (`conflicts_with` edges force sequencing), but the gap is enforcement. Making "sequential by default when files overlap" an explicit rule removes ambiguity. For cases where parallel execution is kept despite overlap, Recommendation #4 adds a rebase checkpoint.

**Q4: Any other recommendations?**
Recommendation #5 (acceptance criterion for file scope) gives the SR reviewer a concrete thing to check. The "What NOT to Change" section is equally important -- this is a scoping/planning gap, not a tooling gap.

---

**Next steps:** If approved, I will update the four template/module files listed in the Implementation Plan table. No sprint or backlog modifications needed.
