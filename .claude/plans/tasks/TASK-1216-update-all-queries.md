# Task TASK-1216: Update ALL Queries from Audit Checklist

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Update ALL queries identified in the TASK-1211 audit to use the `messages` table (via JOIN) instead of referencing columns that will be removed from `communications`.

## Non-Goals

- Do NOT remove the columns yet (that's Phase 7)
- Do NOT skip any item from the audit checklist
- Do NOT make unrelated changes
- Do NOT "optimize" queries beyond what's needed

## Deliverables

This task is based on the audit from TASK-1211. The exact files depend on that audit.

**Expected files (from BACKLOG-506):**
1. Update: `electron/services/db/communicationDbService.ts`
2. Update: `electron/services/db/contactDbService.ts`
3. Update: `electron/services/folderExportService.ts`
4. Update: `electron/services/pdfExportService.ts`
5. Update: `electron/services/enhancedExportService.ts`
6. Update: Any other files from the audit

## Acceptance Criteria

- [ ] Every HIGH risk item from audit is fixed
- [ ] Every MEDIUM risk item from audit is fixed
- [ ] Queries use JOIN to messages table for content
- [ ] Contact search works (was broken: "no such column: comm.sent_at")
- [ ] Message lookup finds all messages
- [ ] Folder export works
- [ ] PDF export works
- [ ] All existing tests pass
- [ ] No SQL errors in any feature

## Implementation Notes

### Query Update Pattern

```sql
-- Before (accessing columns directly on communications)
SELECT
  c.id,
  c.subject,           -- Will be removed
  c.body_plain,        -- Will be removed
  c.sent_at,           -- Will be removed
  c.sender             -- Will be removed
FROM communications c
WHERE c.transaction_id = ?

-- After (JOIN to messages table)
SELECT
  c.id,
  m.subject,
  m.body_plain,
  m.sent_at,
  m.sender
FROM communications c
LEFT JOIN messages m ON c.message_id = m.id
WHERE c.transaction_id = ?
```

### Handling Thread-Level Communications

Some communications are thread-level (no message_id). Handle with:

```sql
SELECT
  c.id,
  COALESCE(m.subject, 'Thread: ' || t.thread_id) as subject,
  m.body_plain,
  m.sent_at,
  m.sender
FROM communications c
LEFT JOIN messages m ON c.message_id = m.id
LEFT JOIN threads t ON c.thread_id = t.id
WHERE c.transaction_id = ?
```

### Sub-Tasks (Work Through Audit Systematically)

For each file in the audit:

#### 6a: contactDbService
- Update contact search query
- Fix `comm.sent_at` reference

#### 6b: communicationDbService
- Update `getCommunications()`
- Update `getCommunicationsByTransaction()`
- Update `getCommunicationsWithMessages()`

#### 6c: folderExportService
- Update export queries to JOIN messages

---

### SR ENGINEER CHECKPOINT (MANDATORY)

**After completing sub-tasks 6a-6c, STOP and verify approach with user before continuing.**

This is the largest task (~50K tokens). The checkpoint catches problems early.

**Checkpoint verification:**
- [ ] 6a contactDbService queries updated and tested
- [ ] 6b communicationDbService queries updated and tested
- [ ] 6c folderExportService queries updated and tested
- [ ] User has verified approach is correct
- [ ] User approves continuing to 6d-6f

**Only after user confirmation, continue to:**

---

#### 6d: pdfExportService
- Update PDF generation queries

#### 6e: enhancedExportService
- Update enhanced export queries

#### 6f: Other files from audit
- Address each file listed

### Test Each Fix

After updating each file:
1. Run type-check: `npm run type-check`
2. Run tests: `npm test`
3. If possible, manually test the feature

## Integration Notes

- Depends on: TASK-1215 (messageDbService created)
- This is the CRITICAL phase - most changes happen here
- User testing after this phase is the most important gate

## Do / Don't

### Do:

- Work through the audit checklist systematically
- Check off each item as you fix it
- Test after each file update
- Document any edge cases found

### Don't:

- Don't skip audit items
- Don't assume a query is "fine" without checking
- Don't refactor beyond what's needed for the fix
- Don't remove columns (that's Phase 7)

## When to Stop and Ask

- If audit checklist is incomplete or unclear
- If a query pattern is complex and you're unsure of the fix
- If fixing one query breaks another
- If you find queries not in the audit
- If you reach 30K tokens without completing (reassess scope)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing tests if queries changed
- New tests may be needed for edge cases

### Integration / Feature Tests

**CRITICAL - User must test ALL of these:**
- Contact search with various terms
- Message display for emails
- Message display for texts
- Folder export (all options)
- PDF export (all options)
- Email linking (still works from TASK-1215)

### CI Requirements

- [ ] All checks pass

## PR Preparation

- **Title**: `refactor(db): update all queries to use messages table JOIN`
- **Labels**: `database`, `refactor`, `critical`
- **Depends on**: TASK-1215

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~40K-50K

**Token Cap:** 200K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to update | ~6 files | +30K |
| Query complexity | Medium (JOINs) | +15K |
| Testing | Extensive verification | +10K |

**Confidence:** Low (depends on audit scope)

**Risk factors:**
- Audit may reveal more files than expected
- Some queries may be complex to update
- Edge cases in thread-level vs message-level

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Audit Checklist Progress

**From TASK-1211 audit - check off as completed:**

```
HIGH risk items:
- [ ] Item 1: <file:line> - <status>
- [ ] Item 2: <file:line> - <status>
...

MEDIUM risk items:
- [ ] Item 1: <file:line> - <status>
- [ ] Item 2: <file:line> - <status>
...
```

### Files Modified

```
- [ ] electron/services/db/communicationDbService.ts
- [ ] electron/services/db/contactDbService.ts
- [ ] electron/services/folderExportService.ts
- [ ] electron/services/pdfExportService.ts
- [ ] electron/services/enhancedExportService.ts
- [ ] (others from audit)
```

### Verification

```
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] Contact search works
- [ ] Message display works
- [ ] Export works
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**All Audit Items Addressed:** PASS / FAIL
**Query Patterns Correct:** PASS / FAIL
**No Breaking Changes:** PASS / FAIL

### Merge Verification (MANDATORY)

- [ ] Merge verified: state shows `MERGED`

---

## User Testing Gate (CRITICAL)

**This is the MOST IMPORTANT testing gate.**

**AFTER this task merges, user MUST test EVERY major feature:**

### Contact Features
- [ ] Search contacts by name
- [ ] Search contacts by phone
- [ ] Search contacts by email
- [ ] View contact details

### Message Features
- [ ] View email messages
- [ ] View text messages
- [ ] View message in thread
- [ ] View message attachments (if any)

### Export Features
- [ ] Folder export - emails only
- [ ] Folder export - texts only
- [ ] Folder export - all messages
- [ ] PDF export - single transaction
- [ ] PDF export - custom date range

### Linking Features
- [ ] Link new email to transaction
- [ ] Link text thread to transaction
- [ ] Unlink message from transaction

### Performance
- [ ] No noticeable slowdown
- [ ] No hanging or freezing

**If ANY test fails, DO NOT proceed to TASK-1217.**
**The columns are still in the database, so we can fix issues before removal.**

**Only after ALL tests pass, user approves proceeding to TASK-1217 (the destructive migration).**
