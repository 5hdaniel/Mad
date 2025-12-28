# Module: Task File Authoring (for Agent Engineers)

## Objective

Generate a task file for each backlog item selected for the sprint.

## Canonical task file sections

Use `templates/task-file.template.md`.

## Mandatory inclusions

Every task file MUST include:

1. **Goal** - Clear, concise statement (1-2 sentences)
2. **Non-goals** - Explicit scope boundaries (prevents scope creep)
3. **Deliverables** - List of files to create/modify
4. **Acceptance criteria** - Checkboxes that must ALL be true
5. **Implementation notes** - Detailed HOW guidance with code examples
6. **Integration notes** - What other tasks depend on this
7. **Do/Don't guidelines** - Positive and negative guidance
8. **Stop-and-ask triggers** - When engineer should escalate
9. **Testing expectations** - What tests must be written/verified
10. **PR preparation** - Title format, labels, dependencies
11. **Implementation Summary section** - Blank, engineer-owned

## Guardrail

If acceptance criteria are ambiguous, you **MUST ask the user** before issuing the task file.

## Quality checklist

Before issuing a task file:
- [ ] Goal is unambiguous (one interpretation only)
- [ ] Non-goals explicitly exclude adjacent work
- [ ] Acceptance criteria are binary (pass/fail, no "mostly done")
- [ ] Code examples match project patterns
- [ ] Integration notes reference specific task IDs
- [ ] Testing expectations are specific (not "add tests")

## Anti-patterns to avoid

- Vague acceptance criteria: "UI should look good"
- Missing non-goals: Opens door to scope creep
- No code examples: Engineers will invent patterns
- "Add appropriate tests": Always specify what tests

## Estimation Guidelines

**MANDATORY**: Before estimating any task, consult `.claude/plans/backlog/INDEX.md` → "Estimation Accuracy Analysis" section.

### Category Adjustment Factors

Apply these multipliers to your initial estimates based on historical data:

| Category | Multiplier | Rationale | Data Points |
|----------|------------|-----------|-------------|
| security | × 0.4 | Simple focused fixes, avg -65% variance | SPRINT-009 |
| refactor | × 0.5 | Consistently overestimated (-52% avg) | 10+ tasks |
| test | × 1.0 | Usually accurate (0% variance) | SPRINT-009 |
| cleanup | × 0.5 | Similar to refactor, but MUST scan scope first | SPRINT-009 |
| schema | × 1.3 | High variance, add buffer | SPRINT-003 |
| config | × 0.5 | Significantly overestimated | SPRINT-003 |
| service/ipc/ui | × 1.0 | TBD - need data | - |

**SPRINT-009 Insights:**
- Security tasks completed in 40% of estimated time (avg -65% variance)
- Cleanup tasks need scope scanning before estimating
- Well-structured code accelerates refactoring

### Estimation Process

1. **Categorize the task** - Determine primary category (schema, refactor, test, etc.)
2. **Scan scope (REQUIRED for cleanup tasks)** - See below
3. **Make initial estimate** - Based on scope and complexity
4. **Apply adjustment factor** - Multiply by category factor
5. **Consider context** - Well-structured code = faster refactoring
6. **Document estimate** - Include Est. Turns, Tokens, Time in task file

### Scope Scanning (REQUIRED for Cleanup Tasks)

**Before estimating ANY cleanup task**, scan the actual scope:

```bash
# Console.log cleanup - count occurrences
grep -r "console\." --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l

# Commented code cleanup - approximate count
grep -rn "^[[:space:]]*//.*{" --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l

# Any types cleanup - count occurrences
grep -r ": any" --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l

# Orphaned files - list candidates
find src -name "*.tsx" -exec basename {} \; | sort | uniq
```

**Document the scan results in the task file:**
```markdown
## Scope Scan (Pre-Implementation)

**Scan Date:** YYYY-MM-DD
**Command:** `grep -r "console\." --include="*.ts" | wc -l`
**Result:** 47 occurrences across 23 files

**Estimate based on scan:**
- ~47 occurrences / ~10 per turn = 5 turns (base)
- Apply cleanup multiplier: 5 × 0.5 = 2-3 turns
```

**Why this matters:** SPRINT-009 showed cleanup estimates were often based on stale audit data. Scanning actual scope prevents surprises.

### Example

```
Initial estimate: 8-10 turns (refactor task)
Adjustment: × 0.5
Final estimate: 4-5 turns
```

## Task file naming

```
.claude/plans/tasks/TASK-<ID>-<slug>.md
```

Example: `TASK-101-type-definitions.md`

## Mid-sprint task updates

If requirements change during a sprint:

1. **Create a decision log entry** documenting the change
2. **Update affected task files** with `[UPDATED <date>]` marker at top
3. **Notify assigned engineers** of the change
4. **Do NOT change acceptance criteria** without user approval
5. **If scope expands**, consider splitting into new task

### Update marker format

```markdown
# Task TASK-XXX: <Title>

> [UPDATED 2024-01-15] Acceptance criteria clarified per Decision #3.
> See decision log for details.

## Goal
...
```
