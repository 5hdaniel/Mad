# Task TASK-1070: Fix Failing iosMessagesParser Tests

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

Fix the 20 failing tests in `iosMessagesParser.test.ts` by correcting the mock database setup to properly represent the iOS Messages database structure.

## Non-Goals

- Do NOT add new parser functionality
- Do NOT expand test coverage beyond fixing existing tests
- Do NOT modify production parser code unless absolutely necessary to make tests pass
- Do NOT refactor the test file structure
- Do NOT fix other test files (focus only on iosMessagesParser)

## Deliverables

1. Update: `electron/services/__tests__/iosMessagesParser.test.ts` - Fix mock database setup
2. Possible update: `electron/services/iosMessagesParser.ts` - Only if parser has bugs exposed by proper test data

## Acceptance Criteria

- [ ] All 46 tests in `iosMessagesParser.test.ts` pass
- [ ] `npm test -- --testPathPattern=iosMessagesParser` returns 0 failures
- [ ] No regressions in other test files
- [ ] All CI checks pass

## Implementation Notes

### Current Test Failure Analysis (from BACKLOG-231)

| Failure Category | Count | Root Cause |
|------------------|-------|------------|
| Empty conversations | 3 | Mock returns 0 when 3 expected |
| Non-existent path handling | 1 | Parser doesn't throw correctly |
| Group chat detection | 3+ | `find()` returns undefined |
| Message retrieval | 3+ | Messages array empty |
| Message attributes | 10+ | `fromMe`, `sender`, `recipient` not populated |

### Mock Database Schema

The current mock creates these tables but may not insert data correctly:

```sql
-- Required tables (verify all exist with correct columns)
CREATE TABLE handle (ROWID, id, service);
CREATE TABLE chat (ROWID, guid, chat_identifier, display_name);
CREATE TABLE message (ROWID, guid, text, handle_id, is_from_me, date, ...);
CREATE TABLE attachment (ROWID, guid, filename, mime_type, transfer_name);
CREATE TABLE chat_handle_join (chat_id, handle_id);
CREATE TABLE chat_message_join (chat_id, message_id);
CREATE TABLE message_attachment_join (message_id, attachment_id);
```

### Diagnostic Steps

1. **Run tests and capture output:**
   ```bash
   npm test -- --testPathPattern=iosMessagesParser --verbose 2>&1 | head -200
   ```

2. **Identify failing assertions:**
   Look for patterns like:
   - `expected 3 but received 0`
   - `undefined is not an object`
   - `expect(received).toBeDefined()`

3. **Compare schema to actual iOS sms.db:**
   The actual iOS database may have additional columns the mock is missing.

### Common Mock Database Issues

1. **Missing foreign key relationships:**
   ```typescript
   // WRONG: Insert message without linking to chat
   db.exec(`INSERT INTO message (ROWID, guid, text) VALUES (1, 'msg-1', 'Hello')`);

   // RIGHT: Must also insert into chat_message_join
   db.exec(`INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date)
            VALUES (1, 'msg-1', 'Hello', 1, 0, 700000000000000000)`);
   db.exec(`INSERT INTO chat_message_join (chat_id, message_id) VALUES (1, 1)`);
   ```

2. **Missing handle_id on messages:**
   Messages need valid `handle_id` to determine sender.

3. **Incorrect date format:**
   iOS uses Apple Cocoa timestamps (nanoseconds since 2001-01-01).

4. **Group chat detection:**
   Group chats have multiple entries in `chat_handle_join` for the same `chat_id`.

### Expected Test Structure

```typescript
describe("iOSMessagesParser", () => {
  describe("getConversations", () => {
    it("returns all conversations", async () => {
      const conversations = await parser.getConversations();
      expect(conversations).toHaveLength(3); // Must have 3 chats in mock
    });

    it("identifies group chats", async () => {
      const conversations = await parser.getConversations();
      const group = conversations.find(c => c.isGroup);
      expect(group).toBeDefined(); // chat_handle_join must have multiple handles
    });
  });

  describe("getMessages", () => {
    it("returns messages for a conversation", async () => {
      const messages = await parser.getMessages("chat-guid-1");
      expect(messages).toHaveLength(3); // Must have 3 messages in mock
    });
  });
});
```

## Integration Notes

- Related to: BACKLOG-231 (source of this work)
- Does not depend on other SPRINT-038 tasks
- TASK-1071 can run in parallel (different files)

## Do / Don't

### Do:

- Start by running tests and understanding exact failures
- Fix mock data to match what parser expects
- Verify all 46 tests pass after changes
- Run full test suite to check for regressions

### Don't:

- Don't modify parser logic to match broken mock data
- Don't add new tests (only fix existing)
- Don't change test assertions unless they're genuinely wrong
- Don't disable or skip tests

## When to Stop and Ask

- If you need to modify parser logic significantly to make tests pass
- If you discover the test assertions themselves are incorrect
- If you need access to a real iOS sms.db to understand schema
- If more than 5 tests require understanding actual iOS database behavior

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this IS a test fix task)
- Existing tests to fix: 20 tests in iosMessagesParser.test.ts

### Coverage

- Coverage impact: Should improve (fixing failing tests)

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests (ALL 46 must pass)
- [x] Type checking
- [x] Lint / format checks

**PRs with failing tests WILL BE REJECTED.**

## PR Preparation

- **Title**: `test(ios-parser): fix mock database setup for 20 failing tests`
- **Labels**: `test`, `bug-fix`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~35K-45K

**Token Cap:** 180K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 test/parser files | +15K |
| Diagnostic time | Understanding 20 failures | +10K |
| Mock data fixes | Multiple insert statements | +10K |
| Verification | Running test suite multiple times | +10K |

**Confidence:** Medium

**Risk factors:**
- May need to understand actual iOS sms.db schema
- Some test assertions may be incorrect (not just mock data)

**Similar past tasks:** Test category: 0.9x multiplier applied = ~40K

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
- [ ] electron/services/__tests__/iosMessagesParser.test.ts
- [ ] electron/services/iosMessagesParser.ts (if needed)

Tests fixed:
- [ ] getConversations tests (count: X)
- [ ] getMessages tests (count: X)
- [ ] Message attribute tests (count: X)
- [ ] Error handling tests (count: X)

Verification:
- [ ] npm test -- --testPathPattern=iosMessagesParser (46/46 pass)
- [ ] npm test (full suite passes)
- [ ] npm run type-check passes
- [ ] npm run lint passes
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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

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
**Security Review:** N/A (test changes only)
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
