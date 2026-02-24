# Handoff Message Template

Use this template for ALL agent handoffs during sprint task execution.

---

## Handoff: [FROM_AGENT] → [TO_AGENT]

**Task:** TASK-XXXX
**Task File:** `.claude/plans/tasks/TASK-XXXX-description.md`
**Current Step:** X (of 15)
**Phase:** [A: Setup | B: Planning | C: Implementation | D: Merge & Cleanup]

### Status
[Choose one]
- [ ] Approved - Ready for next phase
- [ ] Rejected - Task cannot proceed as specified
- [ ] Changes Requested - Needs revision before approval
- [ ] Complete - Task finished, ready for closure
- [ ] Blocked - Waiting on external dependency

### Next Action
[Clear instruction for the receiving agent]

Example: "Review the implementation in branch `feature/TASK-1234-email-sync`.
Check that all acceptance criteria from the task file are met."

### Context
[Any relevant information the next agent needs]

- **Branch:** `feature/TASK-XXXX-description`
- **Worktree:** `../Mad-TASK-XXXX` (if applicable)
- **PR:** #XXX (if created)
- **Plan File:** `/path/to/plan.md` (if in planning phase)

### Issues/Blockers

[Document any problems encountered during this phase]

If none: "None encountered."

If issues exist, use this format:
```
1. **[Issue Title]**
   - What happened: [description]
   - Resolution: [how it was fixed/worked around]
   - Time impact: [estimate]
```

### Effort

**MANDATORY for Engineer and SR Engineer handoffs.** This data feeds into PM metrics collection and sprint retrospectives.

- **Agent ID:** `<agent_id returned by Task tool>`
- **Total Tokens:** `<from TaskOutput or agent completion summary>`
- **Duration:** `<seconds or minutes>`
- **Task Estimate:** `~XK (from task file)`

The Agent ID is the key that links to `.claude/metrics/tokens.csv` for PM aggregation. Record it immediately when the Task tool returns.

### Files Modified
[List key files touched in this phase - helps next agent find context]

- `path/to/file1.ts` - [brief description of change]
- `path/to/file2.tsx` - [brief description of change]

---

## Example: Engineer → SR Engineer (Plan Review)

```markdown
## Handoff: ENGINEER → SR ENGINEER

**Task:** TASK-1775
**Task File:** `.claude/plans/tasks/TASK-1775-email-attachment-download-service.md`
**Current Step:** 6 (of 15)
**Phase:** B: Planning

### Status
- [x] Changes Requested - Needs revision before approval

### Next Action
Review the implementation plan for email attachment download service.
Plan file: `/Users/daniel/.claude/plans/email-attachments-plan.md`

Verify:
1. Architecture aligns with existing attachment patterns
2. Error handling for OAuth token refresh is specified
3. Storage deduplication approach is sound

### Context
- **Branch:** `feature/TASK-1775-email-attachment-download`
- **Worktree:** N/A (sequential execution)

### Issues/Blockers
1. **Gmail API rate limit concern**
   - What happened: Discovered 250 requests/second limit during exploration
   - Resolution: Added throttling recommendation to plan
   - Time impact: +15 min research

### Effort
- **Agent ID:** `a7f2c91`
- **Total Tokens:** ~45K
- **Duration:** ~3 min
- **Task Estimate:** ~30K

### Files Modified
- `.claude/plans/email-attachments-plan.md` - Created implementation plan
```
