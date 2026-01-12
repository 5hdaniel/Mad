# TASK-1027: Audit window.api Calls in Components

**Backlog ID:** BACKLOG-204
**Sprint:** SPRINT-032
**Phase:** Phase 3 - Architecture Audit
**Branch:** `docs/task-1027-window-api-audit`
**Estimated Tokens:** ~15K
**Token Cap:** 60K

---

## Objective

Create a comprehensive audit document listing all direct `window.api` calls in React components, categorized by domain, to inform future service layer abstraction work.

---

## Context

Multiple React components make direct calls to `window.api.*` instead of using the service layer. This audit will document the current state and inform Phase 2-3 of BACKLOG-204 (service layer extension and migration).

### Architecture Goal

```
Current: Component -> window.api -> IPC -> Main Process
Target:  Component -> Service -> window.api -> IPC -> Main Process
```

---

## Requirements

### Must Do:
1. Search all `src/components/` files for `window.api` usage
2. Search all `src/hooks/` files for `window.api` usage
3. Categorize calls by API domain (auth, transactions, contacts, etc.)
4. List file location and line number for each call
5. Identify which services already exist for each domain
6. Estimate migration complexity for each category
7. Create markdown document with findings

### Must NOT Do:
- Make any code changes
- Create new services (Phase 2)
- Migrate any components (Phase 3)
- Modify existing service files

---

## Acceptance Criteria

- [ ] Audit document created at `.claude/docs/window-api-audit.md`
- [ ] All `window.api` calls in components documented
- [ ] All `window.api` calls in hooks documented
- [ ] Calls categorized by API domain
- [ ] Existing service coverage identified
- [ ] Migration complexity estimated per domain
- [ ] Total count and breakdown provided

---

## Output Format

Create `.claude/docs/window-api-audit.md` with this structure:

```markdown
# window.api Usage Audit

## Summary

| Domain | Components | Hooks | Total Calls | Service Exists | Migration Complexity |
|--------|------------|-------|-------------|----------------|---------------------|
| auth   | X          | Y     | Z           | Yes            | Low                 |
| ...    | ...        | ...   | ...         | ...            | ...                 |

## Detailed Findings

### Domain: auth

**Existing Service:** `src/services/authService.ts`

| File | Line | Call | Notes |
|------|------|------|-------|
| Settings.tsx | 45 | window.api.auth.logout() | Should use authService |
| ...

### Domain: transactions
...

## Recommendations

1. Priority domains to migrate
2. Services to create
3. Estimated total effort
```

---

## Files to Search

- `src/components/**/*.tsx`
- `src/components/**/*.ts`
- `src/hooks/**/*.ts`

## Files to Reference

- `src/services/authService.ts`
- `src/services/transactionService.ts`
- `src/services/systemService.ts`
- `src/services/deviceService.ts`

---

## Search Approach

```bash
# Find all window.api calls in components
grep -rn "window\.api\." src/components/ --include="*.tsx" --include="*.ts"

# Find all window.api calls in hooks
grep -rn "window\.api\." src/hooks/ --include="*.ts"

# Count by domain
grep -rn "window\.api\." src/ --include="*.tsx" --include="*.ts" | grep -oP "window\.api\.\w+" | sort | uniq -c
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (documentation task)
- **New tests to write:** None
- **Existing tests to update:** None

### CI Requirements
- [ ] No code changes, so N/A
- [ ] Document follows markdown lint rules

---

## PR Preparation

- **Title:** `docs: audit window.api usage in components for service abstraction`
- **Branch:** `docs/task-1027-window-api-audit`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Read task file completely

Search:
- [ ] Searched components for window.api
- [ ] Searched hooks for window.api
- [ ] Identified all unique calls
- [ ] Categorized by domain

Analysis:
- [ ] Checked existing services
- [ ] Estimated complexity per domain
- [ ] Identified priority areas

Documentation:
- [ ] Audit document created
- [ ] Summary table complete
- [ ] Detailed findings documented
- [ ] Recommendations provided

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Audit Summary

| Domain | Total Calls | Service Coverage |
|--------|-------------|------------------|
| ... | ... | ... |

**Total window.api calls found:** X
**Already covered by services:** Y
**Needs service abstraction:** Z

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find security-sensitive window.api calls that need immediate attention
- The scope is significantly larger than expected (>50 unique calls)
- You discover undocumented API domains
- You encounter blockers not covered in the task file
