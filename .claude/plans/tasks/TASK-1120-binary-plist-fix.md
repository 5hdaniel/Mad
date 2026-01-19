# Task TASK-1120: Fix Binary Plist Text Garbage

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

Fix the iosMessagesParser to properly decode binary plist content so that messages display as readable text instead of garbage characters.

## Background

BACKLOG-229 was partially addressed in SPRINT-036 (TASK-1035) but remains incomplete. Users still see garbled text for messages that contain binary plist encoded content. This is a CRITICAL data integrity issue affecting message readability.

## Non-Goals

- Do NOT rewrite the entire iosMessagesParser
- Do NOT change message storage schema
- Do NOT modify message display components (beyond verifying they work)
- Do NOT address BACKLOG-231 (test failures) unless directly blocking this fix

## Deliverables

1. Update: `electron/utils/messageParser.ts` (primary - contains plist parsing)
2. Possibly update: `electron/services/iosMessagesParser.ts` (if text field handling needed)
3. Possibly update: `electron/utils/encodingUtils.ts` (encoding detection)
4. Tests: Update `electron/utils/__tests__/messageParser.test.ts`

## Acceptance Criteria

- [ ] Binary plist messages decode to readable text
- [ ] Existing message formats (non-plist) still parse correctly
- [ ] No regression in message parsing performance
- [ ] All existing passing tests continue to pass
- [ ] New tests cover binary plist edge cases
- [ ] All CI checks pass

## Implementation Notes

### Root Cause Analysis

**IMPORTANT:** Extensive prior work exists on this issue (TASK-1035, TASK-1046-1049). The current `messageParser.ts` already handles binary plist decoding. The remaining issue is likely:

1. **`text` field already contains garbage** before reaching the parser
2. **`attributedBody` parsing edge cases** not covered by existing detection
3. **Different plist variant** (bplist15, etc.) not recognized

Binary plist content may be appearing in:
1. `attributedBody` field of iMessage database (HANDLED by existing code)
2. `text` field that was incorrectly stored with garbage (PARTIAL handling via `looksLikeBinaryGarbage()`)
3. Reaction/tapback data with different encoding

### Investigation Steps

1. **Review existing implementation** in `electron/utils/messageParser.ts`
2. Check if `looksLikeBinaryGarbage()` is catching all garbage patterns
3. Look at ACTUAL user data to see if issue is in `text` field or `attributedBody`
4. Check for plist variants not starting with `bplist00`
5. Review TASK-1035 completion notes for known gaps

### Key Code to Review

```typescript
// CORRECT FILE - Binary plist parsing is here:
electron/utils/messageParser.ts
  - isBinaryPlist()           // Detects bplist00 magic bytes
  - extractTextFromBinaryPlist() // Parses using simple-plist
  - detectAttributedBodyFormat() // Deterministic format detection
  - looksLikeBinaryGarbage()   // Detects garbage in text field
  - getMessageText()          // Main entry point

// iosMessagesParser.ts reads raw data, does NOT decode plist:
electron/services/iosMessagesParser.ts
  - mapMessage()              // Just reads text field as-is

// Tests (may need updating):
electron/utils/__tests__/messageParser.test.ts
```

### Known Challenges

- BACKLOG-231 documents 20 failing iosMessagesParser tests
- These may be related to mock setup issues, not the actual parser logic
- May need to fix test setup first to validate changes

## Integration Notes

- Imports from: SQLite database service, plist library
- Exports to: Message display components
- Used by: iMessage sync flow
- Depends on: Properly formed iMessage backup data

## Do / Don't

### Do:
- Add comprehensive logging for debugging plist decoding
- Handle multiple binary plist variants (bplist00, bplist15, etc.)
- Test with real-world message samples
- Preserve backward compatibility with already-imported messages

### Don't:
- Don't change the message schema
- Don't modify how messages are stored, only how they're decoded
- Don't ignore edge cases - binary plists have many variants
- Don't skip testing with actual device backups

## When to Stop and Ask

- If the binary plist library is fundamentally incompatible with message format
- If fixing this requires schema changes
- If BACKLOG-231 test failures block validation of the fix
- If the issue is in Apple's message format (not our parsing)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test binary plist detection (bplist00 magic)
  - Test decoding various binary plist types
  - Test fallback behavior for corrupted plists
  - Test mixed content (plist + plaintext)
- Existing tests to update:
  - May need to update test fixtures with binary samples

### Coverage

- Coverage impact: Must not decrease
- Focus on: `iosMessagesParser.ts` plist handling paths

### Integration / Feature Tests

- Required scenarios:
  - Parse message with binary plist attributedBody
  - Parse message with nested plist content
  - Parse existing (non-plist) messages (regression)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(parser): decode binary plist message content`
- **Labels**: `bug`, `data-integrity`, `critical`
- **Depends on**: None

---

## SR Engineer Pre-Implementation Review

**Review Date:** - | **Status:** PENDING

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1120-binary-plist

### Execution Classification
- **Parallel Safe:** Yes (Phase 1, isolated parser work)
- **Depends On:** None
- **Blocks:** TASK-1122 (Phase 2 depends on Phase 1 completing)

### Shared File Analysis
- **Primary file:** `electron/utils/messageParser.ts` (contains plist parsing logic)
- **Secondary files:** `electron/services/iosMessagesParser.ts`, `electron/utils/encodingUtils.ts`
- **Conflicts with:** None - isolated parser internals
- **Prior work:** TASK-1035, TASK-1046-1049 - review before starting

### Technical Considerations

*(To be completed by SR Engineer)*

### Architecture Notes

*(To be completed by SR Engineer)*

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~40K

**Token Cap:** 160K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Investigation | Understand plist format | +10K |
| Implementation | Decode logic | +15K |
| Testing | Binary samples, edge cases | +10K |
| Complexity | Medium-High - binary format handling | +5K |

**Confidence:** Medium

**Risk factors:**
- Binary plist format complexity
- Multiple encoding variants
- BACKLOG-231 test failures may complicate validation

**Similar past tasks:** TASK-1035 (previous attempt) was incomplete

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
- [ ] electron/services/iosMessagesParser.ts
- [ ] (other files as needed)

Features implemented:
- [ ] Binary plist detection
- [ ] Binary plist decoding
- [ ] Fallback for malformed plists

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Will be captured on session completion

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | - |
| Cache Create | - |

**Variance:** PM Est ~40K vs Actual XK (X%)

### Notes

**Planning notes:**
<What you discovered during investigation>

**Deviations from plan:**
<Any changes from the original task description>

**Design decisions:**
<Key choices made and rationale>

**Issues encountered:**
<Problems faced and how resolved>

**Reviewer notes:**
<Notes for SR Engineer review>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | XK | X% |
| Duration | - | X min | - |

**Root cause of variance:**
<Explain why estimate differed from actual>

**Suggestion for similar tasks:**
<Recommendation for future estimates>

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
