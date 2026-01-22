# Task TASK-962: Consumer Migration to db/* Services (OPTIONAL)

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

## Status: OPTIONAL - May Be Deferred

**Decision Point:** After TASK-961 completes, decide whether to:
1. **Execute TASK-962:** Full consumer migration (cleaner architecture)
2. **Defer/Obsolete:** Keep databaseService.ts as permanent facade

**Recommendation:** Defer unless there's a compelling reason. The facade pattern from TASK-961 provides:
- Backward compatibility
- Single import point
- No risk of breaking changes

---

## Critical Context (2026-01-04)

After TASK-961, `databaseService.ts` will be a thin facade (~500 lines) that delegates to `db/*` services. This task is about eliminating that facade entirely.

### Current State (Post-TASK-961)

| Component | Status |
|-----------|--------|
| `db/*` services | Full implementation |
| `databaseService.ts` | Thin facade (<500 lines) |
| 37 consumer files | Import from `databaseService.ts` |

### Target State (If This Task Executed)

| Component | Status |
|-----------|--------|
| `db/*` services | Full implementation |
| `databaseService.ts` | DELETED |
| 37 consumer files | Direct `db/*` imports |

---

## Goal

Migrate all 37 consumer files from `databaseService.ts` imports to direct `db/*` service imports, then delete `databaseService.ts`.

## Non-Goals

- Do NOT change database behavior
- Do NOT modify db/* service implementations
- Do NOT add new database operations

## Deliverables

1. **Consumer Audit:** List all 37 files and their required imports
2. **Import Migration:** Update each file to import from `db/*`
3. **Facade Deletion:** Delete `databaseService.ts`
4. **Test Updates:** Update test imports

## Acceptance Criteria

- [ ] All 37 consumer files migrated to direct `db/*` imports
- [ ] `databaseService.ts` deleted
- [ ] No runtime import errors
- [ ] All existing functionality preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Step 1: Audit Consumers

List all 37 files importing from databaseService.ts:

```bash
grep -rn "from.*databaseService" --include="*.ts" electron/
```

### Step 2: Map Import Needs

For each file, determine which db/* services it needs:

| Consumer File | Needs |
|---------------|-------|
| `transactionService.ts` | `transactionDbService`, `contactDbService` |
| `gmailFetchService.ts` | `communicationDbService`, `userDbService` |
| ... | ... |

### Step 3: Update Imports

**Before:**
```typescript
import { createUser, getUser, createTransaction } from '../databaseService';
```

**After:**
```typescript
import { createUser, getUser } from '../db/userDbService';
import { createTransaction } from '../db/transactionDbService';
```

### Step 4: Delete Facade

Once all consumers migrated:
```bash
rm electron/services/databaseService.ts
```

### Consumer Files to Migrate (37 total)

**Services:**
- `electron/services/transactionService.ts`
- `electron/services/googleAuthService.ts`
- `electron/services/microsoftAuthService.ts`
- `electron/services/connectionStatusService.ts`
- `electron/services/iPhoneSyncStorageService.ts`
- `electron/services/outlookFetchService.ts`
- `electron/services/feedbackService.ts`
- `electron/services/gmailFetchService.ts`
- `electron/services/feedbackLearningService.ts`
- `electron/services/llm/batchLLMService.ts`

**Handlers:**
- `electron/handlers/googleAuthHandlers.ts`
- `electron/handlers/microsoftAuthHandlers.ts`
- `electron/handlers/sharedAuthHandlers.ts`
- `electron/handlers/outlookHandlers.ts`
- `electron/handlers/sessionHandlers.ts`
- `electron/contact-handlers.ts`
- `electron/system-handlers.ts`
- `electron/auth-handlers.ts`
- `electron/feedback-handlers.ts`

**Tests (19 files):**
- Various test files in `electron/__tests__/` and `electron/services/__tests__/`

## Integration Notes

- Imports from: `./db/*` services directly
- Exports to: N/A (consumers import directly)
- Used by: N/A
- Depends on: TASK-961 (facade must be working first)

## Do / Don't

### Do:
- Migrate one domain at a time (all user imports, then all transaction imports, etc.)
- Run tests after each batch of migrations
- Keep PR size manageable (consider multiple PRs if needed)

### Don't:
- Change db/* service implementations
- Add new imports that weren't in databaseService.ts
- Skip test file migrations

## When to Stop and Ask

- If a consumer needs a function not exported by db/*
- If migration causes circular dependency
- If more than 20% of tests fail

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update test imports
- All tests must pass after migration

### Coverage

- Coverage impact: Must not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

## PR Preparation

- **Title**: `refactor(db): migrate consumers to direct db/* imports`
- **Labels**: `refactor`, `database`, `cleanup`
- **Depends on**: TASK-961

---

## SR Engineer Review Notes

**Review Date:** 2026-01-04 | **Status:** APPROVED - OPTIONAL

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after TASK-961 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** `refactor/TASK-962-db-consumer-migration`

### Execution Classification
- **Parallel Safe:** No (sequential after TASK-961)
- **Depends On:** TASK-961
- **Blocks:** Nothing (this is optional cleanup)

### Recommendation

**Consider deferring this task.** The facade pattern from TASK-961 is a valid long-term architecture:
- Single import point is easier for developers
- No risk of import errors from multiple sources
- Backward compatibility with any code expecting databaseService.ts

Execute this task only if:
- Clean architecture is a project priority
- Multiple PRs are touching db/* and causing confusion
- There's a measurable benefit to direct imports

### Risk Assessment
- **Medium risk** - touching 37 files across codebase
- Main risk: Missing a consumer, causing runtime errors
- Mitigation: Comprehensive grep before deletion

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~20-25K (REDUCED - no new code, just import changes)

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 37 consumer files | +15K |
| Files to delete | 1 (databaseService.ts) | +1K |
| Test imports | ~19 test files | +5K |

**Confidence:** High (mechanical changes)

**Risk factors:**
- Missing consumers (low - grep will find all)
- Circular dependencies (low - already resolved in db/*)

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
Migration:
- [ ] Consumer audit completed (37 files)
- [ ] Services migrated (10 files)
- [ ] Handlers migrated (9 files)
- [ ] Tests migrated (19 files)
- [ ] databaseService.ts deleted

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] No runtime import errors
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
