# Task TASK-1110: Fix iMessage Attachments Stale ID

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

Fix iMessage attachment display by ensuring attachment records are properly linked to messages during import, preventing stale `message_id` references that cause attachments to not display.

## Non-Goals

- Do NOT implement a full re-import mechanism as the primary fix
- Do NOT modify the attachment file storage logic
- Do NOT change the attachment display UI
- Do NOT optimize import performance in this task

## Deliverables

1. Update: `electron/services/macOSMessagesImportService.ts` - Attachment linking logic
2. Possibly update: `electron/database/schema.sql` if external_id field needed
3. Update: Attachment query logic to use stable identifier

## Acceptance Criteria

- [ ] Picture attachments display correctly in conversation view
- [ ] No manual repair step required after import
- [ ] Existing attachment files are properly linked
- [ ] GIF attachments continue to work (no regression)
- [ ] New imports create correct attachment associations
- [ ] Re-imports don't create duplicate attachments
- [ ] All existing tests pass
- [ ] All CI checks pass

## Implementation Notes

### Root Cause Analysis

From BACKLOG-221:
> Attachment records were created during a previous import with old message_id values. When messages were re-imported, they received new UUIDs, but existing attachment records still reference the old message_ids.

The issue is that:
1. Messages get new UUIDs on re-import
2. Attachments store `message_id` (internal UUID)
3. On re-import, message UUIDs change but attachment `message_id` references become stale

### Solution Options

**Option A: Store external_id in attachments (Recommended)**
- Add `external_message_id` column to attachments table
- Store the macOS Messages GUID (stable identifier)
- Query attachments by `external_message_id` which doesn't change

**Option B: Re-create attachment records on import**
- Always update attachment `message_id` when message is re-imported
- Match by filename or external_id to find existing attachment record
- Update `message_id` to new UUID

**Option C: Auto-repair after import**
- Run repair function automatically after import completes
- Match attachments to messages by external_id
- Update stale `message_id` references

### Key Files

1. `electron/services/macOSMessagesImportService.ts` - Import logic
2. `electron/database/schema.sql` - Schema definition
3. Attachment query handlers

### Current Schema (for reference)

Check the attachments table schema:
```sql
-- From schema.sql
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,  -- <-- This becomes stale
  -- other fields...
);
```

### Implementation Approach

1. **Add external_message_id to attachments table** (migration)
2. **During import:** Store the macOS GUID as `external_message_id`
3. **During query:** Join on `external_message_id` if `message_id` doesn't match
4. **Repair existing data:** One-time migration to populate `external_message_id`

## Integration Notes

- Imports from: macOS Messages database
- Exports to: Conversation view components
- Used by: ConversationViewModal, message display components
- Depends on: None

## Do / Don't

### Do:

- Add stable identifier (external_id) for reliable joining
- Handle both new imports and existing data
- Write migration to repair existing attachment records
- Test with both pictures and GIFs
- Verify attachment display in conversation view

### Don't:

- Don't require users to manually run repair functions
- Don't break existing attachment queries
- Don't delete existing attachment files
- Don't change the attachment storage path structure

## When to Stop and Ask

- If schema changes require complex migration logic
- If you find the issue is in the display layer, not the data layer
- If attachment file paths need to change
- If the fix requires changes to more than 4-5 files

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test attachment linking with external_id
  - Test re-import updates message_id correctly
  - Test attachment query returns correct results
- Existing tests to update:
  - `macOSMessagesImportService.attachments.test.ts` - Add external_id tests

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Import messages with attachments, verify display
  - Re-import messages, verify attachments still display
  - Query attachments for conversation, verify correct results

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): link attachments by stable external_id`
- **Labels**: `bug`, `data-integrity`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~30-40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Schema changes | May need migration | +10K |
| Service updates | macOSMessagesImportService | +12K |
| Query updates | Attachment query handlers | +8K |
| Testing | Unit tests for new logic | +10K |

**Confidence:** Medium

**Risk factors:**
- Schema migration complexity unknown
- May need to handle edge cases with existing data
- Multiple code paths may reference message_id

**Similar past tasks:** TASK-1012 (attachment display) ~30K actual

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/services/macOSMessagesImportService.ts
- [ ] <other files>

Features implemented:
- [ ] Stable external_id for attachment linking
- [ ] Migration for existing data
- [ ] Query updates

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

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

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~35K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
