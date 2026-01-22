# Task TASK-1048: Enhance Typedstream Metadata Filtering Consistency

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

Enhance metadata filtering in `extractTextFromTypedstream` by extracting inline checks to use the existing `isTypedstreamMetadata` function for consistency.

## Non-Goals

- Do NOT modify binary plist parsing (that's TASK-1047)
- Do NOT integrate with main parser flow yet (that's TASK-1049)
- Do NOT refactor the core parsing logic - it already handles both preambles correctly
- Do NOT add multi-encoding heuristics - parse bytes deterministically

## Deliverables

1. Update: `electron/utils/messageParser.ts` - Extract inline metadata checks to use `isTypedstreamMetadata`
2. Update: `electron/utils/__tests__/messageParser.test.ts` - Add tests for metadata filtering

## Acceptance Criteria

- [ ] Inline metadata checks (around lines 228-234) extracted to use `isTypedstreamMetadata`
- [ ] No duplication of metadata patterns between inline checks and the function
- [ ] Existing behavior preserved (both 0x94 and 0x95 preambles work)
- [ ] Unit tests verify metadata filtering consistency
- [ ] All CI checks pass

## Implementation Notes

### Current Code Analysis

The existing `extractTextFromTypedstream` function already:
- Handles REGULAR preamble (0x94)
- Handles MUTABLE preamble (0x95)
- Reads length bytes correctly (single byte and 0x81 extended format)
- Has an `isTypedstreamMetadata` helper function

### Enhancement Required

The function has some inline metadata checks that duplicate the `isTypedstreamMetadata` function's logic. Extract these inline checks to use the function for consistency:

```typescript
// BEFORE: Inline checks around lines 228-234
if (text.includes("NSAttributedString") || text.includes("NSObject")) {
  continue;
}

// AFTER: Use the existing helper function
if (isTypedstreamMetadata(text)) {
  continue;
}
```

### What NOT to Change

- Core parsing logic - already works correctly
- Preamble handling - already supports both 0x94 and 0x95
- Length byte reading - already handles both single byte and 0x81 format
- Return type - already returns `null` on failure

### The `isTypedstreamMetadata` Function

The function already exists and handles:
- NSAttributedString, NSMutableString, NSObject, NSDictionary, NSArray, NSString, NSData
- $class, $objects, $archiver, $version, $top
- NS. prefix patterns
- __kIM patterns, kIMMessagePart, AttributeName
- streamtyped marker
- Hex-like strings

## Integration Notes

- Imports from: `logService` (existing)
- Exports to: Used by TASK-1049 for integration
- Used by: `extractTextFromAttributedBody` after TASK-1049 integration
- Depends on: TASK-1046 (format detection - determines when to call this)

## Do / Don't

### Do:

- Extract inline metadata checks to use `isTypedstreamMetadata`
- Ensure no duplicate metadata pattern definitions
- Add tests for metadata filtering

### Don't:

- Don't refactor core parsing logic - it works correctly
- Don't add multi-encoding fallbacks (UTF-16, Latin-1)
- Don't change function signature
- Don't remove the imessage-parser fallback in main flow yet (that's TASK-1049)

## When to Stop and Ask

- If inline checks contain patterns NOT in `isTypedstreamMetadata` that should be added
- If extracting the inline checks changes behavior unexpectedly
- If tests reveal issues with existing parsing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Metadata strings are correctly filtered
  - Real message content passes through filtering
  - Inline checks and function produce same results
- Existing tests to update: None (extend existing test suite)

### Coverage

- Coverage impact: Must not decrease; refactored code must have test coverage

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [ ] Integration tests (N/A)
- [x] Coverage checks
- [x] Type checking
- [x] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(parser): consolidate typedstream metadata filtering`
- **Labels**: `refactor`, `parser`, `phase-1`
- **Depends on**: TASK-1046

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~6K-10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 2 files (parser + tests) | +4K |
| Code volume | ~10 lines refactor + ~80 lines test | +4K |
| Test complexity | Low (metadata filtering) | +2K |

**Confidence:** High

**Risk factors:**
- Minimal - extracting inline code to use existing function

**Similar past tasks:** Custom typedstream parser already exists (~similar complexity)

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
- [ ] electron/utils/messageParser.ts (extract inline checks)
- [ ] electron/utils/__tests__/messageParser.test.ts (add metadata filtering tests)

Features implemented:
- [ ] Inline metadata checks extracted to use isTypedstreamMetadata
- [ ] No duplicate pattern definitions
- [ ] Tests verify filtering consistency

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

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~8K | ~XK | +/-X% |
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
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/deterministic-message-parsing
