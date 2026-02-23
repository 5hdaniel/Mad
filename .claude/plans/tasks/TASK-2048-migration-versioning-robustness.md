# Task TASK-2048: Database Migration Versioning Robustness

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Harden the SQLite schema migration runner in `databaseService.ts` to handle version skipping, partial failures, and rollback scenarios gracefully, ensuring database integrity across app upgrades.

## Non-Goals

- Do NOT change the existing schema.sql baseline
- Do NOT add new schema migrations (only harden the runner itself)
- Do NOT change the database encryption flow
- Do NOT modify domain DB services (`db/*.ts`)
- Do NOT add a migration CLI tool or external runner

## Deliverables

1. Update: `electron/services/databaseService.ts` -- Harden `_runVersionedMigrations()` method
2. Update: `electron/services/databaseService.test.ts` -- Add robustness test cases
3. Possibly new: `electron/services/__tests__/databaseService.migration.test.ts` -- Dedicated migration tests if current file is too large

## Acceptance Criteria

- [ ] Version skip detection: if current version is 29 and migrations jump from 30 to 32 (missing 31), log a warning and halt with a clear error message
- [ ] Partial failure rollback: if a migration fails mid-execution, the transaction rollback leaves the DB at the last successful version
- [ ] Migration audit trail: each successful migration is logged to the `schema_version` table with timestamp
- [ ] Pre-migration backup is verified to exist before running migrations (fail if backup creation failed)
- [ ] Duplicate migration version detection at startup (two migrations with same version number)
- [ ] Migration dry-run mode: ability to check what migrations would run without executing them
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Current State (as of 2026-02-22)

The current migration runner in `databaseService.ts` (`_runVersionedMigrations` method, around line 365):

- Baseline version is 29 (schema.sql contains everything through migration 28)
- Current highest migration is version 31
- Each migration is wrapped in a transaction (SR review improvement from prior sprint)
- Pre-migration backup is created (TASK-1969)
- Version bumps happen inside the same transaction as the migration

**What's already good:**
- Transaction wrapping per migration (atomic)
- Pre-migration backup creation
- Version bump in same transaction as migration

**What's missing:**
- No version gap/skip detection
- No validation that backup actually succeeded before proceeding
- No duplicate version detection
- No dry-run capability
- No timestamp in schema_version entries
- Error messages don't include which version failed

### Version Skip Detection

Add validation before running migrations:

```typescript
// Validate migration sequence has no gaps
const versions = migrations.map(m => m.version).sort((a, b) => a - b);
for (let i = 1; i < versions.length; i++) {
  if (versions[i] !== versions[i - 1] + 1) {
    const gap = `Missing migration version ${versions[i - 1] + 1} (found ${versions[i - 1]} -> ${versions[i]})`;
    await logService.error(gap, "DatabaseService");
    throw new Error(`Migration sequence error: ${gap}`);
  }
}

// Also check: current DB version should be either baseline or a known migration version
if (currentVersion > 0 && currentVersion < BASELINE_VERSION) {
  await logService.warn(
    `DB version ${currentVersion} is below baseline ${BASELINE_VERSION}. Schema.sql should handle this.`,
    "DatabaseService"
  );
}
```

### Duplicate Version Detection

```typescript
const versionSet = new Set(migrations.map(m => m.version));
if (versionSet.size !== migrations.length) {
  const duplicates = migrations
    .map(m => m.version)
    .filter((v, i, arr) => arr.indexOf(v) !== i);
  throw new Error(`Duplicate migration versions detected: ${duplicates.join(', ')}`);
}
```

### Backup Verification

```typescript
// Verify backup exists before proceeding with migrations
if (this.dbPath && fs.existsSync(this.dbPath)) {
  const backupDir = path.join(path.dirname(this.dbPath), "backups");
  const backupFiles = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir).filter(f => f.startsWith("mad-pre-migration"))
    : [];

  if (backupFiles.length === 0) {
    await logService.error(
      "No pre-migration backup found. Refusing to run migrations.",
      "DatabaseService"
    );
    throw new Error("Pre-migration backup required but not found");
  }
}
```

### Schema Version Timestamp

Add a `migrated_at` column to schema_version tracking:

