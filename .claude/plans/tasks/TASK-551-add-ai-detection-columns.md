# Task TASK-551: Add AI Detection Columns to SQLite

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

Add missing AI detection columns to SQLite schema via migration to align with TypeScript type expectations.

## Non-Goals

- Do NOT update TypeScript types (that was TASK-550)
- Do NOT update base schema.sql (that's TASK-552)
- Do NOT implement AI detection logic - just add the columns
- Do NOT modify existing data

## Deliverables

1. New file: `electron/database/migrations/XXXX_add_detection_columns.sql`
2. Update: `electron/services/databaseService.ts` - Ensure migration runs

## Acceptance Criteria

- [ ] Migration file created with proper naming (sequential number)
- [ ] Migration adds `detection_status`, `detection_confidence`, `detected_at` columns
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Existing transactions data is preserved
- [ ] Migration runs successfully on app start
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

## Implementation Notes

### Migration File

Create file: `electron/database/migrations/XXXX_add_detection_columns.sql`

```sql
-- Migration: Add AI detection columns to transactions table
-- These columns support future AI-powered transaction categorization

-- Add detection_status column (nullable TEXT for optional AI status)
ALTER TABLE transactions ADD COLUMN detection_status TEXT;

-- Add detection_confidence column (nullable REAL for confidence score 0.0-1.0)
ALTER TABLE transactions ADD COLUMN detection_confidence REAL;

-- Add detected_at column (nullable TEXT for ISO timestamp of detection)
ALTER TABLE transactions ADD COLUMN detected_at TEXT;
```

### Migration Naming

Check existing migrations to determine the next sequence number:

```bash
ls electron/database/migrations/*.sql
```

Use format: `NNNN_add_detection_columns.sql` (e.g., `0010_add_detection_columns.sql`)

### Idempotency

SQLite's `ALTER TABLE ADD COLUMN` will fail if column exists. For idempotency, either:

1. **Recommended**: Let migration system handle "already run" detection
2. **Alternative**: Use conditional checks if migration system doesn't support this

Check how existing migrations handle this pattern in `electron/services/databaseService.ts`.

### Important Details

- All new columns should be nullable (no existing data to populate)
- `detection_confidence` should be REAL type for decimal values
- `detected_at` should be TEXT to match existing timestamp patterns

## Integration Notes

- Imports from: None
- Exports to: TASK-552 (base schema should include these columns)
- Depends on: TASK-550 (must complete first to verify type alignment)

## Do / Don't

### Do:
- Follow existing migration file patterns
- Make columns nullable
- Test on a fresh database AND an existing database
- Document migration in code comments

### Don't:
- Modify existing columns
- Add constraints that would invalidate existing data
- Make columns NOT NULL (would break existing rows)
- Add indexes yet (premature optimization)

## When to Stop and Ask

- If existing migrations use a different pattern than expected
- If the migration system doesn't support sequential migrations
- If you're unsure about the migration numbering scheme
- If running the migration causes any data loss

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No
- Existing tests: Should continue to pass (schema additions are backward compatible)

### Coverage

- Coverage impact: No change expected

### Integration / Feature Tests

- Required scenarios:
  - Fresh database: Migration creates columns
  - Existing database: Migration adds columns without data loss

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs that break existing tests WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(schema): add AI detection columns to transactions table`
- **Labels**: `schema`, `database`
- **Depends on**: TASK-550 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 migration file | +3K |
| Files to modify | 1 service file (maybe) | +3K |
| Code volume | ~20 lines SQL | +2K |
| Test complexity | Low (manual verify) | +2K |

**Confidence:** High

**Risk factors:**
- Migration system may have quirks
- Unknown existing migration patterns

**Similar past tasks:** BACKLOG-390 (SPRINT-050 local schema changes)

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
- [ ] electron/database/migrations/XXXX_add_detection_columns.sql

Files modified:
- [ ] (list any service file changes)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Fresh database gets new columns
- [ ] Existing database migrates successfully
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

### Notes

**Migration number used:** XXXX

**Planning notes:**
<Key decisions>

**Deviations from plan:**
<If any>

**Reviewer notes:**
<Anything for reviewer>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** N/A (migration)

**Review Notes:**
<observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
