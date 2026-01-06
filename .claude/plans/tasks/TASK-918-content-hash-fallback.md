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

*Completed: 2026-01-02*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created (task file served as detailed implementation plan)
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 0 | ~0K | 0 min |
| Revision(s) | 0 | ~0K | 0 min |
| **Plan Total** | 0 | ~0K | 0 min |

Note: Task file TASK-918-content-hash-fallback.md provided complete implementation
specification with exact code, making separate Plan agent invocation unnecessary.
```

### Checklist

```
Files created:
- [x] electron/utils/emailHash.ts (note: path differs from task spec)

Files modified:
- [x] electron/services/gmailFetchService.ts (note: path differs from task spec)
- [x] electron/services/outlookFetchService.ts (note: path differs from task spec)

Tests added:
- [x] Hash consistency test (3 tests)
- [x] Hash uniqueness test (4 tests)
- [x] Edge case tests (18 tests - missing fields, truncation, whitespace, unicode, format)

Verification:
- [x] npm run type-check passes
- [x] npm test passes (25/25 tests)
- [x] Hash computed and added to ParsedEmail interface
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 0 | ~0K | 0 min |
| Implementation (Impl) | 2 | ~8K | 15 min |
| Debugging (Debug) | 1 | ~4K | 5 min |
| **Engineer Total** | 3 | ~12K | 20 min |
```

### Notes

**Planning notes:**
Task file provided complete implementation specification including exact code for
emailHash.ts utility and integration patterns for fetch services. No additional
planning was required.

**Deviations from plan:**
- File paths differ from task spec (electron/utils vs electron/main/utils,
  electron/services vs electron/main/services) - aligned with actual project structure

**Design decisions:**
- Used === instead of == for null checks (lint requirement)
- Interface allows null in addition to undefined for broader compatibility
- Body is NOT lowercased (only subject/from are) to preserve content signature

**Issues encountered:**
- Lint errors: emailHash.ts used == null instead of === null || === undefined
- Fixed with 3 edits to normalize functions

**Reviewer notes:**
- Pre-existing `any` type warnings in outlookFetchService.ts are not from this task
- Implementation was partially in progress when task was assigned (uncommitted changes)
- 25 comprehensive unit tests cover all edge cases from task spec

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 1 | 2 | +1 | Test file created separately |
| Files to modify | 2 | 2 | 0 | As expected |
| Test cases | 5-6 | 25 | +19 | More comprehensive coverage |

**Total Variance:** Est 4-5 turns -> Actual 3 turns (25% under estimate)

**Root cause of variance:**
Implementation was partially complete when assigned. Main work was verification,
lint fixes, and PR creation rather than full implementation.

**Suggestion for similar tasks:**
Task file implementation specs reduce planning overhead; estimate can be lower
when spec is this detailed.

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
