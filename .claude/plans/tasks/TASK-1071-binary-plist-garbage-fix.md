# Task TASK-1071: Complete Binary Plist Garbage Text Fix

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

Eliminate the remaining garbage text (Chinese/Japanese-like characters) that appears in message display when binary plist data is misinterpreted.

**IMPORTANT (SR Engineer Note):** The `looksLikeBinaryGarbage` function was **removed in TASK-1049** in favor of deterministic format detection. The current architecture uses:
- `detectAttributedBodyFormat()` - magic byte detection
- `extractTextFromBinaryPlist()` - for bplist00 format
- `extractTextFromTypedstream()` - for typedstream format

The garbage text issue now likely occurs because:
1. The `text` field already contains garbage (not `attributedBody`)
2. Or the buffer detection is failing for certain edge cases

Engineer should investigate the actual data flow before implementing.

## Non-Goals

- Do NOT add new message parsing features
- Do NOT refactor the entire parser architecture
- Do NOT modify the database schema
- Do NOT change how messages are stored
- Do NOT fix unrelated encoding issues

## Deliverables

1. Update: `electron/utils/messageParser.ts` - Improve `looksLikeBinaryGarbage` detection
2. Possible update: `electron/utils/encodingUtils.ts` - Add encoding detection helpers

## Acceptance Criteria

- [ ] No garbage text (CJK characters) appears in message display
- [ ] Binary plist data is properly detected and handled
- [ ] Legitimate CJK text is NOT filtered (false positive check)
- [ ] Existing message parsing tests pass
- [ ] All CI checks pass

## Implementation Notes

### Problem Analysis (from BACKLOG-229)

**Current garbage detection checks:**
1. Literal "bplist" or "streamtyped" strings
2. >30% unusual characters (code > 255)

**Why current detection fails:**

When binary data is read as UTF-16 and displayed as UTF-8:
- "streamtyped" becomes `???????` (garbled Chinese characters)
- The literal string check fails because the magic bytes are reinterpreted
- The 30% threshold may not trigger depending on byte distribution

**Example garbage output:**
```
????????????????????????????__kIMBaseWritingDirectionAttributeName????
```

This contains:
- Binary plist metadata keys (`__kIM*`)
- UTF-16 misinterpreted bytes appearing as CJK characters

### Investigation Strategy (Updated by SR Engineer)

Since `looksLikeBinaryGarbage` was removed, the engineer should:

1. **Trace the garbage data source:**
   - Is garbage in `message.text` field or `attributedBody`?
   - Run diagnostic: `window.api.system.diagnosticGarbageText(userId)`
   - Check specific message IDs from test data

2. **If garbage is in `text` field:**
   - The issue is at data import/storage time, not parsing time
   - May need to add garbage detection at import step
   - Consider adding `looksLikeBinaryGarbage()` back as a pre-filter

3. **If garbage is in `attributedBody` but not being detected:**
   - Check if buffer encoding is wrong (UTF-16 vs raw bytes)
   - Verify `detectAttributedBodyFormat()` handles all cases

**Proposed approach (if garbage is in text field):**

```typescript
// Add to electron/utils/messageParser.ts (or new garbage detection module)

/**
 * Check if text appears to be binary garbage (UTF-16 misinterpreted bytes)
 * Used as a pre-filter before storing/displaying text
 */
export function looksLikeBinaryGarbage(text: string): boolean {
  if (!text || text.length < 5) return false;

  // 1. UTF-16 interpreted "streamtyped" produces specific Oriya characters
  // "st" as UTF-16 LE = 0x7473 = ଄ (Oriya digit 4)
  // "re" as UTF-16 LE = 0x6572 = 敲 (CJK character)
  // From test data: "଄瑳敲浡祴数..."
  const oriyaPattern = /[\u0B00-\u0B7F]/; // Oriya Unicode block
  const cjkMixedPattern = /[\u0B00-\u0B7F].*[\u4E00-\u9FFF]/; // Oriya + CJK together

  if (oriyaPattern.test(text) && cjkMixedPattern.test(text)) {
    return true;
  }

  // 2. Check for metadata strings that leaked through
  if (/__kIM|NSString|NSMutable|AttributeName/.test(text)) {
    return true;
  }

  return false;
}
```

### Testing Strategy

