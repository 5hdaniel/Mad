# Task TASK-550: Align TypeScript Types with SQLite Schema

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

Audit and align TypeScript type definitions with the actual SQLite schema to eliminate schema drift that causes runtime errors.

## Non-Goals

- Do NOT add new columns to SQLite (that's TASK-551)
- Do NOT modify the base schema.sql (that's TASK-552)
- Do NOT change any business logic - only type definitions
- Do NOT add detection_status to TypeScript if it doesn't exist in SQLite

## Deliverables

1. Update: `src/types/database.ts` - Align with SQLite schema
2. Update: `src/types/transaction.ts` - Remove fields that don't exist
3. Update: Related service files if they reference non-existent fields

## Acceptance Criteria

- [ ] All TypeScript transaction-related types match SQLite columns exactly
- [ ] No references to `detection_status` in types (unless column exists)
- [ ] `archived` status properly included in CHECK constraints documentation
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] No runtime errors from type mismatches

## Implementation Notes

### Step 1: Audit Current SQLite Schema

Run this query to get the current schema:

```sql
.schema transactions
```

Or check the migration files and base schema:
- `electron/database/schema.sql`
- `electron/database/migrations/*.sql`

### Step 2: Compare with TypeScript Types

Check these files for mismatches:

```typescript
// src/types/database.ts
// src/types/transaction.ts
// electron/services/types.ts
```

### Key Fields to Verify

| Field | Expected in SQLite | Expected in TypeScript |
|-------|-------------------|----------------------|
| `status` | CHECK constraint with values | Matching union type |
| `detection_status` | May not exist | Remove if not in SQLite |
| `archived` | May be in CHECK | Include in status union |
| `submission_status` | Added in SPRINT-050 | Should exist |
| `submission_id` | Added in SPRINT-050 | Should exist |

### Step 3: Fix Mismatches

For each mismatch, decide:
1. **Field in TS but not SQLite**: Remove from TypeScript (or flag for TASK-551)
2. **Field in SQLite but not TS**: Add to TypeScript
3. **Type mismatch**: Align TypeScript to SQLite reality

### Important Details

- The `status` field should include all values from SQLite CHECK constraint
- If `archived` is used but not in CHECK, document this for TASK-552
- Use `| null` for nullable columns

## Integration Notes

- Exports to: All components using transaction types
- Used by: TASK-551 (must complete first to know what columns need adding)
- Depends on: None

## Do / Don't

### Do:
- Audit the actual SQLite schema first
- Document all mismatches found before fixing
- Keep type changes minimal and focused
- Update JSDoc comments to match types

### Don't:
- Add business logic changes
- Modify SQLite schema
- Change runtime behavior
- Add new fields "while you're in there"

## When to Stop and Ask

- If you find more than 5 fields that need alignment
- If changing a type would break multiple components
- If the SQLite schema itself seems incorrect
- If you're unsure whether a field should be added to SQLite vs removed from TS

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- Existing tests to update: If any tests use incorrect types, fix them

### Coverage

- Coverage impact: No change expected

### Integration / Feature Tests

- Required: Run the app and verify no type-related runtime errors

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without passing type-check WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(types): align TypeScript transaction types with SQLite schema`
- **Labels**: `schema`, `types`, `tech-debt`
- **Depends on**: None (first task in Phase 1)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~12K-18K

**Token Cap:** 72K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 3-5 files | +10K |
| Code volume | ~50-100 lines | +5K |
| Test complexity | Low (type changes) | +3K |

**Confidence:** Medium

**Risk factors:**
- Unknown extent of schema drift
- May discover more mismatches than expected

**Similar past tasks:** Schema alignment work in SPRINT-003

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
Files created:
- [ ] None expected

Files modified:
- [ ] src/types/database.ts
- [ ] src/types/transaction.ts
- [ ] (other files as discovered)

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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Mismatches found:**
<Document all mismatches discovered>

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |

**Root cause of variance:**
<explanation>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** N/A (type changes only)

**Review Notes:**
<observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
