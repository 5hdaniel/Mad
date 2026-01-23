# Task TASK-1171: Update Base schema.sql

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

Update the base schema.sql file to include all columns and constraints that have been added via migrations. This ensures fresh installs get the complete schema without needing to run all migrations.

## Non-Goals

- Do NOT modify any migration files
- Do NOT change TypeScript types (that's TASK-1170)
- Do NOT add new features

## Problem Statement

The base `schema.sql` file may be out of sync with the actual database state after running all migrations. New installs should get:
- All columns added by migrations
- All CHECK constraints (including updated status values)
- All indexes created by migrations

## Deliverables

1. Audit all migration files to identify schema changes
2. Update `electron/database/schema.sql` with all changes
3. Ensure CHECK constraints are complete and correct
4. Verify fresh database creation works

## Acceptance Criteria

- [ ] Fresh installs get complete schema (all columns present)
- [ ] Schema matches what migrated databases have
- [ ] All CHECK constraints are correct and complete
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] All CI checks pass
- [ ] Database service tests pass

## Files to Modify

- `electron/database/schema.sql` - Main schema file

## Files to Reference

- `electron/database/migrations/*.sql` - All migration files
- `src/types/database.ts` - Types should match (from TASK-1170)

## Implementation Notes

### Migration Audit Process

1. List all migration files in order
2. For each migration, note:
   - Tables created
   - Columns added
   - Constraints changed
   - Indexes created
3. Consolidate into base schema

### Expected Changes (Based on Backlog)

1. **Transaction Status CHECK Constraint**:
   Should include all statuses used:
   ```sql
   CHECK (status IN ('new', 'pending', 'submitted', 'approved', 'rejected', 'needs_changes', 'closed', 'archived'))
   ```

2. **AI Detection Columns** (if added via migration):
   ```sql
   detection_status TEXT CHECK (detection_status IN ('pending', 'detected', 'confirmed', 'dismissed')),
   detection_confidence REAL,
   detected_at TEXT
   ```

3. **License Columns** (from TASK-1161):
   ```sql
   license_type TEXT DEFAULT 'individual' CHECK (license_type IN ('individual', 'team', 'enterprise')),
   ai_detection_enabled INTEGER DEFAULT 0,
   organization_id TEXT
   ```

### Schema Verification

After updating, verify:
1. Delete local database
2. Run app to create fresh database
3. Check all expected columns exist
4. Check all constraints are correct

## Integration Notes

- Imports from: Migration files (reference only)
- Exports to: Used by database service for fresh installs
- Used by: All new installations, test database creation
- Depends on: TASK-1170 (TypeScript alignment) - should match types

## Do / Don't

### Do:
- Keep schema.sql well-organized and commented
- Preserve the order of table creation for foreign keys
- Include all indexes from migrations
- Test with fresh database creation

### Don't:
- Don't modify migration files
- Don't add columns that aren't in any migration
- Don't change column types without migration support
- Don't remove existing columns

## When to Stop and Ask

- If you find conflicting migrations
- If the schema structure is significantly different than expected
- If you need to add columns that don't exist in any migration
- If database creation fails after changes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- Verify: Database service tests still pass

### Coverage

- Coverage impact: None (schema file only)

### Integration / Feature Tests

- Required scenarios:
  - Fresh database creation succeeds
  - All columns are queryable
  - All constraints work (try invalid values)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without passing CI WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(schema): update base schema.sql with all migration changes`
- **Labels**: `schema`, `fix`, `sprint-051`
- **Depends on**: TASK-1170 (TypeScript alignment)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Migration audit | 5-10 files | +4K |
| Schema updates | ~50-100 lines | +4K |
| Verification | Database test | +2K |

**Confidence:** High

**Risk factors:**
- Migration files may have conflicts
- Schema structure may be complex

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Migration Audit Results

| Migration File | Changes Incorporated |
|----------------|---------------------|
| | |

### Checklist

```
Audit:
- [ ] Listed all migration files
- [ ] Documented changes from each
- [ ] Identified columns to add
- [ ] Identified constraints to update

Schema Updates:
- [ ] Added missing columns
- [ ] Updated CHECK constraints
- [ ] Added missing indexes
- [ ] Schema is well-commented

Verification:
- [ ] Fresh database creation works
- [ ] All columns present
- [ ] Constraints work correctly
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

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~10K | ~XK | +/-X% |
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
