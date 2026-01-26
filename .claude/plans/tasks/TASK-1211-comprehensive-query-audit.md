# Task TASK-1211: Comprehensive Query Audit for Column Removal

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

Create a comprehensive audit document listing EVERY location in the codebase that references the columns to be removed from the `communications` table, so the user can review and approve before any implementation begins.

## Non-Goals

- Do NOT modify any code (this is an audit only)
- Do NOT start implementing fixes
- Do NOT make assumptions about which references are "okay to break"
- Do NOT skip any file type (check SQL, TypeScript, tests, everything)

## Deliverables

1. New file: `.claude/plans/audits/AUDIT-506-column-references.md`
   - Complete list of all files referencing to-be-removed columns
   - Exact line numbers and code snippets
   - Classification by file type and risk level

## Columns to Audit (from BACKLOG-506)

The following columns will eventually be removed from `communications`:

```sql
-- Content columns (legacy email storage)
subject, body, body_plain

-- Sender/recipient columns
sender, recipients, cc, bcc

-- Timestamp columns
email_thread_id, sent_at, received_at

-- Attachment columns
has_attachments, attachment_count, attachment_metadata

-- Analysis columns
keywords_detected, parties_involved, communication_category
relevance_score, is_compliance_related, source, communication_type
```

## Acceptance Criteria

- [ ] Audit document created at specified location
- [ ] ALL SQL queries referencing removed columns are listed
- [ ] ALL TypeScript types/interfaces referencing removed columns are listed
- [ ] ALL test files referencing removed columns are listed
- [ ] Each entry includes file path, line number, and code snippet
- [ ] Each entry is classified by risk level (High/Medium/Low)
- [ ] Summary table shows total count by file type
- [ ] User has reviewed and approved the audit

## Implementation Notes

### Search Commands to Run

```bash
# Main search - all column names
for col in subject body body_plain sender recipients cc bcc email_thread_id sent_at received_at has_attachments attachment_count attachment_metadata keywords_detected parties_involved communication_category relevance_score is_compliance_related source communication_type; do
  echo "=== $col ==="
  grep -rn "$col" --include="*.ts" --include="*.tsx" --include="*.sql" electron/ src/ supabase/ | grep -v node_modules | grep -v ".test." | head -20
done

# Also search tests separately
for col in subject body body_plain sender recipients cc bcc email_thread_id sent_at received_at has_attachments attachment_count attachment_metadata keywords_detected parties_involved communication_category relevance_score is_compliance_related source communication_type; do
  echo "=== $col (tests) ==="
  grep -rn "$col" --include="*.test.ts" --include="*.test.tsx" electron/ src/ | head -10
done

# SR ENGINEER RECOMMENDED: Dynamic SQL patterns (string concatenation building column names)
grep -rn '\${.*column\|`\${.*}\`\|" + column\|+ "column' --include="*.ts" electron/ src/

# SR ENGINEER RECOMMENDED: Supabase migrations explicitly
ls -la supabase/migrations/
grep -rn "sent_at\|body_plain\|subject" supabase/migrations/

# SR ENGINEER RECOMMENDED: Type definitions
grep -rn "sent_at\|body_plain\|subject" --include="*.d.ts" --include="*types*.ts" electron/ src/
```

### Files Known to Reference These Columns

From BACKLOG-506 and the failed implementation:
- `electron/services/db/communicationDbService.ts`
- `electron/services/db/contactDbService.ts`
- `electron/services/folderExportService.ts`
- `electron/services/pdfExportService.ts`
- `electron/services/enhancedExportService.ts`
- `electron/database/schema.sql`

**SR ENGINEER RECOMMENDED: Also explicitly check:**
- `supabase/migrations/` - All migration files
- `electron/types/` - Type definition files
- Any files with `.d.ts` extension
- Files containing `*types*.ts` pattern

**But the audit MUST find ALL references, not just these known ones.**

### Audit Document Format

