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

| Category | Multiplier | Rationale |
|----------|------------|-----------|
| schema | × 1.3 | High variance, add buffer |
| refactor | × 0.5 | Consistently overestimated (-52% avg) |
| test | × 1.0 | Usually accurate |
| config | × 0.5 | Significantly overestimated |
| service/ipc/ui | × 1.0 | TBD - need data |

### Estimation Process

1. **Categorize the task** - Determine primary category (schema, refactor, test, etc.)
2. **Make initial estimate** - Based on scope and complexity
3. **Apply adjustment factor** - Multiply by category factor
4. **Consider context** - Well-structured code = faster refactoring
5. **Document estimate** - Include Est. Turns, Tokens, Time in task file

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
