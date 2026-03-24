# TASK-2316: Investigate Auto-Sync Email Attachment Linking

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/skills/agent-handoff/SKILL.md` for full workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Investigate why auto-sync email attachment linking does not work while manual attachment via search works fine. Determine the root cause and document findings for the PM checkpoint.

## Non-Goals

- Do NOT fix any code in this task (read-only investigation)
- Do NOT modify any files
- Do NOT create a PR
- Do NOT investigate manual attachment flow (it works correctly)

## Investigation Scope

Jordan reported: auto-sync email attachments are not being linked to transactions, but manually searching and attaching works. This suggests the auto-matching logic has a different code path than the manual search-and-attach flow.

### Key Questions to Answer

1. **Where is the auto-sync attachment linking code?** Find the specific function/handler that automatically links email attachments to transactions during sync.
2. **Where is the manual attach code?** Find the function that handles user-initiated search-and-attach.
3. **What differs between the two paths?** Compare the matching logic (by subject? by email address? by transaction ID?).
4. **Is the auto-link function being called at all?** Check if it runs during sync or if there is a conditional that skips it.
5. **Are there error logs or silent failures?** Check if the auto-link fails silently.
6. **Is this a timing issue?** Does auto-link run before transaction data is available?

### Files to Investigate

Start with these and follow the trail:
- `electron/services/emailSyncService.ts` -- Look for auto-link logic during sync
- `electron/handlers/` -- Look for attachment-related IPC handlers
- `electron/services/communicationDatabaseService.ts` -- Attachment storage
- Any `autoLink` or `autoMatch` or `linkAttachment` functions
- Search for: `attachment`, `auto-link`, `auto-match`, `link.*email`, `attach.*transaction`

### Investigation Output Format

Document findings in the Implementation Summary section below:

```markdown
### Findings

**Auto-sync attachment linking code location:** [file:line]
**Manual attach code location:** [file:line]
**Root cause hypothesis:** [description]
**Confidence:** High / Medium / Low
**Recommended fix:** [brief description]
**Estimated fix complexity:** Simple / Medium / Complex
**Files that would need modification:** [list]
```

## Acceptance Criteria

- [ ] Investigation summary completed with all 6 questions answered
- [ ] Root cause hypothesis documented with confidence level
- [ ] Recommended fix approach documented
- [ ] No files modified (read-only investigation)

## File Boundaries

N/A -- this is a read-only investigation task. No files should be modified.

## Testing Expectations

### Unit Tests
- Required: No (investigation only)

### CI Requirements
- N/A (no code changes)

## PR Preparation

No PR for this task. Findings are documented in the Implementation Summary section below.

---

## PM Estimate (PM-Owned)

**Category:** `investigation`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Confidence:** Medium

**Risk factors:**
- Code path may be deeply nested, requiring extensive tracing
- Auto-link may be disabled by a feature flag or config setting

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Findings

**Auto-sync attachment linking code location:** [file:line]
**Manual attach code location:** [file:line]

**Root cause hypothesis:**
[description]

**Confidence:** High / Medium / Low

**Recommended fix:**
[brief description]

**Estimated fix complexity:** Simple / Medium / Complex

**Files that would need modification:**
- [file1]
- [file2]

### Questions Answered

1. **Where is the auto-sync attachment linking code?**
   [answer]

2. **Where is the manual attach code?**
   [answer]

3. **What differs between the two paths?**
   [answer]

4. **Is the auto-link function being called at all?**
   [answer]

5. **Are there error logs or silent failures?**
   [answer]

6. **Is this a timing issue?**
   [answer]

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

---

## SR Engineer Review (SR-Owned)

N/A -- investigation task, no PR.
