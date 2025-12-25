# Plan-First Protocol

**Status:** MANDATORY for all agents (Engineer, SR Engineer, PM)
**Last Updated:** 2024-12-24

---

## Overview

Before ANY implementation, review, or planning activity, you MUST invoke the Plan agent to create a strategic plan. This is non-negotiable.

**Why this exists:**
- Prevents scope creep and missed requirements
- Creates auditable decision trail
- Enables accurate metrics tracking
- Reduces rework from poor planning

---

## Protocol Steps

### Step 1: Invoke Plan Agent

Use the Task tool with `subagent_type="Plan"` and provide context appropriate to your role:

```markdown
## Planning Request: [Type]

**Role**: [Engineer | SR Engineer | PM]
**Task**: [TASK-XXX or activity description]

### Context
- **Objective**: [What needs to be accomplished]
- **Constraints**: [Limitations, guardrails, dependencies]
- **Scope**: [Files, services, or areas affected]

### Expected Plan Output
1. **Action Sequence**: Ordered steps with dependencies
2. **Risk Areas**: Potential issues to watch for
3. **Quality Gates**: What must be verified
4. **Estimated Complexity**: Low/Medium/High with rationale
```

### Step 2: Review the Plan

After receiving the plan, review it from your role's perspective:

**All Roles Check:**
- [ ] Are all requirements addressed?
- [ ] Is the sequence logical (dependencies respected)?
- [ ] Are there any missing steps?
- [ ] Is the complexity estimate reasonable?

**If issues found**, re-invoke Plan agent with:
```markdown
## Planning Revision Request

**Original Plan Issues:**
1. [Issue 1]
2. [Issue 2]

**Requested Changes:**
- [Change 1]
- [Change 2]

Please revise the plan addressing these concerns.
```

### Step 3: Track Plan Agent Metrics

**REQUIRED**: Track all Plan agent activity:

```markdown
## Plan Agent Metrics

**Planning Start Time:** [timestamp]
**Planning End Time:** [timestamp]

| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Step 4: Approve and Execute

Once satisfied with the plan:
1. Document the approved plan in your output
2. Record Plan agent metrics (turns, tokens, time)
3. Use the plan as your execution guide
4. Reference plan steps as you complete them

**BLOCKING**: Do NOT start execution until you have an approved plan AND recorded Plan metrics.

---

## Role-Specific Extensions

### Engineers

Include in planning request:
- Task file path and acceptance criteria
- Architecture boundaries (entry file guardrails)
- Testing requirements

### SR Engineers

Include in planning request:
- PR/branch being reviewed
- Services affected and layers involved
- Security and performance considerations

### PM

Include in planning request:
- Backlog items being considered
- Merge target and risk tolerance
- Dependencies across tasks

---

## Workflow Violations

| Violation | Detection | Consequence |
|-----------|-----------|-------------|
| Skipping Plan-First Protocol | CI check + SR Review | PR blocked until plan metrics added |
| Missing Plan metrics | SR Engineer review | PR rejected |
| Placeholder metrics ("X" values) | SR Engineer review | PR rejected |

**If you realize you skipped planning:**
1. STOP immediately
2. Invoke Plan agent (even retroactively)
3. Document as deviation: "DEVIATION: Plan created post-implementation"
4. Include retroactive plan metrics

---

## References

- Engineer implementation: `.claude/agents/engineer.md`
- SR Engineer reviews: `.claude/agents/senior-engineer-pr-lead.md`
- PM planning: `.claude/skills/agentic-pm/SKILL.md`
