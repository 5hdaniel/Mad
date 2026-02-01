# Task TASK-1779: Upload Email Attachments to Broker Portal

**Sprint:** SPRINT-067
**Phase:** 4
**Priority:** HIGH
**Estimated Tokens:** ~25K
**Token Cap:** 100K
**Depends On:** TASK-1775

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

Extend the submission service to include email attachments when submitting transactions to the broker portal, matching the existing behavior for text message attachments.

## Non-Goals

- Do NOT modify the attachment download service (that's TASK-1775)
- Do NOT modify the broker portal UI (that's outside this sprint)
- Do NOT change the storage bucket structure
- Do NOT modify supabaseStorageService.ts (it already works)

## Deliverables

1. **Update:** `electron/services/submissionService.ts` - Include email attachments in upload
2. **Update:** Tests for submission service

## Acceptance Criteria

- [ ] Email attachments are uploaded to `submission-attachments` bucket during submission
- [ ] `submission_attachments` table includes email attachment records
- [ ] Broker portal can view email attachments via signed URLs
- [ ] Existing text message attachment upload still works
- [ ] All CI checks pass (`npm test`, `npm run type-check`, `npm run lint`)

## Implementation Notes

### Current State

In `submissionService.ts`, the submission flow:
1. Loads messages and attachments for the transaction
2. Uploads attachments from `attachments` table where `storage_path` exists
3. Currently only queries attachments linked to text messages (via `message_id`)

### Change Required

Update attachment query to include email attachments:
- Query attachments where `message_id` matches email IDs (from `emails` table)
- Email attachments now have `storage_path` after TASK-1775

### Key Files to Reference

- `electron/services/submissionService.ts` - Main file to modify
- `electron/services/supabaseStorageService.ts` - Existing upload logic (don't modify)
- `electron/services/db/emailDbService.ts` - Email queries

### Integration Point

The existing `uploadAttachments()` call should work as-is once email attachments are included in the query - they follow the same schema with `storage_path`, `filename`, `mime_type`, etc.

### Query Pattern

```typescript
// Current: Only text message attachments
const attachments = db.prepare(`
  SELECT a.* FROM attachments a
  WHERE a.message_id IN (SELECT id FROM messages WHERE ...)
`).all();

// After: Include email attachments
const attachments = db.prepare(`
  SELECT a.* FROM attachments a
  WHERE a.message_id IN (
    SELECT id FROM messages WHERE ...
    UNION
    SELECT id FROM emails WHERE ...
  )
`).all();
```

## Integration Notes

- **Imports from:** `databaseService`, `supabaseStorageService`
- **Exports to:** Broker portal via Supabase Storage
- **Used by:** Team users submitting transactions for broker review
- **Depends on:** TASK-1775 (email attachments must have `storage_path`)

## Do / Don't

### Do:
- Query email attachments alongside text message attachments
- Use the same upload path (`supabaseStorageService.uploadAttachments`)
- Include email attachments in the `submission_attachments` table
- Log email attachment uploads separately for debugging

### Don't:
- Don't modify supabaseStorageService.ts
- Don't change the storage bucket structure
- Don't break existing text message attachment uploads
- Don't create duplicate uploads for the same file

## When to Stop and Ask

- If the attachment query structure is unclear
- If email IDs vs message IDs linking is confusing
- If the existing upload path doesn't work for email attachments
- If storage bucket permissions are an issue

## Testing Expectations

### Unit Tests

**Required:** Yes

**Existing tests to update:**
- `electron/services/__tests__/submissionService.test.ts`
  - Add test for email attachment inclusion
  - Add test for mixed email + text attachment submission
  - Verify attachment counts include both types

### Coverage
- Coverage impact: Should maintain or increase

### Manual Testing
- Submit a transaction with email attachments
- Verify attachments appear in broker portal
- Verify text message attachments still work

### CI Requirements
- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title:** `feat(submission): include email attachments in broker portal upload`
- **Labels:** `submission`, `attachments`, `broker-portal`
- **Depends on:** TASK-1775

---

## PM Estimate (PM-Owned)

**Category:** `service` (apply 0.5x multiplier)

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Query update | Add email attachments to query | +10K |
| Testing | Update existing tests | +8K |
| Integration verification | Ensure uploads work | +7K |

**Confidence:** High (similar to TASK-1777 pattern)

---

## Branch Information (Set by SR Engineer during Technical Review)

**Branch From:** develop (after TASK-1775 merges)
**Branch Into:** develop
**Branch Name:** feature/TASK-1779-broker-portal-email-attachments

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
Files created:
- [ ] None (updating existing)

Files modified:
- [ ] electron/services/submissionService.ts
- [ ] electron/services/__tests__/submissionService.test.ts

Features implemented:
- [ ] Email attachment query inclusion
- [ ] Upload verification
- [ ] Updated test coverage

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual submission test with email attachments
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
<None or explain>

**Design decisions:**
<Document any>

**Issues encountered:**
<Document any>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

```
SR Engineer Agent ID: <agent_id>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
