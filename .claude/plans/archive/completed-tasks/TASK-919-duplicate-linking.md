# Task TASK-919: Duplicate Linking Logic for Email Deduplication

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

Implement the duplicate detection and linking logic that detects duplicate emails during sync (via Message-ID or content hash) and populates the `duplicate_of` field pointing to the original message.

## Non-Goals

- Do NOT implement UI for showing duplicates (future task)
- Do NOT backfill existing emails (future task)
- Do NOT modify LLM filtering (already done in TASK-911)
- Do NOT delete duplicate emails (just link them)

## Deliverables

1. New: `electron/main/services/emailDeduplicationService.ts` - Dedup logic
2. Update: `electron/main/services/gmailFetchService.ts` - Call dedup before store
3. Update: `electron/main/services/outlookFetchService.ts` - Call dedup before store
4. New tests: Integration tests for duplicate detection

## Acceptance Criteria

- [ ] Duplicate detection works via Message-ID match
- [ ] Duplicate detection falls back to content hash
- [ ] `duplicate_of` field populated with original message ID
- [ ] Duplicates still stored (not rejected) but linked
- [ ] LLM analysis skipped for duplicates (verify TASK-911 filter works)
- [ ] Integration tests verify end-to-end dedup flow
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Deduplication Service

Create dedicated service for dedup logic:

```typescript
// electron/main/services/emailDeduplicationService.ts
import { Database } from 'better-sqlite3';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  originalId?: string;
}

export class EmailDeduplicationService {
  constructor(private db: Database) {}

  /**
   * Check if an email is a duplicate of an existing one.
   *
   * Priority:
   * 1. Match by message_id_header (most reliable)
   * 2. Match by content_hash (fallback)
   */
  checkForDuplicate(
    userId: string,
    messageIdHeader: string | null,
    contentHash: string
  ): DuplicateCheckResult {
    // Try Message-ID match first
    if (messageIdHeader) {
      const existing = this.db.prepare(`
        SELECT id FROM messages
        WHERE user_id = ?
        AND message_id_header = ?
        AND duplicate_of IS NULL
        LIMIT 1
      `).get(userId, messageIdHeader);

      if (existing) {
        return { isDuplicate: true, originalId: existing.id };
      }
    }

    // Fall back to content hash
    const existing = this.db.prepare(`
      SELECT id FROM messages
      WHERE user_id = ?
      AND content_hash = ?
      AND duplicate_of IS NULL
      LIMIT 1
    `).get(userId, contentHash);

    if (existing) {
      return { isDuplicate: true, originalId: existing.id };
    }

    return { isDuplicate: false };
  }
}
```

### Integration with Fetch Services

Before storing a new email:

```typescript
import { EmailDeduplicationService } from './emailDeduplicationService';
import { computeEmailHash } from '../utils/emailHash';

// In fetch service...
const dedup = new EmailDeduplicationService(db);

// Extract identifiers
const messageIdHeader = extractMessageId(email);
const contentHash = computeEmailHash(email);

// Check for duplicate
const { isDuplicate, originalId } = dedup.checkForDuplicate(
  userId,
  messageIdHeader,
  contentHash
);

// Store with duplicate_of if matched
await db.prepare(`
  INSERT INTO messages (
    ...columns,
    message_id_header,
    content_hash,
    duplicate_of
  ) VALUES (?, ?, ?, ?)
`).run(
  ...values,
  messageIdHeader,
  contentHash,
  isDuplicate ? originalId : null
);

// Log for monitoring
if (isDuplicate) {
  console.log(`Duplicate detected: ${email.id} -> ${originalId}`);
}
```

### Schema (Already Exists)

SPRINT-014 TASK-905 added:
```sql
ALTER TABLE messages ADD COLUMN duplicate_of TEXT;
```

### LLM Filter Verification

SPRINT-014 TASK-911 should already filter duplicates:
```sql
SELECT * FROM messages
WHERE user_id = ?
AND duplicate_of IS NULL      -- Skip duplicates
AND is_transaction_related IS NULL  -- Not yet analyzed
```

Verify this query is used in LLM pipeline.

### Edge Cases

| Case | Handling |
|------|----------|
| Same email from Gmail and Outlook | First stored is original, second is duplicate |
| Email forwarded between accounts | If Message-ID preserved, deduped. If not, content hash catches it |
| Slightly modified forward | Different content hash, NOT deduped (intentional) |
| No Message-ID + no body | Content hash may collide; rare, acceptable |

