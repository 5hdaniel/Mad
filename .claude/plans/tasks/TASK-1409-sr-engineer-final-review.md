# Task TASK-1409: SR Engineer Final Review

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `senior-engineer-pr-lead` agent.**

Direct review is PROHIBITED. The correct workflow is:

1. PM creates this task file after all implementation tasks complete
2. PM invokes `senior-engineer-pr-lead` agent
3. SR Engineer reviews all sprint work
4. SR Engineer approves merge to develop
5. Task marked complete only AFTER merge to develop verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Perform final architecture review of all SPRINT-061 work and approve merge from `project/sprint-061-communication-display-fixes` to `develop`.

## Non-Goals

- Do NOT implement any fixes (request changes if needed)
- Do NOT skip manual testing results verification
- Do NOT merge without user approval from TASK-1408

## Deliverables

1. Update: This task file with review findings
2. Action: Merge project branch to develop (if approved)

## Review Checklist

### Pre-Review Requirements

- [ ] All Phase 2 tasks merged to project branch
- [ ] TASK-1408 manual testing passed (USER APPROVED)
- [ ] All CI checks passing on project branch

### Code Review Focus Areas

#### 1. Email Count Query (TASK-1403)

- [ ] Query no longer uses `c.communication_type`
- [ ] Query correctly counts distinct emails via `email_id`
- [ ] NULL handling is correct
- [ ] Tests verify edge cases

**Files to review:**
- `electron/services/db/transactionDbService.ts`

#### 2. Text Thread Count (TASK-1404)

- [ ] Counting logic matches frontend grouping
- [ ] COALESCE fallback is appropriate
- [ ] No duplicate counting possible

**Files to review:**
- `electron/services/db/communicationDbService.ts`

#### 3. Contact Phone Lookup (TASK-1405)

- [ ] Normalization is consistent
- [ ] Common phone formats handled
- [ ] "Unknown" fallback is last resort

**Files to review:**
- TBD based on investigation

#### 4. Thread Deduplication (TASK-1406)

- [ ] Thread ID assignment is deterministic
- [ ] GUID deduplication prevents duplicates
- [ ] Re-import updates existing records

**Files to review:**
- `electron/services/macOSMessagesImportService.ts`

#### 5. UI Counters (TASK-1407)

- [ ] Counters are visible
- [ ] No visual regressions
- [ ] Zero state handled gracefully

**Files to review:**
- `src/components/transaction/components/TransactionCard.tsx`

### Architecture Compliance

- [ ] No schema changes made (as per design)
- [ ] Query patterns match existing codebase
- [ ] Error handling is consistent
- [ ] No security issues introduced

### Test Coverage

- [ ] New tests added for fixed functionality
- [ ] Coverage did not decrease
- [ ] Tests are not flaky

### Documentation

- [ ] Investigation findings documented
- [ ] Any workarounds for existing data documented
- [ ] BACKLOG items can be closed

---

## Review Decision

### Approval Status

- [ ] **APPROVED** - Ready to merge to develop
- [ ] **CHANGES REQUESTED** - See notes below
- [ ] **REJECTED** - Major issues require sprint rework

### Review Notes

<Document key observations, concerns addressed, architectural decisions validated>

### Required Changes (if any)

| # | File | Issue | Required Fix |
|---|------|-------|--------------|
| 1 | | | |

---

## Merge to Develop

**Only proceed if APPROVED above**

### Pre-Merge Verification

```bash
# Verify project branch is up to date with develop
git fetch origin
git log --oneline develop..project/sprint-061-communication-display-fixes
git log --oneline project/sprint-061-communication-display-fixes..develop
# Should show project ahead, develop not ahead (or merge develop first)

# Verify CI is green
gh pr list --base develop --head project/sprint-061-communication-display-fixes
```

### Merge Command

```bash
# Create PR if not exists
gh pr create --base develop --head project/sprint-061-communication-display-fixes \
  --title "feat(communications): fix display issues (SPRINT-061)" \
  --body "## Summary
- Fix email count query for new architecture (BACKLOG-510)
- Verify/fix text thread count calculation (BACKLOG-510)
- Fix contact phone lookup normalization (BACKLOG-513)
- Fix thread deduplication on import (BACKLOG-514)
- Re-enable communication counters in UI

## Testing
- Unit tests: Passed
- Manual testing: Passed (see TASK-1408)

## Closes
- BACKLOG-510
- BACKLOG-513
- BACKLOG-514"

# Merge after CI passes
gh pr merge <PR-NUMBER> --merge
```

### Post-Merge Verification

```bash
# Verify merge
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED

# Verify develop has changes
git checkout develop
git pull origin develop
git log --oneline -5
```

---

## PM Estimate (PM-Owned)

**Category:** `review`

**Estimated Tokens:** ~10K-15K

**Token Cap:** 60K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to review | 5-7 files | +8K |
| Code complexity | Medium | +4K |
| Documentation | Review notes | +3K |

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
| API Calls | X |

### Review Findings

**Overall Assessment:** <summary>

**Architecture Issues:** None / <list>

**Security Issues:** None / <list>

**Test Coverage:** Adequate / <concerns>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**Sprint is NOT complete until project branch is merged to develop.**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Sprint can now be marked complete

### Post-Sprint Actions

- [ ] BACKLOG-510 marked complete
- [ ] BACKLOG-513 marked complete
- [ ] BACKLOG-514 marked complete
- [ ] Sprint execution status table updated
- [ ] Task files moved to archive (PM action)
