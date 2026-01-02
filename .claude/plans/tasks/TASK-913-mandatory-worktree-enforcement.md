# Task TASK-913: Mandatory Worktree Enforcement for Background Agents

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

Update agent documentation to make worktree isolation MANDATORY for all background/parallel engineer agents, preventing the race condition that burned ~18M tokens in SPRINT-014.

## Non-Goals

- Do NOT modify any code files (this is documentation only)
- Do NOT change the worktree workflow for foreground/interactive agents
- Do NOT add new git hooks or automation (documentation enforcement only)

## Deliverables

1. Update: `.claude/agents/engineer.md` - Strengthen worktree requirement
2. Update: `.claude/docs/shared/git-branching.md` - Add worktree section
3. Update: `CLAUDE.md` - Add incident warning and reference

## Acceptance Criteria

- [ ] engineer.md clearly states worktree is MANDATORY (not optional) for background agents
- [ ] engineer.md includes pre-flight directory verification checklist
- [ ] engineer.md includes blocking rule for main repo detection
- [ ] git-branching.md documents worktree workflow
- [ ] CLAUDE.md references BACKLOG-132 incident
- [ ] All documentation is internally consistent

## Implementation Notes

### SR Engineer Review Finding (2026-01-02)

**IMPORTANT:** The `engineer.md` file has ALREADY been updated with worktree requirements:
- Line 109: "Worktree Workflow (MANDATORY for background agents)" ✓
- Lines 137-157: Pre-Flight Directory Check ✓
- Lines 159-162: BLOCKING RULE ✓
- BACKLOG-132 incident reference ✓

**Revised Scope:**
1. **engineer.md**: VERIFY ONLY - Confirm consistency with git-branching.md and CLAUDE.md
2. **git-branching.md**: ADD "MANDATORY for parallel agents" emphasis to existing worktree section
3. **CLAUDE.md**: ADD new "Parallel Agent Safety" section

### git-branching.md Section to Add

```markdown
## Worktree Isolation for Parallel Agents

When multiple agents work in parallel, each MUST use an isolated git worktree:

### Creating a Worktree
```bash
git -C /path/to/Mad worktree add ../Mad-task-XXX -b feature/TASK-XXX develop
```

### Verifying Isolation
```bash
git worktree list
pwd  # Should show Mad-task-XXX
```

### Cleanup After Sprint
```bash
git worktree remove Mad-task-XXX --force
```

**Reference:** BACKLOG-132 - ~18M tokens burned when two agents worked in same directory.
```

### CLAUDE.md Warning to Add

Add to "Git Branching Strategy" or create new section:

```markdown
## Parallel Agent Safety

**CRITICAL:** When running multiple engineer agents in parallel, each MUST use
isolated git worktrees. Working in the same directory causes race conditions
that can burn massive tokens.

**Incident Reference:** BACKLOG-132 (~18M tokens, 500x overrun)
```

## Integration Notes

- Imports from: None
- Exports to: None
- Used by: All engineer agents
- Depends on: None (standalone documentation task)

## Do / Don't

### Do:

- Make the language clear and imperative
- Include specific bash commands that work
- Reference the incident with token cost
- Keep existing foreground workflow intact

### Don't:

- Add new dependencies or tools
- Change git configuration
- Modify code files
- Make the documentation overly verbose

## When to Stop and Ask

- If you find conflicting instructions elsewhere in docs
- If the pre-flight check seems too restrictive
- If you're unsure about the blocking rule language

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (documentation only)
- New tests to write: None
- Existing tests to update: None

### Coverage

- Coverage impact: N/A

### Integration / Feature Tests

- Required scenarios: None

### CI Requirements

This task's PR MUST pass:
- [ ] Lint / format checks (markdown lint if enabled)

**Documentation PRs do not require code tests.**

## PR Preparation

- **Title**: `docs(agents): mandate worktree for background agents`
- **Labels**: `documentation`, `process`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Raw Estimate:** 2-3 turns, ~10K tokens, 15-20 min (REVISED after SR review)
**Adjustment Factor:** x0.5 (docs category consistently overestimated)