## Integration Notes

- Imports from: `emailDeduplicationService.ts`, `emailHash.ts`
- Exports to: Database via fetch services
- Used by: LLM pipeline (filters duplicates)
- Depends on: TASK-917 (Outlook Message-ID), TASK-918 (content hash)

## Do / Don't

### Do:

- Check Message-ID first (more reliable)
- Fall back to content hash
- Store duplicates (don't reject)
- Log duplicate detection for monitoring
- Add WHERE duplicate_of IS NULL to original lookup

### Don't:

- Delete duplicate emails
- Change original email when duplicate found
- Skip content hash if Message-ID missing
- Use complex fuzzy matching

## When to Stop and Ask

- If TASK-911 LLM filter doesn't exclude duplicate_of
- If database constraints prevent duplicate storage
- If content hash collisions are observed in testing

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test Message-ID duplicate detection
  - Test content hash fallback
  - Test no-match scenario
  - Test duplicate_of populated correctly
- Existing tests to update: Possibly fetch service tests

### Coverage

- Coverage impact: Should increase (new service with tests)

### Integration / Feature Tests

- Required scenarios:
  - Sync Gmail email, then same email via Outlook (same Message-ID)
  - Sync two emails with same content hash
  - Verify LLM pipeline skips duplicates

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(email): add duplicate linking logic`
- **Labels**: `enhancement`, `email`
- **Depends on**: TASK-917, TASK-918 (dedup identifiers must exist)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Raw Estimate:** 4-6 turns, ~20K tokens, 25-35 min
**Adjustment Factor:** 1.0 (service category)

**Estimated Totals:**
- **Turns:** 4-6
- **Tokens:** ~20K
- **Time:** ~25-35 min
- **Token Cap:** 80K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| New service file | 1 file, ~50-60 lines | +2 |
| Service integrations | 2 fetch services | +2 |
| Test complexity | Medium-High (4+ scenarios) | +2 |
| Pattern reference | BACKLOG-091 has detailed spec | -1 |

**Confidence:** Medium

**Risk factors:**
- Fetch service structure may vary
- Need to verify TASK-911 filter compatibility
- Integration testing may reveal issues

**Similar past tasks:** TASK-909, TASK-917, TASK-918 (cumulative dedup work)

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop (AFTER TASK-918 merged)
**Branch Into:** develop
**Branch Name:** feature/TASK-919-duplicate-linking

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Execution Classification

- **Parallel Safe:** NO (Phase 3 sequential, final task)
- **Depends On:** TASK-917 (Message-ID), TASK-918 (content hash)
- **Blocks:** None (final task in sprint)

### Shared File Analysis

| File | This Task | Conflicts With |
|------|-----------|----------------|
| `electron/main/services/gmailFetchService.ts` | Dedup integration | TASK-918 (before) |
| `electron/main/services/outlookFetchService.ts` | Dedup integration | TASK-917, TASK-918 (before) |
| `electron/main/services/emailDeduplicationService.ts` (NEW) | Dedup service | None |

### Technical Considerations

- Depends on both TASK-917 (Message-ID) and TASK-918 (content hash) being merged
- Verify TASK-911 LLM filter compatibility (should exclude duplicate_of)
- Store duplicates, don't delete them - just link via duplicate_of field
- Check Message-ID first (more reliable), fall back to content hash

### Worktree Command (for this task)

```bash
# After TASK-918 is merged:
git -C /Users/daniel/Documents/Mad pull origin develop
git -C /Users/daniel/Documents/Mad worktree add ../Mad-task-919 -b feature/TASK-919-duplicate-linking develop
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
- [ ] electron/main/services/emailDeduplicationService.ts

Files modified:
- [ ] electron/main/services/gmailFetchService.ts
- [ ] electron/main/services/outlookFetchService.ts

Tests added:
- [ ] Message-ID dedup test
- [ ] Content hash fallback test
- [ ] No-match test
- [ ] Integration test

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] duplicate_of field populated
- [ ] LLM pipeline skips duplicates
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
| Test cases | 4+ | X | +/- X | <reason> |

**Total Variance:** Est 4-6 turns -> Actual X turns (X% over/under)

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
