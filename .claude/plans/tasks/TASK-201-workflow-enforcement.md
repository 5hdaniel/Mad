# Task TASK-201: Enforce Engineer Workflow Compliance

## Goal

Implement technical enforcement mechanisms to ensure 100% workflow compliance: PR templates with required metrics, branch protection rules, CI validation, and agent guardrails.

## Non-Goals

- Do NOT change the existing workflow documentation content (only add enforcement)
- Do NOT modify git hooks (use GitHub Actions instead)
- Do NOT implement custom CLI tooling
- Do NOT change branching strategy

## Deliverables

1. New file: `.github/PULL_REQUEST_TEMPLATE.md`
2. Update: `.github/workflows/ci.yml` (add metrics validation step)
3. Update: `.claude/docs/ENGINEER-WORKFLOW.md` (add enforcement section)
4. Update: `.claude/agents/engineer.md` (add Plan-First blocking)
5. Update: `.claude/agents/senior-engineer-pr-lead.md` (add verification checklist)
6. New file: `.github/workflows/pr-metrics-check.yml` (if separate workflow needed)

## Acceptance Criteria

- [ ] PR template includes mandatory Engineer Metrics section
- [ ] PR template includes Plan-First Protocol confirmation
- [ ] CI fails if PR description lacks metrics table markers
- [ ] Engineer agent file documents Plan-First blocking requirement
- [ ] SR Engineer agent file includes metrics verification checklist
- [ ] Documentation updated with enforcement details
- [ ] All CI checks pass

## Implementation Notes

### PR Template Structure

```markdown
## Summary

[Brief description of changes]

## Related Issue

Closes #XXX or TASK-XXX

---

## Engineer Metrics (REQUIRED)

**MANDATORY: PRs without metrics will be rejected by CI.**

**Task:** TASK-XXX
**Branch:** [branch-name]
**Start Time:** [YYYY-MM-DD HH:MM]
**End Time:** [YYYY-MM-DD HH:MM]

### Plan-First Protocol
- [ ] Plan agent invoked before implementation
- [ ] Plan reviewed and approved
- [ ] Plan agent metrics recorded below

### Metrics Table

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |

### Notes
[Any deviations from plan, issues encountered, etc.]

---

## Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Task file Implementation Summary completed
```

### CI Validation Logic

The CI check should verify:
1. PR description contains "## Engineer Metrics" section
2. Metrics table has at least Implementation row filled
3. Plan-First Protocol checkboxes present

```yaml
- name: Validate PR Metrics
  run: |
    # Extract PR body
    PR_BODY="${{ github.event.pull_request.body }}"

    # Check for required sections
    if [[ ! "$PR_BODY" =~ "## Engineer Metrics" ]]; then
      echo "ERROR: PR missing Engineer Metrics section"
      exit 1
    fi

    if [[ ! "$PR_BODY" =~ "Plan-First Protocol" ]]; then
      echo "ERROR: PR missing Plan-First Protocol confirmation"
      exit 1
    fi
```

### Agent Guardrail Updates

**Engineer Agent (`engineer.md`):**
```markdown
## Plan-First Protocol (BLOCKING)

Before implementing ANY code:
1. MUST invoke Plan agent with task context
2. MUST review plan for completeness
3. MUST record plan metrics

**VIOLATION**: Starting implementation without a plan is a workflow violation.
Report to PM if blocked.
```

**SR Engineer Agent:**
```markdown
## PR Review Checklist

Before approving ANY PR, verify:
- [ ] Engineer Metrics section is complete (not placeholder)
- [ ] Plan-First checkboxes are checked
- [ ] Metrics numbers are reasonable (not "X" placeholders)
- [ ] Implementation Summary in task file is complete
```

## Integration Notes

- Imports from: None
- Exports to: All engineer workflows
- Used by: All future PRs
- Depends on: None (foundational task)

## Do / Don't

### Do:
- Make the template clear and easy to fill out
- Provide examples of good metrics
- Keep CI validation simple (string matching)
- Document why enforcement matters

### Don't:
- Make the template so long engineers skip reading it
- Block PRs for minor formatting issues
- Add complex validation that's hard to debug
- Remove existing PR context sections

## SR Engineer Review Notes

**Review Date:** 2025-12-16 | **Status:** APPROVED

> **Note on CI Validation:** When using `${{ github.event.pull_request.body }}` in a bash heredoc, special characters can cause parsing issues. Consider using `$GITHUB_EVENT_PATH` or passing the body via an environment variable for robustness.

## When to Stop and Ask

- If GitHub Actions workflow syntax is unclear
- If branch protection API changes are needed (requires admin)
- If existing CI workflow structure prevents clean addition
- If unsure how to handle Dependabot/automated PRs

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (infrastructure change)
- This is a process/documentation task

### Integration Tests

- Required: Manual verification
- Test by creating a draft PR and verifying template loads
- Test CI validation by creating PR without metrics (should fail)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (no code changes expected)
- [ ] Lint (markdown lint if configured)
- [ ] Existing test suite (unchanged)

## PR Preparation

- **Title**: `chore(workflow): enforce engineer workflow compliance`
- **Labels**: `process`, `documentation`
- **Depends on**: None

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
Files created:
- [ ] .github/PULL_REQUEST_TEMPLATE.md
- [ ] CI validation step added

Files updated:
- [ ] .claude/docs/ENGINEER-WORKFLOW.md
- [ ] .claude/agents/engineer.md
- [ ] .claude/agents/senior-engineer-pr-lead.md

Verification:
- [ ] Template renders correctly in GitHub
- [ ] CI validation tested
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
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>
