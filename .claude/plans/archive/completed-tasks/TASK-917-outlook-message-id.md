# Task TASK-917: Outlook Message-ID Extraction (BACKLOG-091 Phase 2a)

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

Extract RFC 5322 Message-ID header from Outlook emails (via Microsoft Graph API) and store in the `message_id_header` column, mirroring what SPRINT-014 TASK-909 did for Gmail.

## Non-Goals

- Do NOT implement content hash (that's TASK-918)
- Do NOT implement duplicate linking logic (that's TASK-919)
- Do NOT modify Gmail extraction (already done in TASK-909)
- Do NOT change UI to show Message-ID

## Deliverables

1. Update: `electron/main/services/outlookFetchService.ts` - Extract Message-ID
2. New tests: Unit tests for Message-ID extraction
3. Verify: Message-ID stored for Outlook emails during sync

## Acceptance Criteria

- [ ] Message-ID extracted from Outlook `internetMessageHeaders` or `internetMessageId`
- [ ] Message-ID stored in `message_id_header` column for new emails
- [ ] Unit tests verify extraction from various email formats
- [ ] >90% of Outlook emails have Message-ID extracted
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Microsoft Graph API

Outlook provides Message-ID in two ways:

**Option 1: internetMessageId property (preferred)**
```typescript
// Direct property on message object
const message = await client.api(`/me/messages/${id}`).get();
const messageId = message.internetMessageId;
// Returns: "<unique-id@example.com>"
```

**Option 2: internetMessageHeaders (fallback)**
```typescript
// Request headers explicitly
const message = await client.api(`/me/messages/${id}`)
  .select('internetMessageHeaders')
  .get();

const headers = message.internetMessageHeaders || [];
const messageIdHeader = headers.find(h => h.name === 'Message-ID');
const messageId = messageIdHeader?.value;
```

### Integration with Existing Code

Look at how TASK-906 (outlookFetchService.ts incremental sync) stores emails:

```typescript
// Find where emails are stored and add message_id_header
await db.prepare(`
  INSERT INTO messages (
    ...existing_columns,
    message_id_header
  ) VALUES (?, ?, ?, ...)
`).run(...existingValues, messageId);
```

### Reference: Gmail Implementation (TASK-909)

See `electron/main/services/gmailFetchService.ts` for pattern:

```typescript
// Gmail extracts from payload.headers
const headers = email.payload?.headers || [];
const messageIdHeader = headers.find(h =>
  h.name?.toLowerCase() === 'message-id'
);
const messageId = messageIdHeader?.value || null;
```

### Schema (Already Exists)

SPRINT-014 TASK-905 added the column:
```sql
ALTER TABLE messages ADD COLUMN message_id_header TEXT;
CREATE INDEX idx_messages_message_id_header ON messages(message_id_header);
```

## Integration Notes

- Imports from: `electron/main/services/outlookFetchService.ts`
- Exports to: Database via existing storage methods
- Used by: TASK-919 (duplicate linking)
- Depends on: TASK-916 (type safety baseline)

## Do / Don't

### Do:

- Use `internetMessageId` property first (simpler)
- Fall back to `internetMessageHeaders` if needed
- Handle missing Message-ID gracefully (store null)
- Log extraction rate for monitoring

### Don't:

- Fail sync if Message-ID is missing
- Store malformed Message-IDs (validate angle bracket format)
- Modify the Graph API request more than necessary
- Change Gmail implementation

## When to Stop and Ask

- If Graph API doesn't return internetMessageId
- If existing outlookFetchService.ts structure makes changes complex
- If you find the Message-ID field has unexpected format

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test Message-ID extraction from internetMessageId
  - Test fallback to internetMessageHeaders
  - Test handling of missing Message-ID
  - Test validation of Message-ID format
- Existing tests to update: None (additive change)

### Coverage

- Coverage impact: Should not decrease; adds new coverage

### Integration / Feature Tests

- Required scenarios:
  - Sync Outlook email with valid Message-ID
  - Verify Message-ID stored in database

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(outlook): extract Message-ID header for dedup`
- **Labels**: `enhancement`, `email`
- **Depends on**: TASK-916 (type safety)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Raw Estimate:** 4-6 turns, ~20K tokens, 25-35 min
**Adjustment Factor:** 1.0 (need more service category data)

**Estimated Totals:**
- **Turns:** 4-6
- **Tokens:** ~20K
- **Time:** ~25-35 min
- **Token Cap:** 80K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 1 service file | +2 |
| Graph API complexity | internetMessageId is simple | +1 |
| Test complexity | Medium (4 test cases) | +2 |
| Pattern reference | TASK-909 provides pattern | -1 |

**Confidence:** Medium

**Risk factors:**
- Graph API may require additional request options
- outlookFetchService.ts structure may have changed in SPRINT-014

**Similar past tasks:** TASK-909 (Gmail Message-ID) - similar scope

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop (AFTER TASK-916 merged)
**Branch Into:** develop
**Branch Name:** feature/TASK-917-outlook-message-id

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Execution Classification

- **Parallel Safe:** NO (Phase 3 sequential)
- **Depends On:** TASK-916 (type safety baseline)
- **Blocks:** TASK-918, TASK-919

### Shared File Analysis

| File | This Task | Conflicts With |
|------|-----------|----------------|
| `electron/main/services/outlookFetchService.ts` | Message-ID extraction | TASK-918, TASK-919 (sequential) |

### Technical Considerations

- Mirrors TASK-909 (Gmail Message-ID) pattern
- Use `internetMessageId` property first, fall back to `internetMessageHeaders`
- Schema column already exists from SPRINT-014 TASK-905
- Must merge before TASK-918 to avoid conflicts on outlookFetchService.ts

### Worktree Command (for this task)

```bash
# After TASK-916 is merged:
git -C /Users/daniel/Documents/Mad pull origin develop
git -C /Users/daniel/Documents/Mad worktree add ../Mad-task-917 -b feature/TASK-917-outlook-message-id develop
```

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
Files modified:
- [ ] electron/main/services/outlookFetchService.ts

Tests added:
- [ ] Message-ID extraction tests
- [ ] Fallback handling tests

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] Message-ID stored in database
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
<Key decisions from planning phase>

**Deviations from plan:**
<If any. If none, write "None">

**Design decisions:**
<Document any decisions made>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 1 | X | +/- X | <reason> |
| Test cases | 4 | X | +/- X | <reason> |
| API complexity | Simple | X | N/A | <assessment> |

**Total Variance:** Est 4-6 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