1. **Create test cases for known garbage samples:**
   ```typescript
   describe("looksLikeBinaryGarbage", () => {
     it("detects UTF-16 interpreted streamtyped", () => {
       const garbage = "????????????"; // From BACKLOG-229
       expect(looksLikeBinaryGarbage(garbage)).toBe(true);
     });

     it("allows legitimate CJK text", () => {
       const chinese = "??????????????????"; // "Hello, world!" in Chinese
       expect(looksLikeBinaryGarbage(chinese)).toBe(false);
     });
   });
   ```

2. **Verify with diagnostic output:**
   Run app and check that no messages show garbage text.

### Reference: Garbage Samples

From `.claude/plans/test-data/message-parsing-test-data.md`:
- Message `137fcf4a-493b-4048-a84d-87fba1b22403` (macos-chat-2004)
- Message `df350199-6efd-42ee-9f5a-775bdbf22578` (macos-chat-2742)

## Integration Notes

- Does not depend on TASK-1070 (different files)
- TASK-1072 depends on this task (user verification)
- Related to BACKLOG-229 (binary plist garbage issue)

## Do / Don't

### Do:

- Start by examining current `looksLikeBinaryGarbage` implementation
- Test with known garbage samples from BACKLOG-229
- Add tests for false positive cases (legitimate CJK)
- Verify existing parser tests still pass

### Don't:

- Don't filter out legitimate CJK text
- Don't change the overall parsing flow
- Don't modify how messages are stored
- Don't add complex NLP-based detection

## When to Stop and Ask

- If you cannot find a pattern that catches all garbage without false positives
- If the garbage text source is different than expected (not binary plist)
- If fixing this requires changes to database storage
- If you need access to real user data to verify

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `looksLikeBinaryGarbage` with UTF-16 interpreted binary
  - `looksLikeBinaryGarbage` with legitimate CJK text (false positive check)
  - `looksLikeBinaryGarbage` with metadata patterns
- Existing tests to update:
  - Any tests that check for garbage detection

### Coverage

- Coverage impact: Should maintain or improve

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

**PRs without tests WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(parser): improve binary plist garbage detection`
- **Labels**: `bug-fix`, `parser`, `data-integrity`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~45K-55K

**Token Cap:** 220K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1-2 (messageParser, encodingUtils) | +15K |
| Detection logic | Multiple pattern checks | +15K |
| Test coverage | 5+ new test cases | +15K |
| Verification | Manual testing with sample data | +10K |

**Confidence:** Medium

**Risk factors:**
- Balancing detection sensitivity vs false positives
- May discover more garbage patterns than expected

**Similar past tasks:** Service category: 0.5x multiplier applied = ~50K

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
- [ ] electron/utils/messageParser.ts
- [ ] electron/utils/encodingUtils.ts (if needed)
- [ ] electron/utils/__tests__/messageParser.test.ts

Detection improvements:
- [ ] UTF-16 interpreted binary pattern check
- [ ] Metadata pattern check (__kIM, NSString)
- [ ] Adjusted unusual character threshold
- [ ] Binary magic byte check

False positive protection:
- [ ] Legitimate CJK text test passes
- [ ] Legitimate emoji test passes

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual verification with known garbage samples
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

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~50K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2026-01-15 | **Status:** APPROVED WITH NOTES

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `fix/task-1071-garbage-text-detection`

### Execution Classification
- **Parallel Safe:** YES (with TASK-1070)
- **Depends On:** None
- **Blocks:** TASK-1072 (user verification)

### Shared File Analysis
- Files modified: `electron/utils/messageParser.ts`, `electron/utils/__tests__/messageParser.test.ts`
- Conflicts with: None - completely isolated from TASK-1070

### Technical Considerations
- **CRITICAL:** Task description references `looksLikeBinaryGarbage` which was REMOVED in TASK-1049
- Current architecture uses deterministic format detection (`detectAttributedBodyFormat()`)
- Engineer MUST investigate data flow first before implementing
- Garbage pattern from test data: `଄瑳敲浡祴数...` (Oriya + CJK mix)
- Test data available at `.claude/plans/test-data/message-parsing-test-data.md`

### SR Risk Assessment
- **Risk Level:** MEDIUM
- False positive risk: legitimate CJK text could be filtered
- Requires investigation step before implementation
- False positive test cases are MANDATORY

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
