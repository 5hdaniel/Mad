# BACKLOG-138: Comprehensive Turns/Self-Reported Metrics Cleanup

## Status
- **Priority:** Medium
- **Category:** docs/cleanup
- **Created:** 2026-01-03
- **Sprint:** Unassigned

## Summary

Remove all references to deprecated "turns" and self-reported metrics (Turns/Time) across documentation, templates, and active files. Update everything to use the new auto-captured metrics format (Tokens/Duration/API Calls).

## Background

BACKLOG-137 implemented automatic token tracking via SubagentStop hook. This changed the metrics format:

| Old (Deprecated) | New (Auto-Captured) |
|------------------|---------------------|
| Turns (manual count) | API Calls (from hook) |
| Tokens (estimate: Turns × 4K) | Total Tokens (from hook) |
| Time (self-reported) | Duration (from hook, seconds) |

Core files were updated (metrics-templates.md, ENGINEER-WORKFLOW.md, task-file.template.md, SKILL.md, task-file-authoring.md), but ~600+ references to "turns" still exist in the codebase.

## Files Requiring Updates

### Agent Documentation (High Priority)
- [ ] `.claude/agents/engineer.md` - Remove turns tracking, add agent_id capture
- [ ] `.claude/agents/senior-engineer-pr-lead.md` - Update review checklist
- [ ] `.claude/agents/agentic-pm.md` - Update metrics requirements

### Shared Documentation
- [ ] `.claude/docs/shared/metrics-tracking.md` - May be obsolete, consider removal
- [ ] `.claude/docs/shared/token-cap-workflow.md` - Update to auto-captured format
- [ ] `.claude/docs/shared/plan-first-protocol.md` - Update metrics sections

### PM Templates
- [ ] `.claude/skills/agentic-pm/templates/engineer-assignment-message.template.md`
- [ ] `.claude/skills/agentic-pm/templates/sprint-summary.template.md`

### Active Sprint/Task Files (Review and Update)
- [ ] `.claude/plans/sprints/SPRINT-016-*.md` (if exists) - Update template sections
- [ ] Active task files in `.claude/plans/tasks/` - Update Implementation Summary sections

### INDEX.md
- [ ] The NON-NEGOTIABLE header still references Turns/Tokens/Time format
- [ ] Column headers still include turns-based columns (preserve for historical data)

## Scope

### In Scope
1. Update all documentation to reference auto-captured metrics
2. Remove self-reporting instructions (count turns, track time)
3. Add agent_id capture instructions where missing
4. Update table formats to new columns
5. Add deprecation notices to historical data sections

### Out of Scope
1. Modifying historical data in INDEX.md (preserve for reference)
2. Updating archived sprint files (preserve as-is)
3. Changing completed task files (preserve as-is)

## Acceptance Criteria

- [ ] `grep -r "turns" --include="*.md" .claude/` returns only:
  - Historical/archived files
  - Explicitly deprecated sections
  - INDEX.md historical columns
- [ ] All active templates use auto-captured format
- [ ] Agent docs reference agent_id capture
- [ ] `npm run type-check` passes (no code changes expected)

## Implementation Notes

### Search Commands
```bash
# Find all turns references
grep -rn "turns" --include="*.md" .claude/ | grep -v "archive" | grep -v "SPRINT-0[0-1]"

# Find self-reported time references
grep -rn "self-report" --include="*.md" .claude/

# Find old metric tables
grep -rn "Impl Turns" --include="*.md" .claude/
```

### Update Patterns

**Old format (remove):**
```markdown
| Phase | Turns | Tokens | Time |
| Implementation | X | ~XK | Xm |
```

**New format (use):**
```markdown
| Metric | Value |
| Total Tokens | X |
| Duration | X seconds |
| API Calls | X |
```

## Testing Approach

After cleanup:
1. Run an engineer agent on a test task
2. Verify agent_id is captured in task file
3. Verify metrics appear in `.claude/metrics/tokens.jsonl`
4. Verify grep shows minimal turns references

## Estimation

- **Category:** docs/cleanup
- **Base estimate:** ~15K tokens
- **Multiplier:** × 5.0 (docs category - iteration can spiral)
- **Adjusted estimate:** ~75K tokens
- **Token Cap:** 300K (4x upper estimate)

## Notes

This cleanup validates the auto-captured metrics workflow implemented in BACKLOG-137.
