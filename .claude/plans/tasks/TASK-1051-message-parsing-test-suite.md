# Task TASK-1051: Comprehensive Message Parsing Test Suite

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

Create a comprehensive test suite for the message parsing system that covers all format types, edge cases, and regression scenarios. Include tests using real-world sample data from the test data document.

## Non-Goals

- Do NOT modify parser implementation (that was Phase 1-2)
- Do NOT add new features to the parser
- Do NOT test UI components (MessageThreadCard, etc.)
- Do NOT create integration tests that hit the actual macOS Messages database

## Deliverables

1. Update: `electron/utils/__tests__/messageParser.test.ts` - Comprehensive test suite
2. New file: `electron/utils/__tests__/fixtures/messageParserFixtures.ts` - Test fixtures
3. Update: `electron/utils/__tests__/encodingUtils.test.ts` - Update for deprecated functions

## Acceptance Criteria

- [ ] Test coverage for `extractTextFromAttributedBody` is >90%
- [ ] Test coverage for `extractTextFromBinaryPlist` is >90%
- [ ] Test coverage for `extractTextFromTypedstream` is >90%
- [ ] Test coverage for `getMessageText` is >90%
- [ ] Tests include real-world buffer samples from test data document
- [ ] Tests verify no garbage text is returned (Chinese characters in English messages)
- [ ] Tests verify fallback message is returned for unparseable content
- [ ] All CI checks pass

## Implementation Notes

### Test Structure

```typescript
// electron/utils/__tests__/messageParser.test.ts

describe("Message Parser", () => {
  describe("Format Detection", () => {
    describe("isBinaryPlist", () => { /* ... */ });
    describe("isTypedstream", () => { /* ... */ });
    describe("detectAttributedBodyFormat", () => { /* ... */ });
  });

  describe("Binary Plist Extraction", () => {
    describe("extractTextFromBinaryPlist", () => {
      it("extracts text from valid NSKeyedArchiver plist");
      it("handles NS.string property");
      it("handles NSString property");
      it("filters metadata strings");
      it("returns null for empty $objects");
      it("returns null for non-NSKeyedArchiver format");
      it("returns null for malformed plist");
    });
  });

  describe("Typedstream Extraction", () => {
    describe("extractTextFromTypedstream", () => {
      it("handles regular preamble (0x94)");
      it("handles mutable preamble (0x95)");
      it("handles extended length format (0x81)");
      it("returns longest string when multiple NSStrings");
      it("filters metadata strings");
      it("returns null when no NSString marker");
      it("returns null for malformed buffer");
    });
  });

  describe("Main Parser Flow", () => {
    describe("extractTextFromAttributedBody", () => {
      it("routes bplist format correctly");
      it("routes typedstream format correctly");
      it("returns fallback for unknown format");
      it("returns fallback when parser returns null");
      it("cleans extracted text properly");
      it("handles null buffer");
      it("handles empty buffer");
    });
  });

  describe("Message Text Getter", () => {
    describe("getMessageText", () => {
      it("uses text field when valid");
      it("falls back to attributedBody");
      it("returns attachment fallback");
      it("returns reaction fallback");
    });
  });

  describe("Regression Tests", () => {
    it("does not return garbage for real-world bplist sample");
    it("does not return garbage for real-world typedstream sample");
    it("handles the Eric bug chat samples");
    it("parses rich message with link");
    it("parses calendar event message");
  });
});
```

### Test Fixtures

```typescript
// electron/utils/__tests__/fixtures/messageParserFixtures.ts

/**
 * Real-world test fixtures for message parsing
 *
 * These buffers are derived from actual macOS Messages database samples
 * with content anonymized.
 */

// Binary plist containing "Hello, world!"
export const BPLIST_SIMPLE = Buffer.from([
  0x62, 0x70, 0x6c, 0x69, 0x73, 0x74, 0x30, 0x30, // "bplist00"
  // ... NSKeyedArchiver structure
]);

// Typedstream with regular preamble
export const TYPEDSTREAM_REGULAR = Buffer.from([
  0x73, 0x74, 0x72, 0x65, 0x61, 0x6d, 0x74, 0x79, 0x70, 0x65, 0x64, // "streamtyped"
  // ... NSString with 0x94 preamble
]);

// Typedstream with mutable preamble (rich message with link)
export const TYPEDSTREAM_MUTABLE = Buffer.from([
  0x73, 0x74, 0x72, 0x65, 0x61, 0x6d, 0x74, 0x79, 0x70, 0x65, 0x64, // "streamtyped"
  // ... NSMutableString with 0x95 preamble
]);

// Sample that previously produced garbage (from test data)
export const GARBAGE_SAMPLE = Buffer.from([
  // Hex data from message 137fcf4a-493b-4048-a84d-87fba1b22403
]);

// Helper to create simple typedstream
export function createTypedstreamBuffer(
  text: string,
  preamble: 'regular' | 'mutable' = 'regular'
): Buffer {
  const marker = Buffer.from('streamtyped');
  const nsString = Buffer.from('NSString');
  const preambleBytes = preamble === 'regular'
    ? Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b])
    : Buffer.from([0x01, 0x95, 0x84, 0x01, 0x2b]);
  const textBytes = Buffer.from(text, 'utf8');
  const length = textBytes.length < 128
    ? Buffer.from([textBytes.length])
    : Buffer.from([0x81, textBytes.length & 0xff, (textBytes.length >> 8) & 0xff]);

  return Buffer.concat([marker, nsString, preambleBytes, length, textBytes]);
}

// Helper to create simple bplist (simplified, not full NSKeyedArchiver)
export function createBinaryPlistBuffer(text: string): Buffer {
  // This is a simplified mock - real bplist creation is complex
  // For testing, we use the real simple-plist library to create valid plists
  return Buffer.from('bplist00' + text); // Placeholder
}
```

