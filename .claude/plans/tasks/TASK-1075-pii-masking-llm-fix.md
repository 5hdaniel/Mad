# Task TASK-1075: Fix Incomplete PII Masking in LLM Pipeline

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

## Task Overview

| Field | Value |
|-------|-------|
| **Task ID** | TASK-1075 |
| **Sprint** | SPRINT-039 |
| **Backlog Item** | BACKLOG-236 |
| **Priority** | HIGH |
| **Phase** | 2 |
| **Category** | security |
| **Estimated Tokens** | ~50K |
| **Token Cap** | 200K |

---

## Goal

Ensure all Personally Identifiable Information (PII) is properly masked before any content is sent to LLM providers (OpenAI, Claude, etc.). This prevents privacy violations and potential compliance issues.

## Non-Goals

- Do NOT change how LLM responses are processed
- Do NOT modify LLM provider integrations
- Do NOT add new LLM features
- Do NOT change summarization output format

## Deliverables

1. Update: `electron/services/llm/contentSanitizer.ts` - Complete PII masking
2. Update: Related LLM service files that pass content to providers
3. New: Comprehensive unit tests for PII masking
4. New: Integration tests verifying no PII reaches LLM calls

## Acceptance Criteria

- [ ] Email addresses masked: `john@example.com` -> `[EMAIL]`
- [ ] Phone numbers masked: `(555) 123-4567` -> `[PHONE]`
- [ ] Street addresses masked: `123 Main St, City, ST 12345` -> `[ADDRESS]`
- [ ] SSN/Tax IDs masked: `123-45-6789` -> `[SSN]`
- [ ] Credit card numbers masked: `4111-1111-1111-1111` -> `[CC]`
- [ ] Names are NOT masked (needed for context)
- [ ] Masking is applied before ALL LLM API calls
- [ ] Unit tests cover all PII patterns
- [ ] Integration tests verify masking in real flows
- [ ] All CI checks pass

## Implementation Notes

### Problem Analysis

Current state: The `contentSanitizer.ts` may have incomplete or missing PII masking patterns. Content with PII is being sent to external LLM providers.

### Key Patterns

PII masking regex patterns:

```typescript
// In contentSanitizer.ts

// Email addresses
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone numbers (US formats)
const PHONE_REGEX = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

// SSN
const SSN_REGEX = /\d{3}[-\s]?\d{2}[-\s]?\d{4}/g;

// Credit card numbers (basic patterns)
const CC_REGEX = /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g;

// Street addresses (basic US format)
const ADDRESS_REGEX = /\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court)[.,]?\s*(?:Apt|Suite|Unit|#)?\s*\d*[.,]?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi;

export function maskPII(content: string): string {
  let masked = content;
  masked = masked.replace(EMAIL_REGEX, '[EMAIL]');
  masked = masked.replace(PHONE_REGEX, '[PHONE]');
  masked = masked.replace(SSN_REGEX, '[SSN]');
  masked = masked.replace(CC_REGEX, '[CC]');
  masked = masked.replace(ADDRESS_REGEX, '[ADDRESS]');
  return masked;
}
```

### Integration Points

Find all places where content is sent to LLM:

```typescript
// Look for patterns like:
await openai.chat.completions.create({
  messages: [{ content: userContent }]  // Must mask userContent before this
});

// Or
await anthropic.messages.create({
  messages: [{ content: sanitizedContent }]  // Verify sanitization includes PII
});
```

### Files to Investigate

| File | Purpose |
|------|---------|
| `electron/services/llm/contentSanitizer.ts` | Main sanitization logic |
| `electron/services/llm/openaiService.ts` | OpenAI API calls |
| `electron/services/llm/anthropicService.ts` | Anthropic API calls |
| `electron/services/llm/summarizationService.ts` | High-level LLM orchestration |
| Any other files in `electron/services/llm/` | Check for direct API calls |

### Important Details

1. Order matters: Some regex patterns may overlap (e.g., phone in address)
2. Apply masking as late as possible (preserve original for display)
3. Log masked content for debugging (not original)
4. Consider international formats if used internationally

## Integration Notes

- Imports from: regex utilities
- Exports to: All LLM service files
- Used by: `summarizationService.ts`, direct LLM calls
- Depends on: None (but Phase 1 should complete first for stability)

## Do / Don't

### Do:

- Create comprehensive regex patterns for each PII type
- Test with real-world examples (use fake data)
- Apply masking at a single point before LLM calls
- Add logging to verify masking is applied
- Handle edge cases (international phones, various address formats)

### Don't:

- Mask names (they provide necessary context)
- Apply masking after LLM response (only before)
- Log original unmasked content anywhere
- Assume existing sanitization covers all cases
- Over-mask (don't mask things that aren't PII)

## When to Stop and Ask

