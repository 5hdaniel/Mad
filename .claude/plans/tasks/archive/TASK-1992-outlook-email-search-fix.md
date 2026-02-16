# Task TASK-1992: Fix Outlook Email Search maxResults Cap and Contact Filtering

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

Fix the Outlook email search so that contact-specific searches return more results by increasing the `maxResults` default and verifying that the `contactEmails` filter correctly finds emails involving specific contacts.

## Non-Goals

- Do NOT refactor the entire `outlookFetchService.ts` file
- Do NOT add new API endpoints or search methods
- Do NOT modify Gmail fetch service
- Do NOT change the email storage/database layer
- Do NOT change pagination logic (it already works correctly)
- Do NOT modify the `fetchContacts()` method (that is working correctly)

## Deliverables

1. Update: `electron/services/outlookFetchService.ts` -- Adjust `searchEmails` defaults and verify filter logic

## Acceptance Criteria

- [ ] `maxResults` default increased from 100 to 500 (or configurable via caller)
- [ ] When `contactEmails` is provided, the filter includes `bccRecipients` field in addition to `from`, `toRecipients`, and `ccRecipients`
- [ ] Search correctly paginates through all results up to the maxResults cap
- [ ] No regression in existing search behavior (queries without contactEmails still work)
- [ ] All CI checks pass

## Implementation Notes

### Current State

`outlookFetchService.ts` `searchEmails()` method (lines 347-509):

```typescript
async searchEmails({
  query = "",
  after = null,
  before = null,
  maxResults = 100,  // <-- THIS IS THE ISSUE
  contactEmails,
  onProgress,
}: EmailSearchOptions = {}): Promise<ParsedEmail[]> {
```

The default `maxResults = 100` means that if a contact has correspondence spread across many emails, searches may not find all relevant ones, especially when combined with date filters.

### Contact Email Filter (lines 375-384)

```typescript
if (contactEmails && contactEmails.length > 0) {
  const emailClauses = contactEmails.map((email) => {
    const escaped = email.replace(/'/g, "''");
    return [
      `from/emailAddress/address eq '${escaped}'`,
      `toRecipients/any(r:r/emailAddress/address eq '${escaped}')`,
      `ccRecipients/any(r:r/emailAddress/address eq '${escaped}')`,
      // NOTE: bccRecipients is missing here
    ].join(" or ");
  });
  filters.push(`(${emailClauses.join(" or ")})`);
}
```

### Changes Required

1. **Increase `maxResults` default:**
```typescript
async searchEmails({
  query = "",
  after = null,
  before = null,
  maxResults = 500,  // CHANGED: Increase from 100 to 500
  contactEmails,
  onProgress,
}: EmailSearchOptions = {}): Promise<ParsedEmail[]> {
```

2. **Add `bccRecipients` to contact filter:**
```typescript
if (contactEmails && contactEmails.length > 0) {
  const emailClauses = contactEmails.map((email) => {
    const escaped = email.replace(/'/g, "''");
    return [
      `from/emailAddress/address eq '${escaped}'`,
      `toRecipients/any(r:r/emailAddress/address eq '${escaped}')`,
      `ccRecipients/any(r:r/emailAddress/address eq '${escaped}')`,
      `bccRecipients/any(r:r/emailAddress/address eq '${escaped}')`,  // ADD THIS
    ].join(" or ");
  });
  filters.push(`(${emailClauses.join(" or ")})`);
}
```

3. **Verify the `$select` fields include bccRecipients** (line 398):
```typescript
const selectFields =
  "$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,...";
```
This already includes `bccRecipients` -- just verify it's there.

4. **Update the `EmailSearchOptions` interface** if `maxResults` type or documentation needs updating:
```typescript
interface EmailSearchOptions {
  query?: string;
  after?: Date | null;
  before?: Date | null;
  maxResults?: number;  // Default: 500. Maximum emails to fetch.
  contactEmails?: string[];
  onProgress?: (progress: EmailSearchProgress) => void;
}
```

### Important Considerations

- The Graph API has rate limits. 500 is a reasonable upper bound for a single search.
- Each page fetches 100 emails (`pageSize = 100`), so 500 maxResults = 5 pages maximum.
- The `ConsistencyLevel: eventual` header is already set when `contactEmails` is provided (line 401-404).
- Adding `bccRecipients` to the filter also uses lambda expressions, so it's covered by the existing `ConsistencyLevel` logic.

## Integration Notes

- Imports from: N/A (self-contained changes)
- Exports to: Used by `email-handlers.ts` when searching emails for contacts
- Used by: Email sync, auto-link service
- Depends on: None (independent task)

## Do / Don't

### Do:
- Verify the `$select` fields already include `bccRecipients`
- Add a JSDoc comment about the default change
- Test that the pagination loop still terminates correctly with higher maxResults

### Don't:
- Don't change the pageSize (keep at 100 per page)
- Don't modify `fetchContacts()` or any other method
- Don't add a new configuration system for maxResults
- Don't change error handling logic

## When to Stop and Ask

- If changing maxResults to 500 causes type errors or other unexpected issues
- If `bccRecipients` is not a valid OData filter field in Graph API (it should be)
- If callers of `searchEmails()` explicitly pass `maxResults` that would be affected

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (if tests exist for searchEmails)
- New tests to write:
  - Test that default maxResults is 500
  - Test that contactEmails filter includes bccRecipients clause
- Existing tests to update:
  - Update any tests that assert on the OData filter string

### Coverage

- Coverage impact: Should not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `fix(outlook): increase email search limit and add bcc filter`
- **Labels**: `fix`, `outlook`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~15K (with service multiplier x 0.5 = ~8K effective)

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 file (outlookFetchService.ts) | +3K |
| Code volume | ~10 lines changed | +2K |
| Test complexity | Low (parameter changes) | +3K |
| Investigation | Verify bcc filter support | +2K |

**Confidence:** High

**Risk factors:**
- Graph API may not support bccRecipients filter (unlikely but possible)

**Similar past tasks:** Service tasks average -31% to -45% variance (SPRINT-014/015)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/services/outlookFetchService.ts

Features implemented:
- [ ] maxResults default changed to 500
- [ ] bccRecipients added to contact email filter
- [ ] $select fields verified to include bccRecipients

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document decisions>

**Issues encountered:**
<Document issues>

**Reviewer notes:**
<Anything for reviewer>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
