# Task TASK-915: Generator Approach Documentation for Large Fixtures

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

Document the generator approach for creating large data fixtures, preventing engineers from hitting the 32K output token limit when tasks require large JSON/data file creation.

## Non-Goals

- Do NOT create actual fixture generators (documentation only)
- Do NOT modify existing fixtures
- Do NOT change how small fixtures (<20 items) are handled

## Deliverables

1. New: `.claude/docs/shared/large-fixture-generation.md` - Comprehensive guidance
2. Update: `.claude/skills/agentic-pm/modules/task-file-authoring.md` - Add fixture warning
3. Update: `.claude/docs/shared/plan-first-protocol.md` - Add fixture considerations

## Acceptance Criteria

- [ ] New doc explains generator approach with code examples
- [ ] New doc includes threshold table (when to use generator)
- [ ] Task authoring module warns PM about fixture tasks >50 items
- [ ] Plan-first protocol mentions checking for large fixtures
- [ ] 32K token limit explicitly referenced
- [ ] TASK-801 example included as reference

## Implementation Notes

### New File: large-fixture-generation.md

```markdown
# Large Fixture Generation

**Purpose:** Prevent 32K output token limit errors when creating large data fixtures.

## The Problem

Claude's Write tool has a 32,000 token output limit. A JSON file with 200+ items
easily exceeds this limit, causing the task to stall.

**Example:** TASK-801 (SPRINT-011) attempted to output 203 messages directly,
hit the limit, and required a workaround.

## The Solution: Generator Scripts

Instead of writing the full JSON, create a TypeScript generator script:

### Generator Pattern

```typescript
// scripts/generateFixtures.ts (temporary)
import * as fs from 'fs';

interface Message {
  id: number;
  text: string;
  timestamp: string;
}

const messages: Message[] = [];
for (let i = 0; i < 200; i++) {
  messages.push({
    id: i + 1,
    text: `Sample message ${i + 1} with content...`,
    timestamp: new Date(2024, 0, i % 28 + 1).toISOString(),
  });
}

fs.writeFileSync(
  'src/__fixtures__/messages.json',
  JSON.stringify({ messages }, null, 2)
);

console.log(`Generated ${messages.length} messages`);
```

### Execution

```bash
npx ts-node scripts/generateFixtures.ts
# OR
npx tsx scripts/generateFixtures.ts
```

### Cleanup

After generation, delete the script (unless it's useful for regeneration):

```bash
rm scripts/generateFixtures.ts
git add src/__fixtures__/messages.json
```

## When to Use Generator Approach

| Fixture Size | Approach | Rationale |
|--------------|----------|-----------|
| <20 items | Direct Write | Small enough for Write tool |
| 20-50 items | Consider generator | Approaching limit, use judgment |
| >50 items | **REQUIRE generator** | Will likely exceed 32K tokens |

## Generator Benefits

1. **No token limit issues** - Script runs outside Claude
2. **Reproducible** - Can regenerate with different params
3. **Programmatic variation** - Loops, random data, patterns
4. **Type-safe** - TypeScript catches errors before generation

## Warning Signs (PM/Engineer)

- Task mentions "200+ items" or similar
- Fixture needs realistic variation across many records
- Previous attempt hit token limit
- Task is for testing infrastructure (often needs large datasets)

## Related

- **TASK-801:** Original incident (SPRINT-011)
- **Token limit:** 32,000 output tokens max
```

### Update to task-file-authoring.md

Add after existing fixture guidance or in relevant section:

```markdown
## Large Fixture Warning

When authoring tasks that involve creating fixtures:

**Check fixture size:**
- >50 items: Add explicit note "USE GENERATOR APPROACH"
- Reference: `.claude/docs/shared/large-fixture-generation.md`

**Task file should include:**
```markdown
### Large Fixture Note

This task creates >X items. **Use generator approach:**
1. Create TypeScript generator script
2. Run with `npx ts-node`
3. Commit generated JSON, delete script

See `.claude/docs/shared/large-fixture-generation.md`
```
```

### Update to plan-first-protocol.md

Add to planning checklist or considerations:

```markdown
### Fixture Size Check

During planning, identify if task involves fixture creation:
- [ ] How many items will the fixture contain?
- [ ] If >50 items, plan to use generator approach
- [ ] Reference: `.claude/docs/shared/large-fixture-generation.md`
```

## Integration Notes

- Imports from: None
- Exports to: None
- Used by: PM (task authoring), Engineers (implementation), Plan agents
- Depends on: None

## Do / Don't

### Do:

- Include complete code examples
- Explain WHY the limit exists
- Reference the actual incident
- Make threshold clear (50 items)

### Don't:

