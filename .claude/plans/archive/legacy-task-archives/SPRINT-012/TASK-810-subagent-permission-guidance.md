# Task TASK-810: Add Sub-Agent Permission Guidance

---

## Goal

Add pre-approved tool permissions for engineer sub-agents so they can execute Write/Edit operations in background mode, preventing the permission denial issue that burned ~9.6M tokens in SPRINT-012.

## Non-Goals

- Do NOT modify Claude Code core behavior
- Do NOT add complex retry logic
- Do NOT create new agent types

## Deliverables

1. Update: `.claude/settings.json` - Add allowedTools configuration
2. Update: `.claude/agents/engineer.md` - Add warning about background agent limitations

## Acceptance Criteria

- [ ] `.claude/settings.json` includes pre-approved Write/Edit/Bash tools
- [ ] `engineer.md` documents the background agent permission limitation
- [ ] `engineer.md` explains SR Engineer review as the quality gate
- [ ] All CI checks pass

## Implementation Notes

### .claude/settings.json Update

Add or update the settings file with tool permissions:

```json
{
  "allowedTools": ["Write", "Edit", "Bash"]
}
```

### engineer.md Addition

Add to the engineer agent documentation (near the top):

```markdown
## Sub-Agent Permission Configuration

**Background agents require pre-approved permissions.**

When engineer agents run in background mode (`run_in_background: true`), they cannot display interactive prompts to the user. Write/Edit tools require user approval, so these must be pre-approved in project settings.

**Why this is safe:**
- ALL engineer work goes through SR Engineer review before merge
- The quality gate is at PR review, not at tool execution
- Pre-approval enables parallel agent execution for multi-task sprints

**If you see this error:**
```
Permission to use [Tool] has been auto-denied (prompts unavailable)
```

The project settings are missing tool pre-approval. Add to `.claude/settings.json`:
```json
{
  "allowedTools": ["Write", "Edit", "Bash"]
}
```

**Reference:** BACKLOG-130 (Sub-Agent Permission Auto-Denial Incident)
```

## Integration Notes

- Imports from: N/A (configuration only)
- Exports to: N/A (configuration only)
- Used by: All engineer agent invocations
- Depends on: None

## Do / Don't

### Do:

- Keep the explanation concise
- Reference BACKLOG-130 for full incident details
- Emphasize SR Engineer review as the quality gate

### Don't:

- Add complex permission logic
- Create multiple settings files
- Duplicate incident report content

## When to Stop and Ask

- If `.claude/settings.json` has conflicting structure
- If engineer.md has conflicting guidance about permissions
- If unsure about JSON schema for settings

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (configuration only)

### Coverage

- Coverage impact: None (configuration only)

### Integration / Feature Tests

- Required: No (configuration only)

### CI Requirements

This task's PR MUST pass:
- [ ] Valid JSON syntax in settings file
- [ ] Markdown formatting valid

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(config): add pre-approved tool permissions for engineer agents`
- **Labels**: `configuration`, `process`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `config`

**Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~6K-8K
- **Time:** ~10-15m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 2 files (settings.json, engineer.md) | +1 |
| Content provided | Full content in this task | +0 |
| Integration complexity | Minimal | +0 |

**Confidence:** High

**Risk factors:**
- Simple configuration change
- Content already defined

**Similar past tasks:** Configuration tasks typically complete in 1 turn

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Checklist

```
Files created/modified:
- [ ] .claude/settings.json (add allowedTools)
- [ ] .claude/agents/engineer.md (add permission section)

Content verified:
- [ ] JSON is valid
- [ ] Markdown formatting correct
- [ ] Reference to BACKLOG-130 included
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | 0 | 0 |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### Review Summary

**Architecture Compliance:** N/A (configuration)
**Security Review:** Verify tool permissions are appropriate
**Test Coverage:** N/A

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
