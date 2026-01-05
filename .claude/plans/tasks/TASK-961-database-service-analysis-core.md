# Task TASK-961: Wire databaseService.ts Delegation to Existing db/* Services

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

## Critical Discovery (2026-01-04)

**The db/* domain services ALREADY EXIST from BACKLOG-058 (PR #137, Dec 2025).**

### What Exists

| File | Lines | Status |
|------|-------|--------|
| `db/core/dbConnection.ts` | ~100 | Connection management, query helpers |
| `db/userDbService.ts` | 209 | User CRUD |
| `db/transactionDbService.ts` | 364 | Transaction operations |
| `db/contactDbService.ts` | 520 | Contact management |
| `db/communicationDbService.ts` | 396 | Email/SMS storage |
| `db/sessionDbService.ts` | 90 | Session management |
| `db/oauthTokenDbService.ts` | 201 | OAuth token storage |
| `db/feedbackDbService.ts` | 118 | Feedback storage |
| `db/auditLogDbService.ts` | 188 | Audit logging |
| `db/llmSettingsDbService.ts` | 213 | LLM settings |
| `db/transactionContactDbService.ts` | 350 | Transaction-contact links |
| `db/index.ts` | - | Barrel export |

### The Problem

`databaseService.ts` (3,877 lines) contains ALL logic duplicated. Phase 5 (wire up delegation) was never completed after PR #137.

**Evidence:**
- Only 2 methods delegate: `getOAuthTokenSyncTime`, `updateOAuthTokenSyncTime`
- 37 files still import from `databaseService.ts`
- The db/* services are barely used (only 1 file references them)

---

## Goal

Wire `databaseService.ts` methods to delegate to existing `db/*` services, reducing it from 3,877 lines to <500 lines by removing duplicated logic.

## Non-Goals

- Do NOT create new db/* services (they exist)
- Do NOT create new directory structure (it exists)
- Do NOT migrate consumers yet (optional future work, see TASK-962)
- Do NOT change database behavior or logic
- Do NOT modify the encryption implementation

## Deliverables

1. **Delegation Mapping:** Document which databaseService.ts methods map to which db/* service
2. **Wire Delegation:** Update databaseService.ts methods to call db/* services
3. **Remove Duplicates:** Delete duplicated implementation code from databaseService.ts
4. **Thin Facade:** Keep databaseService.ts as backward-compatible facade (<500 lines)

## Acceptance Criteria

- [ ] databaseService.ts reduced from 3,877 to <500 lines
- [ ] All databaseService.ts methods delegate to db/* services
- [ ] databaseService.ts re-exports from db/* for backward compatibility
- [ ] No duplicate implementation code remains
- [ ] All existing functionality preserved (no behavior changes)
- [ ] All 37 consumer files still work without modification
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Implementation Notes

### Step 1: Analyze Current Delegation

Check which methods already delegate:
```typescript
// These already delegate (keep as-is):
getOAuthTokenSyncTime() -> oauthTokenDbService.getOAuthTokenSyncTime()
updateOAuthTokenSyncTime() -> oauthTokenDbService.updateOAuthTokenSyncTime()
```

### Step 2: Map Methods to Services

Create mapping of databaseService.ts methods to their db/* equivalents:

| databaseService.ts Method | db/* Service | db/* Method |
|---------------------------|--------------|-------------|
| `createUser()` | `userDbService` | `createUser()` |
| `getUser()` | `userDbService` | `getUser()` |
| `updateUser()` | `userDbService` | `updateUser()` |
| ... | ... | ... |

### Step 3: Wire Delegation

Transform methods from implementation to delegation:

**Before:**
```typescript
async createUser(user: User): Promise<void> {
  const db = this.getDb();
  const stmt = db.prepare(`INSERT INTO users ...`);
  // 20+ lines of implementation
}
```

**After:**
```typescript
async createUser(user: User): Promise<void> {
  return userDbService.createUser(user);
}
```

### Step 4: Add Re-exports

For any types or functions that consumers expect from databaseService.ts:

```typescript
// electron/services/databaseService.ts

// Re-export db/* services for direct import (optional)
export * from './db/userDbService';
export * from './db/transactionDbService';
// etc.

// Or keep class wrapper that delegates
class DatabaseService {
  // Delegation methods...
}
```

### Step 5: Verify Backward Compatibility

Ensure all 37 consumer files work:
```bash
grep -rn "from.*databaseService" --include="*.ts" electron/ | head -20
```

Each import should still resolve and work.

### Domain Mapping Reference

Based on existing db/* services:

| Domain | Service File | Expected Methods |
|--------|--------------|------------------|
| User | `userDbService.ts` | create, get, update, delete user |
| Transaction | `transactionDbService.ts` | transaction CRUD, queries |
| Contact | `contactDbService.ts` | contact CRUD, search |
| Communication | `communicationDbService.ts` | email/SMS storage |
| Session | `sessionDbService.ts` | session management |
| OAuth | `oauthTokenDbService.ts` | token storage, sync time |
| Feedback | `feedbackDbService.ts` | feedback storage |
| Audit | `auditLogDbService.ts` | audit logging |
| LLM | `llmSettingsDbService.ts` | LLM settings |
| TransactionContact | `transactionContactDbService.ts` | links |

## Integration Notes

- Imports from: `./db/*` services
- Exports to: 37 consumer files via backward-compatible facade
- Used by: TASK-962 (optional consumer migration)
- Depends on: None

## Do / Don't

### Do:
- Check existing db/* services for equivalent methods first
- Keep databaseService.ts as thin delegation layer
- Maintain backward compatibility for all 37 consumers
- Test database operations after each domain wiring

### Don't:
- Create new db/* service files (they exist)
- Change the public API signatures
- Move consumers to direct db/* imports (that's TASK-962)
- Modify db/* service implementations

## When to Stop and Ask

- If a databaseService.ts method has NO equivalent in db/*
- If db/* implementation differs from databaseService.ts implementation
- If wiring causes type mismatches
- If more than 10% of tests fail after changes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (wiring only)
- Existing tests to verify: All database-related tests must still pass
- No test import updates needed (backward compat maintained)

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios: Verify all CRUD operations work through facade

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs that break database functionality WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(db): wire databaseService.ts delegation to db/* services`
- **Labels**: `refactor`, `database`, `phase-5-completion`
- **Depends on**: None

---

## SR Engineer Review Notes

**Review Date:** 2026-01-04 | **Status:** APPROVED - SCOPE REVISED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `refactor/TASK-961-db-delegation-wiring`

### Execution Classification
- **Parallel Safe:** Yes (different files than TASK-960, TASK-963)
- **Depends On:** None
- **Blocks:** TASK-962 (optional), TASK-964

### Scope Change Summary

**Original Scope:** Create db/* structure and extract core
**Revised Scope:** Wire delegation to EXISTING db/* services

This is simpler work - no new files to create, just wiring.

### Shared File Analysis
- Files modified: `electron/services/databaseService.ts` only
- No new files created
- Conflicts with: TASK-962 (sequential dependency)

### Technical Considerations
- Existing db/* services are function-based
- databaseService.ts is class-based singleton
- Class methods should delegate to function calls
- Watch for `this` context issues in delegation

### Risk Assessment
- **Lower risk than original scope** - not creating new code, just wiring
- Main risk: method signature mismatches between facade and db/* services
- Mitigation: Type checking will catch mismatches

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~15-20K (REDUCED from ~30K due to simpler scope)

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 (services exist) | -15K |
| Files to modify | 1 (databaseService.ts) | +10K |
| Method wiring | ~50 methods to wire | +10K |

**Confidence:** High (simpler scope)

**Risk factors:**
- Method signature mismatches (low - types will catch)
- Missing db/* equivalents (medium - may need to add)

**Scope comparison:** Original estimate assumed creating files. Revised scope is wiring only.

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
Analysis:
- [ ] Method mapping document created
- [ ] Identified methods with no db/* equivalent

Files modified:
- [ ] electron/services/databaseService.ts (<500 lines)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] All 37 consumer files still work
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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
**Security Review:** N/A (no security changes)
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
