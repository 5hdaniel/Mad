# TASK-XXX: [Title]

**Backlog ID:** BACKLOG-XXX
**Sprint:** [Sprint ID]
**Phase:** [Phase number and name]
**Branch:** `fix/task-XXX-description` or `feature/task-XXX-description`
**Estimated Turns:** X-Y
**Estimated Tokens:** XK-YK

---

## Objective

[One-paragraph description of what this task accomplishes]

---

## Context

[Background information needed to understand the task]

---

## Requirements

### Must Do:
1. [Required item 1]
2. [Required item 2]
3. [Required item 3]

### Must NOT Do:
- [Constraint 1]
- [Constraint 2]

---

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

---

## Files to Modify

- `path/to/file1.ts` - [what changes]
- `path/to/file2.tsx` - [what changes]

## Files to Read (for context)

- `path/to/file.ts` - [why]

---

## Testing Expectations

### Unit Tests
- **Required:** Yes/No
- **New tests to write:** [describe]
- **Existing tests to update:** [describe]

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `type(scope): description`
- **Branch:** `fix/task-XXX-description`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Turns**: X (Est: Y)
- **Actual Tokens**: ~XK (Est: YK)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- [Condition that requires PM input]
- [Condition that requires PM input]
- You encounter blockers not covered in the task file
