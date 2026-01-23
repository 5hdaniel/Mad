# Task TASK-1170: Align TypeScript Types with SQLite Schema

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

Align TypeScript type definitions with the actual SQLite schema to fix schema drift issues. This ensures type safety and prevents runtime errors from missing or mismatched fields.

## Non-Goals

- Do NOT modify the database schema (that's TASK-1171)
- Do NOT add new features
- Do NOT change business logic

## Problem Statement

TypeScript types reference fields that don't exist in SQLite or have mismatched definitions:
- `detection_status` referenced in filter logic but doesn't exist
- `archived` exists in TypeScript but not in SQLite CHECK constraint
- Other potential drift from migrations not reflected in types

## Deliverables

1. Audit all TypeScript interfaces against SQLite schema
2. Document all mismatches found
3. Update TypeScript types to match SQLite schema
4. Remove or fix references to non-existent fields

## Acceptance Criteria

- [ ] TypeScript types match SQLite schema exactly
- [ ] No runtime errors from missing fields
- [ ] `npm run type-check` passes
- [ ] `npm test` passes (no broken tests from type changes)
- [ ] `npm run lint` passes
- [ ] All CI checks pass

## Files to Audit

### TypeScript Types (Check against SQLite)
- `src/types/database.ts`
- `src/types/transaction.ts`
- `electron/types/models.ts`

### SQLite Schema (Source of Truth)
- `electron/database/schema.sql`
- `electron/database/migrations/*.sql`

### Related Service Files (May reference types)
- `electron/services/databaseService.ts`
- `src/services/transactionService.ts`

## Implementation Notes

### Audit Process

1. **Read SQLite schema.sql** - Document all columns for each table
2. **Read TypeScript types** - Document all interface fields
3. **Compare** - Identify mismatches
4. **Classify mismatches**:
   - Type in TS but not in SQLite -> Remove from TS (or flag for TASK-1171)
   - Type in SQLite but not in TS -> Add to TS
   - Different type/constraints -> Align TS to SQLite

### Known Issues to Check

From BACKLOG-409:
- `detection_status` - may be in code but not schema
- `archived` status - may not be in CHECK constraint

### Status Field CHECK Constraint

Current SQLite likely has:
```sql
CHECK (status IN ('new', 'pending', 'submitted', 'approved', 'rejected', 'needs_changes', 'closed'))
```

TypeScript should have:
```typescript
type TransactionStatus = 'new' | 'pending' | 'submitted' | 'approved' | 'rejected' | 'needs_changes' | 'closed';
```

### License Fields (from TASK-1161)

If TASK-1161 has merged, ensure these are in types:
```typescript
export type LicenseType = 'individual' | 'team' | 'enterprise';

export interface User {
  // ...
  licenseType: LicenseType;
  aiDetectionEnabled: boolean;
  organizationId: string | null;
}
```

## Integration Notes

- Imports from: SQLite schema definitions
- Exports to: All services and components using these types
- Used by: Entire application
- Depends on: TASK-1161 (License Schema) - must incorporate license types

**IMPORTANT:** This task runs AFTER Phase 2 and Phase 3 are complete. Ensure all schema changes from earlier tasks are incorporated.

## Do / Don't

### Do:
- Document every mismatch found
- Preserve backward compatibility where possible
- Update related code that uses changed types
- Run full test suite after changes

### Don't:
- Don't modify SQLite schema (that's TASK-1171)
- Don't change business logic
- Don't add new fields not in SQLite
- Don't break existing functionality

## When to Stop and Ask

- If you find types used extensively that don't exist in SQLite
- If aligning types would break significant functionality
- If the mismatch is more complex than expected
- If you're unsure whether a field should exist or not

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests, but verify existing tests pass
- Update tests if they rely on removed/changed fields

### Coverage

- Coverage impact: Should not change (type-only changes)

### Integration / Feature Tests

- Required scenarios:
  - App starts without type errors
  - Transaction CRUD operations work
  - Status filtering works

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking (critical for this task)
- [ ] Lint / format checks

**PRs without passing type-check WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(types): align TypeScript types with SQLite schema`
- **Labels**: `schema`, `types`, `fix`, `sprint-051`
- **Depends on**: Phase 2 (TASK-1163) and Phase 3 (all tasks)

---

## PM Estimate (PM-Owned)

**Category:** `types`

**Estimated Tokens:** ~10K-20K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to audit | 3-4 type files | +5K |
| Schema reading | 2-3 schema files | +3K |
| Type updates | ~50-100 lines | +5K |
| Test verification | Low | +2K |

**Confidence:** Medium

**Risk factors:**
- Drift may be more extensive than expected
- Changes may break existing code
- Multiple files may need updates

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Audit Results

**Mismatches Found:**

| Field | In TypeScript | In SQLite | Resolution |
|-------|---------------|-----------|------------|
| | | | |

### Checklist

```
Audit:
- [ ] Read electron/database/schema.sql
- [ ] Read src/types/database.ts
- [ ] Read src/types/transaction.ts
- [ ] Documented all mismatches

Files modified:
- [ ] [list files changed]

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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~15K | ~XK | +/-X% |
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