```typescript
// Ensure schema_version table has timestamp column
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT,
    migrated_at TEXT DEFAULT (datetime('now'))
  )
`);
```

Note: If `schema_version` already exists without `migrated_at`, add it:

```typescript
// Check if migrated_at column exists
const columns = db.prepare("PRAGMA table_info(schema_version)").all();
const hasMigratedAt = columns.some((c: any) => c.name === 'migrated_at');
if (!hasMigratedAt) {
  db.exec("ALTER TABLE schema_version ADD COLUMN migrated_at TEXT");
}
```

### Dry-Run Mode

```typescript
async _runVersionedMigrations(dryRun: boolean = false): Promise<MigrationPlan> {
  // ... existing version detection ...

  const pendingMigrations = migrations.filter(m => m.version > currentVersion);

  if (dryRun) {
    return {
      currentVersion,
      pendingMigrations: pendingMigrations.map(m => ({
        version: m.version,
        description: m.description,
      })),
      wouldRunCount: pendingMigrations.length,
    };
  }

  // ... existing migration execution ...
}
```

### Improved Error Reporting

```typescript
for (const m of migrations) {
  if (m.version > currentVersion) {
    try {
      const runInTransaction = db.transaction(() => {
        m.migrate(db);
        // Version bump with timestamp
        db.prepare(
          "INSERT OR REPLACE INTO schema_version (version, description, migrated_at) VALUES (?, ?, datetime('now'))"
        ).run(m.version, m.description);
      });
      runInTransaction();
      await logService.info(
        `Migration ${m.version} completed: ${m.description}`,
        "DatabaseService"
      );
    } catch (error) {
      await logService.error(
        `Migration ${m.version} FAILED: ${m.description}`,
        "DatabaseService",
        { error: error instanceof Error ? error.message : String(error) }
      );
      // Transaction auto-rolled back, DB stays at previous version
      throw new Error(
        `Migration ${m.version} (${m.description}) failed: ${error instanceof Error ? error.message : String(error)}. ` +
        `Database remains at version ${m.version - 1}. Pre-migration backup available.`
      );
    }
  }
}
```

## Integration Notes

- Modifies: `electron/services/databaseService.ts` (only `_runVersionedMigrations` and backup verification)
- No overlap with TASK-2046 (email sync) or TASK-2047 (iMessage import)
- The migration runner is called during `initialize()` -- changes here affect app startup
- Keep the existing migration entries (versions 30, 31) exactly as they are

## Do / Don't

### Do:
- Preserve all existing migration entries unchanged
- Keep the transaction-per-migration pattern
- Add clear, actionable error messages that tell the user what happened and what to do
- Test with an in-memory SQLite DB for unit tests (avoid file system dependencies)

### Don't:
- Modify existing migration code (versions 30, 31)
- Change the baseline version (29)
- Add new schema migrations in this task
- Make the migration runner async where it's currently sync (inside transactions)
- Throw errors silently -- always log before throwing

## When to Stop and Ask

- If the schema_version table structure differs from what's documented here
- If adding `migrated_at` column would break existing version queries
- If dry-run mode requires changes to the public API of DatabaseService
- If the backup directory structure is different from what's assumed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Version gap detection throws clear error for missing version
  - Duplicate version detection throws at startup
  - Partial failure: migration N fails, DB stays at version N-1
  - Backup verification: refuses to migrate without backup
  - Dry-run mode returns correct pending migrations without executing
  - Timestamp is recorded for each successful migration
  - Normal happy path: all migrations run in sequence
- Existing tests to update:
  - `databaseService.test.ts` -- ensure existing migration tests still pass

### Coverage

- Coverage impact: Should increase coverage of databaseService migration paths

### Integration / Feature Tests

- Required scenarios:
  - Fresh DB initialization runs all migrations from baseline
  - Existing DB at version 30 only runs version 31+
  - Corrupted migration (throws error) leaves DB at previous version

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(db): harden migration runner with gap detection, rollback, and audit trail`
- **Labels**: `bug`, `database`
- **Depends on**: None (Batch 1, parallel)

---

## PM Estimate (PM-Owned)

**Category:** `service`

**Estimated Tokens:** ~20K-30K

**Token Cap:** 120K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0-1 (dedicated test file if needed) | +3K |
| Files to modify | 2 files (scope: small-medium) | +12K |
| Code volume | ~100-150 lines new/modified | +8K |
| Test complexity | Medium (in-memory SQLite, migration scenarios) | +8K |

**Confidence:** High

**Risk factors:**
- Schema version table structure may have changed since last inspection
- In-memory SQLite testing may need special setup for migration tests

**Similar past tasks:** None directly comparable (migration runner is unique code)

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
- [ ] (dedicated migration test file if needed)

Features implemented:
- [ ] Version gap/skip detection
- [ ] Duplicate version detection
- [ ] Backup verification before migration
- [ ] Timestamp tracking in schema_version
- [ ] Dry-run mode
- [ ] Improved error messages with version context

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