**Adjusted Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~5K
- **Time:** ~8-12 min
- **Token Cap:** 20K (4x upper estimate)

**Estimation Assumptions (REVISED):**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 2 files + 1 verify | +1.5 |
| Code volume | ~30 lines of markdown (engineer.md already done) | +0.5 |
| Patterns | Following existing doc style | +0 |
| Dependencies | None | +0 |

**Confidence:** High

**Risk factors:**
- May find conflicting instructions to reconcile
- Language needs to be precise but not overly restrictive

**Similar past tasks:** BACKLOG-072 (config category, -62% variance) - documentation tasks tend to be overestimated

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** docs/TASK-913-worktree-enforcement

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: 2026-01-02*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (implicit - task file has detailed plan)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 0 | ~0K | 0 min |
| Revision(s) | 0 | ~0K | 0 min |
| **Plan Total** | 0 | ~0K | 0 min |

Note: Task file provided complete implementation plan inline (SR Engineer pre-review).
No separate Plan agent invocation required.
```

### Checklist

```
Files modified:
- [x] .claude/agents/engineer.md (VERIFY ONLY - changes already present)
- [x] .claude/docs/shared/git-branching.md (ADD parallel agent emphasis)
- [x] CLAUDE.md (ADD Parallel Agent Safety section)

Verification:
- [x] All three files reference BACKLOG-132 incident
- [x] Language is clear and imperative
- [x] Worktree requirement consistent across all docs
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | ~0K | 0 min |
| Implementation (Impl) | 2 | ~8K | 5 min |
| Debugging (Debug) | 0 | ~0K | 0 min |
| **Engineer Total** | 2 | ~8K | 5 min |
```

### Notes

**Planning notes:**
Task file contained detailed implementation plan from SR Engineer pre-review.
Plan specified exact sections to add and which files to verify vs modify.

**Deviations from plan:**
None

**Design decisions:**
- Added BACKLOG-132 reference with token count (~18M) and multiplier (~500x) for impact clarity
- Placed "Parallel Agent Safety" section in CLAUDE.md after "Integration Branch Rules" for logical flow
- Used blockquote format in git-branching.md to match existing documentation style

**Issues encountered:**
None

**Reviewer notes:**
- engineer.md was verified to already contain all required worktree documentation
- Only git-branching.md and CLAUDE.md required additions (per revised scope)

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 2 + 1 verify | 2 + 1 verify | 0 | As expected |
| Code volume | ~30 lines | ~25 lines | -5 | Slightly more concise |

**Total Variance:** Est 1-2 turns -> Actual 2 turns (0% variance, within estimate)

**Root cause of variance:**
On target. SR Engineer pre-review significantly reduced scope by confirming engineer.md already had changes.

**Suggestion for similar tasks:**
Documentation tasks with pre-review should use lower estimates (1-2 turns).

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: 2026-01-02*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | 1 | ~15K | 5 min |
| Feedback/Revisions | 0 | ~0K | 0 min |
| **SR Total** | 1 | ~15K | 5 min |
```

### Review Summary

**Architecture Compliance:** N/A (docs only)
**Security Review:** N/A
**Test Coverage:** N/A

**Review Notes:**
- Verified engineer.md already contains all required worktree documentation (no changes needed)
- git-branching.md addition is well-placed at start of existing "Git Worktrees" section
- CLAUDE.md section placed logically after "Integration Branch Rules" for workflow flow
- All three files consistently reference BACKLOG-132 with same metrics (~18M tokens, ~500x overrun)
- Language is clear, imperative, and consistent across all docs
- PR body updated to include Plan-First Protocol section for CI compliance

**Approval Rationale:**
Documentation changes address BACKLOG-132 root cause (worktree was opt-in, not mandatory). The mandatory language is unambiguous and the incident reference provides context for why this is critical.

### Merge Information

**PR Number:** #274
**Merge Commit:** b92ff1b136e979d8ea92491ff379475acd162a41
**Merged To:** develop
