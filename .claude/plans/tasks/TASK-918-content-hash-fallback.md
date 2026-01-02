# Task TASK-918: Content Hash Fallback for Email Deduplication

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

Implement content hash computation for emails as a fallback deduplication mechanism when Message-ID is unavailable or unreliable. Store hash in `content_hash` column for all new emails.

## Non-Goals

- Do NOT implement duplicate linking logic (that's TASK-919)
- Do NOT backfill existing emails (future task)
- Do NOT change Message-ID extraction (TASK-909, TASK-917)
- Do NOT implement fuzzy matching

## Deliverables

1. New: `electron/main/utils/emailHash.ts` - Hash computation utility
2. Update: `electron/main/services/gmailFetchService.ts` - Compute hash on store
3. Update: `electron/main/services/outlookFetchService.ts` - Compute hash on store
4. New tests: Unit tests for hash computation

## Acceptance Criteria

- [ ] `computeEmailHash()` function implemented
- [ ] Hash includes: subject + from + sentDate + first 500 chars of body
- [ ] Hash uses SHA-256 (or similar secure hash)
- [ ] Hash stored in `content_hash` column for new Gmail emails
- [ ] Hash stored in `content_hash` column for new Outlook emails
- [ ] Unit tests cover edge cases (missing fields, empty body, etc.)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Hash Function

Create new utility file:

```typescript
// electron/main/utils/emailHash.ts
import * as crypto from 'crypto';

export interface EmailHashInput {
  subject?: string;
  from?: string;
  sentDate?: Date | string;
  bodyPlain?: string;
}

export function computeEmailHash(email: EmailHashInput): string {
  // Normalize fields
  const subject = (email.subject || '').trim().toLowerCase();
  const from = (email.from || '').trim().toLowerCase();
  const sentDate = email.sentDate
    ? new Date(email.sentDate).toISOString()
    : '';
  const bodySnippet = (email.bodyPlain || '').slice(0, 500).trim();

  // Combine fields with delimiter
  const content = [subject, from, sentDate, bodySnippet].join('|');

  // Compute SHA-256 hash
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### Integration with Fetch Services

In each fetch service, after parsing email but before storing:

```typescript
import { computeEmailHash } from '../utils/emailHash';

// After extracting email fields...
const contentHash = computeEmailHash({
  subject: email.subject,
  from: email.from,
  sentDate: email.date,
  bodyPlain: email.body
});

// Include in INSERT statement
await db.prepare(`
  INSERT INTO messages (
    ...existing_columns,
    message_id_header,
    content_hash
  ) VALUES (?, ?, ?, ...)
`).run(...existingValues, messageId, contentHash);
```

### Schema (Already Exists)

SPRINT-014 TASK-905 added the column:
```sql
ALTER TABLE messages ADD COLUMN content_hash TEXT;
CREATE INDEX idx_messages_content_hash ON messages(content_hash);
```

### Edge Cases to Handle

| Case | Handling |
|------|----------|
| Missing subject | Use empty string |
| Missing from | Use empty string |
| Missing date | Use empty string (not current date!) |
| Empty body | Use empty string |
| Unicode in fields | Normalize before hashing |
| Very long body | Truncate to 500 chars |

### Why These Fields?

- **Subject**: Identifies email topic
- **From**: Sender identity
- **Sent Date**: Timestamp uniqueness
- **Body (500 chars)**: Content signature without full body overhead

This combination makes collisions extremely unlikely while being fast to compute.

## Integration Notes

- Imports from: Node.js crypto module
- Exports to: Database via fetch services
- Used by: TASK-919 (duplicate detection)
- Depends on: TASK-917 (Outlook Message-ID infrastructure)

## Do / Don't

### Do:

- Use SHA-256 (standard, secure, fast)
- Normalize all inputs (lowercase, trim)
- Handle missing fields gracefully
- Test with edge cases

### Don't:

- Include email ID in hash (defeats purpose)
- Use MD5 (deprecated for new code)
- Hash binary attachments (too slow)
- Change hash algorithm later (breaks dedup)

## When to Stop and Ask

- If hash computation adds noticeable latency
- If fetch services have different email field names
- If you find existing hash utilities that should be reused

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test hash consistency (same input = same hash)
  - Test hash uniqueness (different emails = different hashes)
  - Test missing field handling
  - Test truncation of long body
  - Test Unicode normalization
- Existing tests to update: None

### Coverage

- Coverage impact: Should increase (new utility with tests)

### Integration / Feature Tests

- Required scenarios:
  - Sync email, verify content_hash stored
  - Sync same email content twice, verify same hash

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(email): add content hash for dedup fallback`
- **Labels**: `enhancement`, `email`
- **Depends on**: TASK-917 (Outlook infrastructure)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Raw Estimate:** 4-5 turns, ~18K tokens, 25-30 min
**Adjustment Factor:** 1.0 (service category)

**Estimated Totals:**
- **Turns:** 4-5
- **Tokens:** ~18K
- **Time:** ~25-30 min
- **Token Cap:** 72K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| New utility file | 1 file, ~40 lines | +1.5 |
| Service integrations | 2 files, small changes | +1.5 |
| Test complexity | Medium (5-6 test cases) | +1.5 |

**Confidence:** Medium

**Risk factors:**
- Email field names may vary between services
- Need to ensure hash is deterministic

**Similar past tasks:** TASK-909, TASK-917 (similar service changes)

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop (AFTER TASK-917 merged)
**Branch Into:** develop
**Branch Name:** feature/TASK-918-content-hash

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Execution Classification

- **Parallel Safe:** NO (Phase 3 sequential)
- **Depends On:** TASK-917 (Outlook Message-ID infrastructure)
- **Blocks:** TASK-919

### Shared File Analysis

| File | This Task | Conflicts With |
|------|-----------|----------------|
| `electron/main/services/gmailFetchService.ts` | Hash integration | TASK-919 (sequential) |
| `electron/main/services/outlookFetchService.ts` | Hash integration | TASK-917 (before), TASK-919 (after) |
| `electron/main/utils/emailHash.ts` (NEW) | Hash utility | None |

### Technical Considerations

- Creates new utility file - no conflicts
- Modifies both fetch services - must be sequential with TASK-919
- Use SHA-256 for hashing (standard, secure)
- Handle missing fields gracefully (use empty string, not null)
- 500 char body truncation is intentional

### Worktree Command (for this task)

```bash
# After TASK-917 is merged:
git -C /Users/daniel/Documents/Mad pull origin develop
git -C /Users/daniel/Documents/Mad worktree add ../Mad-task-918 -b feature/TASK-918-content-hash develop
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
Files created:
- [ ] electron/main/utils/emailHash.ts

Files modified:
- [ ] electron/main/services/gmailFetchService.ts
- [ ] electron/main/services/outlookFetchService.ts

Tests added:
- [ ] Hash consistency test
- [ ] Hash uniqueness test
- [ ] Edge case tests

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] Hash stored in database
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
| Files to create | 1 | X | +/- X | <reason> |
| Files to modify | 2 | X | +/- X | <reason> |
| Test cases | 5-6 | X | +/- X | <reason> |

**Total Variance:** Est 4-5 turns -> Actual X turns (X% over/under)

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
