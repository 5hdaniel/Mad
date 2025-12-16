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
