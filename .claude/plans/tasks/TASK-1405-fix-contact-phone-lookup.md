# Task TASK-1405: Fix Contact Phone Lookup Normalization

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Fix the contact phone lookup so that text thread contact names resolve correctly instead of showing "unknown" for 1:1 conversations with known contacts.

## Non-Goals

- Do NOT modify how contacts are imported
- Do NOT change how phone numbers are stored in the database
- Do NOT fix group chat display (different issue)
- Do NOT modify email contact resolution

## Deliverables

1. Update: Phone normalization in lookup flow (file TBD based on TASK-1401 findings)
2. Update/Create: Tests for phone normalization and lookup

## Acceptance Criteria

- [ ] 1:1 text conversations show contact name (not "unknown")
- [ ] Phone normalization handles common formats (+1, parentheses, dashes)
- [ ] International numbers work correctly
- [ ] Edge cases handled (extensions, short codes)
- [ ] Unit tests verify normalization matching
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

## Implementation Notes

### Root Cause (from TASK-1401 Investigation)

Based on investigation findings, the issue is likely:
1. Phone format mismatch between `contact_phones` table and `messages.participants`
2. `normalizePhoneForLookup()` not matching stored format
3. Lookup fallback returning "unknown" too early

### Files to Modify (TBD)

Based on TASK-1401 findings, likely candidates:
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- `electron/services/db/contactDbService.ts`
- `electron/services/iosContactsParser.ts`

### Expected Fix Pattern

Ensure consistent normalization:
```typescript
// Example normalization function
function normalizePhoneForLookup(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Handle US numbers (remove leading +1 or 1)
  if (normalized.startsWith('+1') && normalized.length === 12) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith('1') && normalized.length === 11) {
    normalized = normalized.slice(1);
  }

  return normalized;
}
```

### Verification Steps

1. Import contacts with various phone formats
2. Import text messages with matching numbers
3. Link text thread to transaction
4. Verify contact name displays (not "unknown")
5. Test with: +1 (555) 123-4567, 555-123-4567, 5551234567

## Integration Notes

- **Depends on**: TASK-1401 (investigation findings)
- **Related files**:
  - `electron/services/contactsService.ts` - contact lookup service
  - `src/components/transactionDetailsModule/components/ConversationViewModal.tsx` - displays sender
- **Sprint**: SPRINT-061

## Do / Don't

### Do:

- Use investigation findings from TASK-1401 to guide implementation
- Ensure normalization is consistent across lookup and storage
- Handle international formats gracefully
- Test with real-world phone number variations

### Don't:

- Change how phone numbers are stored
- Modify contact import logic
- Fix group chat display issues (separate scope)
- Over-engineer for edge cases (focus on common formats)

## When to Stop and Ask

- If the fix requires database migration
- If multiple conflicting normalization standards exist
- If the root cause is different from TASK-1401 findings
- If fix would break existing contact lookups

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Phone normalization function handles various formats
  - Contact lookup finds match with different phone formats
  - "Unknown" only returned when no contact exists
- Existing tests to update:
  - Phone normalization tests (if they exist)
  - Contact lookup tests

### Coverage

- Coverage impact: Must not decrease
- Focus: Phone normalization and contact lookup code

### Integration / Feature Tests

- Required scenarios:
  - US phone formats: +1 (555) 123-4567 matches 5551234567
  - International formats work (if supported)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(contacts): normalize phone lookup for contact resolution`
- **Labels**: `bug`, `contacts`
- **Depends on**: TASK-1401 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~12K-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2-3 files | +8K |
| Normalization logic | String manipulation | +4K |
| Test updates | 3-4 test cases | +3K |

**Confidence:** Medium

**Risk factors:**
- Multiple normalization points may exist
- International format handling complexity

**Similar past tasks:** Phone normalization is a common pattern

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
- [ ] <file based on investigation>
- [ ] (tests)

Features implemented:
- [ ] Phone normalization updated
- [ ] Contact lookup fixed
- [ ] Tests added/updated

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual test: contact names display correctly
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~13.5K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~13.5K | ~XK | +/-X% |
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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** project/sprint-061-communication-display-fixes

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
