# TASK-2268: Add Supabase Migration CI Step + Automated Backup Verification

**Backlog ID:** BACKLOG-1266
**Sprint:** SecReview H: Deferred Improvements
**Branch:** `fix/task-2268-migration-ci`
**Estimated Tokens:** 20K-35K
**Lane:** Parallel (independent -- infrastructure only, no shared files)
**Integration Branch:** `int/secreview-h`

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. Follow the 15-step agent-handoff workflow.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Add a CI workflow step that validates Supabase migrations are syntactically correct and consistent before merge, and document/automate the backup verification strategy. This prevents broken migrations from reaching production.

## Non-Goals

- Do NOT modify existing Supabase migrations
- Do NOT set up a Supabase preview/staging branch in CI (cost concern)
- Do NOT change the production backup schedule
- Do NOT modify application code (electron, admin-portal, broker-portal)
- Do NOT add migration rollback automation (manual process for now)

## Deliverables

1. **Create migration validation CI step** (`.github/workflows/migration-check.yml` or add to existing CI):
   - Triggered on PRs that modify `supabase/migrations/`
   - Validates SQL syntax (use `pg_query` or similar linter)
   - Checks migration naming convention (timestamp prefix)
   - Verifies no duplicate migration timestamps
   - Checks that migrations are additive (no DROP without corresponding CREATE)

2. **Create migration lint script** (`scripts/lint-migrations.sh` or `.ts`):
   - Validates SQL file syntax
   - Checks for dangerous patterns (DROP TABLE without IF EXISTS, etc.)
   - Ensures migration files follow naming convention
   - Can run locally and in CI

3. **Document backup verification** (`docs/backup-verification.md` or similar):
   - Current backup strategy (Supabase automatic backups)
   - How to verify a backup exists before migration
   - Manual restore procedure
   - Pre-migration checklist

4. **Add pre-migration safety check** to the migration script (if one exists):
   - Verify latest backup is < 24h old
   - Log backup timestamp before proceeding

## File Boundaries

### Files to modify (owned by this task):
- New: `.github/workflows/migration-check.yml` (or added step to existing workflow)
- New: `scripts/lint-migrations.sh` (or `.ts`)
- New: `docs/backup-verification.md`
- Possibly: existing CI workflow files (add migration check trigger)

### Files this task must NOT modify:
- `supabase/migrations/*.sql` -- existing migrations
- Any application source code
- `supabase/config.toml` -- Supabase project config

### If you need to modify a restricted file:
**STOP** and notify PM.

## Acceptance Criteria

- [ ] CI step runs on PRs that touch `supabase/migrations/`
- [ ] Migration lint script catches common errors (syntax, naming, dangerous ops)
- [ ] CI step passes on current migrations (no false positives)
- [ ] Backup verification documentation created
- [ ] Migration lint script can run locally (`npm run lint:migrations` or equivalent)
- [ ] All existing CI checks still pass
- [ ] New CI workflow passes

## Implementation Notes

### Key Patterns

```yaml
# .github/workflows/migration-check.yml
name: Migration Validation
on:
  pull_request:
    paths:
      - 'supabase/migrations/**'
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate migration files
        run: |
          ./scripts/lint-migrations.sh
```

```bash
#!/bin/bash
# scripts/lint-migrations.sh

# Check naming convention: YYYYMMDDHHMMSS_description.sql
for f in supabase/migrations/*.sql; do
  basename=$(basename "$f")
  if ! [[ "$basename" =~ ^[0-9]{14}_.*\.sql$ ]]; then
    echo "ERROR: Invalid migration name: $basename"
    echo "Expected: YYYYMMDDHHMMSS_description.sql"
    exit 1
  fi
done

# Check for duplicate timestamps
timestamps=$(ls supabase/migrations/ | grep -oP '^\d{14}' | sort)
duplicates=$(echo "$timestamps" | uniq -d)
if [ -n "$duplicates" ]; then
  echo "ERROR: Duplicate migration timestamps: $duplicates"
  exit 1
fi

# Check for dangerous patterns
for f in supabase/migrations/*.sql; do
  if grep -qiP 'DROP\s+TABLE(?!\s+IF\s+EXISTS)' "$f"; then
    echo "WARNING: $f contains DROP TABLE without IF EXISTS"
  fi
done

echo "All migration checks passed"
```

### Important Details

- **No Supabase CLI in CI**: We don't want to run `supabase db push` in CI (would need a database). Keep it to static analysis.
- **SQL syntax validation**: Consider using `pgsanity` or `sqlfluff` for SQL linting, or a simple regex-based approach if those add too many dependencies.
- **Existing workflows**: Check `.github/workflows/` for existing CI that could host this step vs creating a new workflow.
- **Keep it lightweight**: The CI step should complete in < 30 seconds.

## Integration Notes

- Independent of all other Sprint H tasks
- Infrastructure only -- no application code changes
- Future migrations will automatically be validated by this CI step

## Do / Don't

### Do:
- Make the lint script runnable locally (not just in CI)
- Test against existing migrations (should all pass)
- Keep validation fast (< 30 seconds)
- Document common migration patterns in the backup doc

### Don't:
- Don't require a database connection for validation (static analysis only)
- Don't block PRs on warnings (only errors should fail CI)
- Don't modify existing migrations to fix warnings
- Don't add heavy dependencies (prefer shell scripts over node packages)

## When to Stop and Ask

- If existing migrations have naming inconsistencies that would fail validation
- If SQL linting tools require significant setup/configuration
- If existing CI workflow structure is unclear
- If the project doesn't have a `supabase/migrations/` directory

## Testing Expectations

### Unit Tests
- Required: No (CI workflow + shell script)
- Test the lint script locally against existing migrations

### CI Requirements
- [ ] New migration check workflow passes
- [ ] Existing CI workflows unaffected
- [ ] Lint script runs locally without errors

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~20K-35K (apply 0.5x config multiplier = ~10K-18K expected actual)

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | ~3 files (workflow, script, docs) | +10K |
| CI integration | Adding workflow trigger/step | +5K |
| Testing | Verify against existing migrations | +5K |
| Documentation | Backup verification guide | +5K |

**Confidence:** High (well-understood CI patterns, static analysis only)

**Risk factors:**
- Existing migration naming may not be consistent
- SQL linting tool selection

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~14K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:** <Key decisions>
**Deviations from plan:** <If any>
**Issues encountered:** <If any>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID
```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Merge Information

**PR Number:** #XXX
**Merged To:** int/secreview-h
