# Task TASK-808: Add Type Verification Checklist for Fixture Tasks

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Add a Type Verification Checklist to the task file authoring module so engineers verify enum values against actual TypeScript definitions before committing fixture data, preventing CI failures from invalid enum values.

## Non-Goals

- Do NOT create automated type checking for fixtures
- Do NOT modify existing task templates
- Do NOT add runtime validation for fixtures
- Do NOT create new PM skill modules

## Deliverables

1. Update: `.claude/skills/agentic-pm/modules/task-file-authoring.md` - Add Fixture Task Template section

## Acceptance Criteria

- [ ] task-file-authoring.md includes Fixture Task Template section
- [ ] Type Verification Checklist with 4 items included
- [ ] How to verify enum values (grep command) included
- [ ] PM responsibility section added
- [ ] Good/bad example provided for task specs
- [ ] All CI checks pass

## Implementation Notes

### task-file-authoring.md Addition

Add new section "Fixture Task Template Additions":

```markdown
## Fixture Task Template Additions

**Purpose:** Prevent CI failures from invalid enum values in fixture data.

**Source:** SPRINT-011 TASK-800 used invalid TransactionStage values (`initial_contact`, `negotiation`, `contract`) that don't exist in the actual type definition.

### Type Verification Checklist (Required for Fixture Tasks)

Before committing fixture data, verify:

- [ ] All enum values match actual TypeScript definitions
- [ ] Import types from source files (do NOT hardcode values)
- [ ] Run `npm run type-check` before committing fixture data
- [ ] File paths to type definitions included in task acceptance criteria

### How to Verify Enum Values

```bash
# Find the type definition
grep -rn "type TransactionStage" --include="*.ts" src/ electron/

# Or check the exact file
cat electron/services/types.ts | grep -A 10 "TransactionStage"

# List all exported types from a file
grep -E "^export (type|interface|enum)" electron/services/types.ts
```

### PM Responsibility

When creating fixture tasks, PM MUST:
1. Include exact enum values in task file (not "use appropriate values")
2. Provide file path to type definition
3. Add `npm run type-check` to acceptance criteria
4. List valid values explicitly when enums have domain-specific meanings

### Example

**Bad task spec:**
> "Use appropriate transaction stages for the test emails"

This invites engineers to guess at values like `initial_contact` or `negotiation` which may not exist.

**Good task spec:**
> "Use TransactionStage values from `electron/services/types.ts`:
> - Valid values: `intro`, `showing`, `offer`, `inspections`, `escrow`, `closing`, `post_closing`
> - Do NOT use: `initial_contact`, `negotiation`, `contract` (these don't exist)"

### When to Include This Checklist

Include the Type Verification Checklist when the task involves:
- Creating test fixtures with domain-specific enums
- Adding mock data with typed fields
- Generating fake data for integration tests
- Any task where the engineer might need to use enum values

### Template Addition for Fixture Tasks

Add this section to task files for fixture creation:

```markdown
## Type Definitions Reference

**Enums used in this task:**

| Type | File | Valid Values |
|------|------|-------------|
| TransactionStage | `electron/services/types.ts` | `intro`, `showing`, `offer`, `inspections`, `escrow`, `closing`, `post_closing` |
| TransactionStatus | `electron/services/types.ts` | `pending`, `active`, `archived` |

**Pre-commit verification:**
- [ ] `npm run type-check` passes with fixture data
- [ ] All enum values verified against source definitions
```
```

## Integration Notes

- Imports from: N/A (documentation only)
- Exports to: N/A (documentation only)
- Used by: PM when creating fixture/test data tasks
- Depends on: None

## Do / Don't

### Do:

- Reference TASK-800 as the source of this guidance
- Include the grep commands that can be copy-pasted
- Provide concrete good/bad examples
- Keep the section focused and actionable

### Don't:

- Create complex validation automation
- Duplicate type-check guidance elsewhere
- Make the checklist too long
- Add runtime validation requirements

## When to Stop and Ask

- If task-file-authoring.md structure is unclear
- If similar guidance already exists
- If the section placement conflicts with existing content

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation only)

### Coverage

- Coverage impact: None (documentation only)

### Integration / Feature Tests

- Required: No (documentation only)

### CI Requirements

This task's PR MUST pass:
- [ ] No broken links in documentation
- [ ] Markdown formatting valid

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `docs(pm): add type verification checklist for fixture tasks`
- **Labels**: `documentation`, `process`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~4K-6K
- **Time:** ~8-12m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 1 existing file | +0.5 |
| Content provided | BACKLOG-128 has content outline | +0.5 |
| Integration complexity | Simple append | +0 |

**Confidence:** High

**Risk factors:**
- Very straightforward documentation update
- Single file modification

**Similar past tasks:** Documentation updates typically complete in 1-2 turns

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files modified:
- [ ] .claude/skills/agentic-pm/modules/task-file-authoring.md

Content verified:
- [ ] Type Verification Checklist included
- [ ] Grep commands are correct
- [ ] Good/bad example is clear
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 1 | X | +/- X | <reason> |

**Total Variance:** Est 1-2 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** N/A (documentation)
**Security Review:** N/A
**Test Coverage:** N/A

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