- If PII patterns conflict with legitimate data
- If masking breaks LLM comprehension significantly
- If international formats are required but not specified
- If you find PII logging in existing code (security issue)
- If masking is applied in multiple inconsistent places

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test email masking: various formats (user@domain.com, user.name+tag@sub.domain.org)
  - Test phone masking: (555) 123-4567, 555-123-4567, 5551234567, +1 555 123 4567
  - Test SSN masking: 123-45-6789, 123 45 6789, 123456789
  - Test CC masking: 4111-1111-1111-1111, 4111111111111111
  - Test address masking: various US address formats
  - Test combined content with multiple PII types
  - Test that non-PII content is not modified

### Coverage

- Coverage impact: Should increase (new test file)

### Integration / Feature Tests

- Required scenarios:
  - Process an email with PII, verify LLM call has masked content
  - Summarize transaction communication, verify no PII in request
  - Verify LLM response still makes sense with masked input

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): complete PII masking in LLM pipeline`
- **Labels**: `security`, `llm`, `privacy`
- **Depends on**: Phase 1 tasks (TASK-1073, TASK-1074, TASK-1076)

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-4 LLM service files | +15K |
| Regex development | Multiple PII patterns | +15K |
| Test coverage | Comprehensive test suite | +15K |
| Integration verification | End-to-end testing | +5K |

**Confidence:** Medium

**Risk factors:**
- Regex edge cases may require iteration
- May need to modify multiple files
- International format support unclear

**Similar past tasks:** Security category uses 0.4x multiplier, but PII is complex

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
- [ ] electron/services/llm/contentSanitizer.ts
- [ ] <other files>

Features implemented:
- [ ] Email masking
- [ ] Phone masking
- [ ] SSN masking
- [ ] CC masking
- [ ] Address masking
- [ ] Masking applied before all LLM calls

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Integration tests verify no PII reaches LLM
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
| **Tokens** | ~50K | ~XK | +/-X% |
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
**Security Review:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-236 | Incomplete PII Masking in LLM Pipeline | Source backlog item |

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-15 | **Status:** APPROVED WITH NOTES

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1075-pii-masking-enhancement

### Execution Classification
- **Parallel Safe:** No - Phase 2
- **Depends On:** TASK-1073, TASK-1074, TASK-1076 (all Phase 1 tasks)
- **Blocks:** None

### Shared File Analysis
- Files modified: `contentSanitizer.ts`, potentially other LLM tools
- Conflicts with: None

### Technical Considerations

**Current State (verified via code review):**

The `contentSanitizer.ts` ALREADY EXISTS and has comprehensive patterns:
- Email addresses (with partial masking preserving structure)
- Phone numbers (with last 4 digits preserved)
- SSN (fully masked)
- Credit card numbers (last 4 preserved)
- Bank account numbers (last 4 preserved)
- IP addresses (fully masked)

The sanitizer is ALREADY USED in LLM tools:
- `analyzeMessageTool.ts` - sanitizes body and subject before LLM call
- `clusterTransactionsTool.ts` - uses sanitizer
- `extractContactRolesTool.ts` - uses sanitizer

**What Needs Verification/Enhancement:**

1. **Address masking**: The task mentions addresses should be masked, but `contentSanitizer.ts` has `PRESERVE_PATTERNS` that intentionally KEEP property addresses for real estate context. This is a DESIGN DECISION that should be reviewed:
   - Current: Property addresses are preserved (correct for real estate LLM analysis)
   - Task says: Addresses should be masked
   - **RECOMMENDATION:** Keep current behavior - property addresses are needed for LLM context

2. **Bank account pattern concern**: Pattern `\b\d{8,17}\b` is very broad and may over-match:
   - Could match transaction IDs, reference numbers, etc.
   - Consider adding context awareness or making pattern more specific

3. **Integration verification**: Ensure ALL LLM API calls go through sanitization:
   - Check `baseLLMService.ts` for direct calls
   - Check `llmService.ts` entry point
   - Verify no bypass paths exist

4. **Logging audit**: Verify no PII logging:
   - Check that `MaskedItem.original` is not logged in production
   - Review LLM service logging for potential PII exposure

### Testing Requirements
- Existing tests in `__tests__/contentSanitizer.test.ts` are comprehensive
- Add integration tests to verify masking before actual LLM API calls
- Add test for combined PII (email in address, phone in signature)

### Complexity Assessment
**Estimated Tokens:** ~50K may be HIGH if scope is verification + minor fixes
- If just verification: ~30K
- If major refactoring needed: ~50K appropriate
**Confidence:** Medium - scope depends on what gaps are found

### Risk Notes
- Do NOT change `PRESERVE_PATTERNS` without PM approval - property addresses are intentionally preserved
- Bank account pattern may need refinement to reduce false positives
