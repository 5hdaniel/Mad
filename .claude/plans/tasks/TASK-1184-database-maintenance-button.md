# TASK-1184: Database Maintenance Button in Settings

**Backlog ID:** BACKLOG-498
**Sprint:** SPRINT-052 (or next available)
**Phase:** Standalone (no dependencies)
**Branch:** `feature/task-1184-database-maintenance`
**Estimated Tokens:** ~50K

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

## Objective

Add a "Database Maintenance" button in Settings that allows users to manually optimize their database by running REINDEX, ANALYZE, and VACUUM operations.

---

## Context

Migration 18 added performance indexes to speed up queries. This feature gives power users a way to manually trigger database maintenance when they notice slowdowns. The backend already has partial support (vacuum exists), but needs REINDEX and ANALYZE added, plus IPC exposure.

---

## Requirements

### Must Do:

1. **Backend - Add database maintenance functions**
   - Add `reindexDb()` to `electron/services/db/core/dbConnection.ts`
   - Add `analyzeDb()` to `electron/services/db/core/dbConnection.ts`
   - Export via `databaseService.ts`

2. **Backend - Add IPC handler**
   - Create handler for `database:optimize` or similar
   - Run operations in sequence: REINDEX -> ANALYZE -> VACUUM
   - Return success/failure with timing info

3. **Frontend - Add UI in Settings**
   - Add "Advanced" or "Storage" section in Settings.tsx
   - Add "Optimize Database" button
   - Show loading state during operation
   - Show success/error feedback

4. **Types - Update window.d.ts**
   - Add `window.api.database.optimize()` type definition

### Must NOT Do:

- Do NOT run maintenance automatically (user-triggered only)
- Do NOT block the entire app (async with loading indicator)
- Do NOT add complex options - single button for all operations
- Do NOT modify database schema

---

## Acceptance Criteria

- [ ] "Optimize Database" button visible in Settings (Advanced section)
- [ ] Clicking button runs REINDEX, ANALYZE, VACUUM in sequence
- [ ] Loading spinner shows during operation
- [ ] Success message shows with completion time
- [ ] Error handling for failures
- [ ] Button disabled during operation (prevent double-click)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] All CI checks pass

---

## Files to Modify

### Backend (electron/)

| File | Changes |
|------|---------|
| `electron/services/db/core/dbConnection.ts` | Add `reindexDb()` and `analyzeDb()` functions |
| `electron/services/databaseService.ts` | Export `reindex()`, `analyze()`, `optimize()` methods |
| `electron/handlers.ts` or `electron/database-handlers.ts` | Add `database:optimize` IPC handler |
| `electron/preload.ts` | Expose `database.optimize` to renderer |

### Frontend (src/)

| File | Changes |
|------|---------|
| `src/window.d.ts` | Add type for `window.api.database.optimize()` |
| `src/components/Settings.tsx` | Add Advanced section with Optimize button |

---

## Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/db/core/dbConnection.ts` | Existing `vacuumDb()` pattern to follow |
| `electron/services/databaseService.ts` | How `vacuum()` is exposed |
| `electron/preload.ts` | IPC exposure patterns |
| `src/components/Settings.tsx` | UI structure and patterns |

---

## Implementation Notes

### SQLite Operations

```sql
-- REINDEX: Rebuild all indexes
REINDEX;

-- ANALYZE: Update query planner statistics
ANALYZE;

-- VACUUM: Compact database file
VACUUM;
```

### Suggested Backend Implementation

```typescript
// In dbConnection.ts
export async function reindexDb(): Promise<void> {
  const database = ensureDb();
  database.exec("REINDEX");
  await logService.info("Database reindexed", "DbConnection");
}

export async function analyzeDb(): Promise<void> {
  const database = ensureDb();
  database.exec("ANALYZE");
  await logService.info("Database analyzed", "DbConnection");
}

export async function optimizeDb(): Promise<{ duration: number }> {
  const start = Date.now();
  await reindexDb();
  await analyzeDb();
  await vacuumDb();
  return { duration: Date.now() - start };
}
```

### Suggested UI Layout

```
Advanced
────────────────────────────────────
Database Maintenance
Optimize database for better performance

[Optimize Database]  (or "Optimizing..." with spinner)

Last optimized: Never (or timestamp)
```

---

## Testing Expectations

### Unit Tests

- **Required:** Yes - at least for the IPC handler
- **New tests to write:** Test `database:optimize` handler returns success
- **Existing tests to update:** None expected

### Coverage

- Add test for `optimizeDb()` function
- Add test for IPC handler

### CI Requirements

- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Tests run 3x without flakiness

**PRs without passing CI WILL BE REJECTED.**

---

## PR Preparation

- **Title:** `feat(settings): add database maintenance button`
- **Branch:** `feature/task-1184-database-maintenance`
- **Target:** `develop`
- **Labels:** `feature`, `settings`, `database`

---

## PM Estimate (PM-Owned)

**Category:** `ui` + `backend`

**Estimated Tokens:** ~50K

**Token Cap:** 200K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Backend functions | 3 simple functions | +10K |
| IPC handler | 1 handler, simple | +10K |
| Preload exposure | Standard pattern | +5K |
| UI component | Button + loading state | +15K |
| Types | window.d.ts update | +3K |
| Testing | Basic IPC test | +7K |

**Confidence:** High

**Risk factors:**
- Settings.tsx is complex, finding right location may take time
- May need to handle encrypted database edge cases

---

## Guardrails

**STOP and ask PM if:**
- VACUUM fails due to disk space
- Encrypted database causes issues with these commands
- Settings.tsx structure is significantly different than expected
- You encounter blockers not covered in the task file

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
Files modified:
- [ ] electron/services/db/core/dbConnection.ts
- [ ] electron/services/databaseService.ts
- [ ] electron/handlers.ts (or database-handlers.ts)
- [ ] electron/preload.ts
- [ ] src/window.d.ts
- [ ] src/components/Settings.tsx

Features implemented:
- [ ] Backend optimize function
- [ ] IPC handler
- [ ] UI button with loading state
- [ ] Success/error feedback

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
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

**Variance:** PM Est ~50K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~50K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

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
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