### Garbage Detection Test

```typescript
describe("Garbage Detection", () => {
  it("does not return Chinese characters for English message", async () => {
    const buffer = GARBAGE_SAMPLE; // From test data
    const result = await extractTextFromAttributedBody(buffer);

    // Should NOT contain common garbage patterns
    expect(result).not.toMatch(/[\u4e00-\u9fff]/); // No CJK characters
    expect(result).not.toMatch(/\u0904/); // No Devanagari
    expect(result).not.toContain("streamtyped"); // No raw marker

    // Should either be readable or fallback
    const isReadable = /^[\x20-\x7E\s]+$/.test(result);
    const isFallback = result === FALLBACK_MESSAGES.UNABLE_TO_PARSE;
    expect(isReadable || isFallback).toBe(true);
  });
});
```

### Test Data Reference

From `.claude/plans/test-data/message-parsing-test-data.md`:

**Garbage Text Samples:**
- `137fcf4a-493b-4048-a84d-87fba1b22403` (macos-chat-2004)
- `df350199-6efd-42ee-9f5a-775bdbf22578` (macos-chat-2742)

**NULL Thread ID Samples:**
- `0deecf46-3988-4829-bff3-c86c3e223eb1`
- `dd348263-1e8e-41a4-95fb-f178f4dc6602`

## Integration Notes

- Imports from: messageParser (functions under test), constants
- Depends on: TASK-1049 (all parser functions finalized)

## Do / Don't

### Do:

- Create comprehensive test coverage
- Use real-world buffer samples where possible
- Test edge cases (empty, null, malformed)
- Verify no garbage text is returned
- Use descriptive test names

### Don't:

- Don't modify parser implementation
- Don't create integration tests hitting real database
- Don't include PII in test fixtures
- Don't make tests flaky (use deterministic samples)

## When to Stop and Ask

- If you need to access the real macOS Messages database for samples
- If creating valid binary plist fixtures is too complex
- If test coverage requirements seem impossible to meet
- If you discover untested edge cases in the parser

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (this IS the test task)
- Target coverage: >90% for all parser functions

### Coverage

- Coverage must not decrease
- New coverage targets:
  - `extractTextFromAttributedBody`: >90%
  - `extractTextFromBinaryPlist`: >90%
  - `extractTextFromTypedstream`: >90%
  - `getMessageText`: >90%

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Coverage checks (>90% for parser)
- [x] Type checking
- [x] Lint / format checks

**PRs without meeting coverage targets WILL BE REJECTED.**

## PR Preparation

- **Title**: `test(parser): comprehensive message parsing test suite`
- **Labels**: `test`, `parser`, `phase-3`
- **Depends on**: TASK-1049

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~25K-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 fixture file | +5K |
| Files to modify | 2 test files | +15K |
| Code volume | ~500 lines of tests | +10K |
| Test complexity | High (buffer creation, coverage) | +10K |

**Confidence:** Medium

**Risk factors:**
- Creating valid binary plist fixtures
- Achieving 90% coverage may require more tests
- Finding real-world samples without PII

**Similar past tasks:** Test category: 0.9x multiplier

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
Files created:
- [ ] electron/utils/__tests__/fixtures/messageParserFixtures.ts

Files modified:
- [ ] electron/utils/__tests__/messageParser.test.ts
- [ ] electron/utils/__tests__/encodingUtils.test.ts

Coverage achieved:
- [ ] extractTextFromAttributedBody: X%
- [ ] extractTextFromBinaryPlist: X%
- [ ] extractTextFromTypedstream: X%
- [ ] getMessageText: X%

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Coverage meets 90% target
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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~30K | ~XK | +/-X% |
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