- Make it seem complicated (it's straightforward)
- Forget to mention script cleanup
- Skip the type-safety benefits
- Use vague thresholds ("a lot of items")

## When to Stop and Ask

- If you find existing fixture guidance that conflicts
- If the 50-item threshold seems wrong based on token math
- If task-file-authoring.md structure doesn't have a clear place for this

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
- [ ] Lint / format checks

**Documentation PRs do not require code tests.**

## PR Preparation

- **Title**: `docs(shared): add large fixture generation guidance`
- **Labels**: `documentation`
- **Depends on**: None

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `docs`

**Raw Estimate:** 2-3 turns, ~10K tokens, 20-30 min
**Adjustment Factor:** x0.5 (docs category)

**Adjusted Estimated Totals:**
- **Turns:** 1-2
- **Tokens:** ~5K
- **Time:** ~10-15 min
- **Token Cap:** 20K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 2 existing | +1 |
| New file | 1 comprehensive guide | +1 |
| Code volume | ~80 lines markdown | +0 |
| Patterns | Following existing style | +0 |

**Confidence:** High

**Risk factors:**
- Need to find right place in task-file-authoring.md
- plan-first-protocol.md structure may vary

**Similar past tasks:** BACKLOG-121 estimated 2-3 turns

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop
**Branch Into:** develop
**Branch Name:** docs/TASK-915-generator-docs

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Execution Classification

- **Parallel Safe:** YES (with TASK-913)
- **Depends On:** None
- **Blocks:** TASK-916 (Phase 2 gated on Phase 1 completion)

### Shared File Analysis

| File | This Task | Conflicts With |
|------|-----------|----------------|
| `.claude/skills/agentic-pm/modules/task-file-authoring.md` | Fixture warning | None |
| `.claude/docs/shared/plan-first-protocol.md` | Fixture check | None |
| `.claude/docs/shared/large-fixture-generation.md` (NEW) | Main doc | None |

### Technical Considerations

- No conflicts with any other Phase 1 tasks
- Can run in parallel with TASK-913
- Creates new file (large-fixture-generation.md) - no conflict possible
- Updates to existing files are in isolated sections

### Worktree Command (for this task)

```bash
git -C /Users/daniel/Documents/Mad worktree add ../Mad-task-915 -b docs/TASK-915-generator-docs develop
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: 2026-01-02*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (task file provided complete guidance)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 0 | ~0K | 0 min |
| Revision(s) | 0 | ~0K | 0 min |
| **Plan Total** | 0 | ~0K | 0 min |

Note: Task file contained complete implementation notes with code examples.
No separate Plan agent invocation needed - guidance was explicit.
```

### Checklist

```
Files created:
- [x] .claude/docs/shared/large-fixture-generation.md

Files modified:
- [x] .claude/skills/agentic-pm/modules/task-file-authoring.md
- [x] .claude/docs/shared/plan-first-protocol.md

Verification:
- [x] Generator pattern with complete example
- [x] Threshold table included (20/50 items)
- [x] 32K limit mentioned
- [x] TASK-801 referenced
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | ~0K | 0 min |
| Implementation (Impl) | 2 | ~8K | 5 min |
| Debugging (Debug) | 1 | ~4K | 3 min |
| **Engineer Total** | 3 | ~12K | 8 min |
```

### Notes

**Planning notes:**
Task file contained complete implementation guidance with code examples. All three deliverables were clearly specified with exact content to add.

**Deviations from plan:**
None

**Design decisions:**
- Added BACKLOG-121 reference to main doc for traceability
- Placed fixture warning at end of task-file-authoring.md (after related fixture guidance)
- Added fixture check as checklist items in plan-first-protocol under Engineers section

**Issues encountered:**
CI "Validate PR Metrics" check failed twice due to:
1. Shell special chars in PR body (">50" interpreted as redirect)
2. "Estimate vs Actual" vs "Estimated vs Actual" text mismatch
Fixed by updating PR body to avoid special chars and use exact text match.

**Reviewer notes:**
All acceptance criteria met. Documentation follows existing patterns.

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 1 | 1 | 0 | As expected |
| Files to modify | 2 | 2 | 0 | As expected |
| Code volume | ~80 lines | ~115 lines | +35 | Added reference section, expanded tables |

**Total Variance:** Est 1-2 turns -> Actual 3 turns (50% over due to CI debugging)

**Root cause of variance:**
Implementation was as expected (2 turns). Extra turn for debugging CI validation failures.

**Suggestion for similar tasks:**
Estimate is good for docs tasks with explicit implementation notes.

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: 2026-01-02*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | 2 | ~15K | 8 min |
| Feedback/Revisions | 1 | ~3K | 2 min |
| **SR Total** | 3 | ~18K | 10 min |
```

Note: Feedback turn was to fix CI validation for PR #276 (missing Plan-First Protocol section).

### Review Summary

**Architecture Compliance:** N/A (documentation only)
**Security Review:** N/A (no code changes)
**Test Coverage:** N/A (documentation only)

**Review Notes:**
- All three deliverables present and complete
- Generator pattern well-documented with threshold table
- TASK-801 reference included as required
- BACKLOG-121 reference added for traceability
- Documentation follows existing patterns
- CI required rebase due to develop advancing with TASK-913 archive

### Merge Information

**PR Number:** #275
**Merge Commit:** d8c97df
**Merged To:** develop
