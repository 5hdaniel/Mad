# Task TASK-1219: SR Engineer Full Architecture Review

---

## WORKFLOW REQUIREMENT

**This task is for the SR Engineer agent.**

Invoke with `subagent_type="senior-engineer-pr-lead"`.

---

## Goal

Perform a comprehensive architecture review of all SPRINT-053 changes before the final merge to develop.

## Non-Goals

- This is NOT implementation - no code changes
- Do NOT approve if there are concerns
- Do NOT skip any review area

## Review Scope

All changes from SPRINT-053 phases 2-8:
- TASK-1212: Unique constraints
- TASK-1213: Drop participants table
- TASK-1214: ACID wrappers
- TASK-1215: messageDbService and email linking
- TASK-1216: Query updates
- TASK-1217: Column removal migration
- TASK-1218: COALESCE cleanup

## Review Checklist

### Database Architecture

- [ ] `communications` table is now a pure junction table
- [ ] All content is stored in `messages` table
- [ ] Foreign key relationships are correct
- [ ] Indexes are appropriate and complete
- [ ] No orphaned data patterns

### Query Patterns

- [ ] All queries use JOINs correctly
- [ ] No queries reference removed columns
- [ ] COALESCE only used for legitimate NULL handling
- [ ] Performance considerations addressed

### Service Layer

- [ ] `messageDbService` follows established patterns
- [ ] Transaction wrappers are correctly applied
- [ ] No duplicate code introduced
- [ ] Error handling is appropriate

### Type Safety

- [ ] TypeScript types match database schema
- [ ] No `any` types introduced
- [ ] Proper null handling

### Test Coverage

- [ ] New services have tests
- [ ] Existing tests updated as needed
- [ ] No reduction in coverage

### Migration Safety

- [ ] Migrations are idempotent where possible
- [ ] Data preservation verified
- [ ] Rollback considerations documented

## Acceptance Criteria

- [ ] All review areas checked
- [ ] No critical issues found
- [ ] Any minor issues documented for future work
- [ ] Architecture is clean and maintainable

## Deliverables

1. Review summary document (in PR comment or this task file)
2. APPROVE or REQUEST_CHANGES decision
3. List of any follow-up items for backlog

## Integration Notes

- Depends on: All phases 2-8 complete
- Blocks: TASK-1220 (final merge)

---

## PM Estimate (PM-Owned)

**Category:** `review`

**Estimated Tokens:** ~15K-20K

**Token Cap:** 80K

---

## SR Engineer Review Section

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Architecture Review Summary

**Overall Assessment:** APPROVE / REQUEST_CHANGES

#### Database Architecture
- Status: PASS / FAIL / NEEDS_WORK
- Notes:

#### Query Patterns
- Status: PASS / FAIL / NEEDS_WORK
- Notes:

#### Service Layer
- Status: PASS / FAIL / NEEDS_WORK
- Notes:

#### Type Safety
- Status: PASS / FAIL / NEEDS_WORK
- Notes:

#### Test Coverage
- Status: PASS / FAIL / NEEDS_WORK
- Notes:

#### Migration Safety
- Status: PASS / FAIL / NEEDS_WORK
- Notes:

### Issues Found

| Issue | Severity | Action |
|-------|----------|--------|
| | | |

### Follow-Up Items (for backlog)

-

### Final Decision

**Decision:** APPROVE / REQUEST_CHANGES

**Rationale:**

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

---

## After SR Approval

Proceed to TASK-1220 (user-controlled merge).