```markdown
# AUDIT-506: Column Reference Audit

## Summary

| File Type | Files Affected | References |
|-----------|----------------|------------|
| Database services | X | Y |
| Export services | X | Y |
| UI components | X | Y |
| TypeScript types | X | Y |
| Tests | X | Y |
| **Total** | **X** | **Y** |

## High Risk References (Must Fix Before Column Removal)

### File: electron/services/db/contactDbService.ts

**Line 45:** `SELECT comm.sent_at FROM communications comm`
- Context: Used in contact search
- Risk: HIGH - breaks contact search completely
- Fix approach: Join to messages table instead

### File: ...

## Medium Risk References (Should Fix)

...

## Low Risk References (Can Verify After)

...

## TypeScript Type Changes Needed

| Type/Interface | File | Fields to Remove |
|----------------|------|------------------|
| Communication | types.ts | subject, body, ... |

## Test Updates Needed

| Test File | Mocks to Update | Risk |
|-----------|-----------------|------|
| ... | ... | ... |
```

### Risk Classification

- **HIGH**: Query will fail (SQL error) if column is removed
- **MEDIUM**: Feature may break but won't crash
- **LOW**: Reference is in comments, types only, or unused code

## Integration Notes

- Depends on: TASK-1210 (revert must complete first)
- Blocks: ALL subsequent phases - nothing proceeds without approved audit
- User approval is REQUIRED before proceeding

## Do / Don't

### Do:

- Search exhaustively - better to over-report than miss something
- Include code snippets so user can understand context
- Classify by risk to help prioritize Phase 6
- Note any patterns you see (common query types, etc.)

### Don't:

- Don't modify any code
- Don't assume any reference is "safe to ignore"
- Don't skip test files
- Don't skip Supabase files

## When to Stop and Ask

- If you find more than 50 unique file references (scope may need revision)
- If you're unsure how to classify a reference
- If you find references in unexpected places (like config files)
- If the pattern is unclear and you can't determine risk

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this is an audit document)

### Integration / Feature Tests

- Required: No (this is an audit document)

### CI Requirements

This task's PR MUST pass:
- [ ] No code changes, so all existing tests should pass
- [ ] Audit document follows markdown format

## PR Preparation

- **Title**: `docs: AUDIT-506 comprehensive column reference audit`
- **Labels**: `documentation`, `audit`
- **Depends on**: TASK-1210 (revert complete)

---

## PM Estimate (PM-Owned)

**Category:** `audit`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Search scope | ~100 files to search | +15K |
| Document creation | Detailed audit format | +10K |
| Classification | Manual risk assessment | +5K |

**Confidence:** Medium

**Risk factors:**
- May find more references than expected
- Classification requires judgment

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
Audit completed:
- [ ] All SQL files searched
- [ ] All TypeScript files searched
- [ ] All test files searched
- [ ] Audit document created
- [ ] Risk classifications assigned
- [ ] Summary table complete

Verification:
- [ ] Document is readable and complete
- [ ] All known files from BACKLOG-506 are included
- [ ] No obvious files missed
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**

**Deviations from plan:**

**Design decisions:**

**Issues encountered:**

**Reviewer notes:**

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |

**Root cause of variance:**

**Suggestion for similar tasks:**

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Audit Completeness:** PASS / FAIL
**Risk Classifications:** Accurate / Needs Revision

**Review Notes:**

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete

---

## User Approval Gate

**AFTER this task merges, user must:**

1. **Review the audit document** at `.claude/plans/audits/AUDIT-506-column-references.md`
2. **Verify completeness** - Are there any files/queries they expected to see that are missing?
3. **Approve the plan** - Explicitly approve before Phase 2 begins

**User approval checklist:**
- [ ] Reviewed all HIGH risk items
- [ ] Reviewed MEDIUM risk items
- [ ] Understands scope of Phase 6 changes
- [ ] Explicitly approves proceeding to TASK-1212

**DO NOT proceed to TASK-1212 without explicit user approval of the audit.**
