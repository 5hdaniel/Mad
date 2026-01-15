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

Eliminate the remaining garbage text (Chinese/Japanese-like characters) that appears in message display when binary plist data is misinterpreted. The `looksLikeBinaryGarbage` function needs to catch all cases of binary data being displayed as text.

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

### Proposed Detection Improvements

```typescript
// electron/utils/messageParser.ts

/**
 * Enhanced binary garbage detection
 */
export function looksLikeBinaryGarbage(text: string): boolean {
  if (!text || text.length === 0) return false;

  // 1. Check for literal binary markers
  if (text.includes("bplist") || text.includes("streamtyped")) {
    return true;
  }

  // 2. Check for UTF-16 interpreted binary patterns
  // "streamtyped" as UTF-16 produces specific characters
  const utf16StreamMarkers = [
    "\u7473", // 'st' as UTF-16
    "\u6572", // 're' as UTF-16
    "\u6D61", // 'am' as UTF-16
  ];
  if (utf16StreamMarkers.every((marker) => text.includes(marker))) {
    return true;
  }

  // 3. Check for metadata string patterns (even when garbled)
  const metadataPatterns = [
    /_?_?k?IM/i, // __kIM metadata keys
    /NSString/,
    /NSMutable/,
    /AttributeName/,
  ];
  if (metadataPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  // 4. Check for high density of unusual characters
  // Binary data as UTF-8 often has many characters > 0x7F
  let unusualCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Count: control chars, private use area, surrogates, unusual blocks
    if (
      code < 0x20 ||                    // Control characters
      (code >= 0x80 && code < 0xA0) ||  // Latin-1 control
      (code >= 0x0900 && code < 0x0980) || // Devanagari (common in garbage)
      (code >= 0xE000 && code < 0xF900) || // Private use area
      (code >= 0xD800 && code < 0xE000)    // Surrogates
    ) {
      unusualCount++;
    }
  }

  // Lower threshold: 15% unusual is suspicious
  if (unusualCount / text.length > 0.15) {
    return true;
  }

  // 5. Check for binary-like byte sequences at start
  // Many binary formats start with specific magic bytes
  const firstFewChars = text.slice(0, 20);
  if (/[\x00-\x08\x0E-\x1F]/.test(firstFewChars)) {
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
