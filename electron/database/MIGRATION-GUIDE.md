# Database Migration Guide

> Canonical reference for adding, modifying, or removing schema in Magic Audit.

## Architecture

Magic Audit uses a **version-based migration runner** with two components:

| Component | File | Purpose |
|-----------|------|---------|
| **schema.sql** | `electron/database/schema.sql` | Full schema — used for fresh installs |
| **migrations array** | `databaseService.ts` → `_runVersionedMigrations()` | Incremental changes — used for upgrades |

**Baseline version: 29** (all historical migrations 1–28 are folded into `schema.sql`).

## What Goes Where

### schema.sql (declarative, full schema)

- New tables (`CREATE TABLE IF NOT EXISTS`)
- New indexes (`CREATE INDEX IF NOT EXISTS`)
- New views, triggers
- Default data (`INSERT OR IGNORE`)

### migrations array (imperative, incremental)

- `ALTER TABLE` (add/rename/drop columns)
- Data backfills (`UPDATE ... SET`)
- Destructive changes (drop table, drop index)
- Anything that modifies existing structure

### Both (for ALTER TABLE)

When adding a column, you must update **both**:

1. **schema.sql** — add the column to the `CREATE TABLE` statement (for fresh installs)
2. **migrations array** — add an `ALTER TABLE ... ADD COLUMN` entry (for existing users)

## Rules

1. **Forward-only.** There are no down/rollback migrations. The pre-migration backup is the rollback strategy.
2. **Never modify a merged migration.** Once a migration is in `develop`, it's immutable. Create a new migration to fix issues.
3. **Never reuse version numbers.** Versions are monotonically increasing integers.
4. **One concern per migration.** Don't combine unrelated schema changes in a single migration entry.
5. **No `BEGIN`/`COMMIT` in migration code.** The runner wraps each migration + version bump in a `db.transaction()` automatically. Adding your own transaction will cause nesting errors.
6. **Keep migrations idempotent where possible.** Use `IF NOT EXISTS` / `IF EXISTS` guards for safety.

## Adding a New Migration

### Step 1: Pick the next version number

Check the last entry in the migrations array. Your version = last + 1.

### Step 2: Add the migration entry

```typescript
// In _runVersionedMigrations(), add to the migrations array:
{
  version: 30,
  description: "Add status column to transactions",
  migrate: (d) => {
    d.exec("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'active'");
  },
},
```

### Step 3: Update schema.sql (if applicable)

If you added a column, add it to the corresponding `CREATE TABLE` in `schema.sql` so fresh installs get it too.

### Step 4: Test both paths

| Path | How to test |
|------|-------------|
| **Fresh install** | Delete `mad.db`, start app — schema.sql creates everything |
| **Upgrade** | Start app with existing `mad.db` — migration runs |

Verify both produce identical schemas:

```sql
-- Run on both databases and compare output
SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name;
```

## Backup Strategy

- A pre-migration backup is created automatically on every startup.
- Only the **3 most recent** backups are retained; older ones are cleaned up.
- Backups are stored alongside `mad.db` in the user data directory.
- Backup filenames use ISO timestamps: `mad-backup-20260217T143022.db`

## Error Handling

- Each migration runs inside an **automatic transaction**. If any statement fails, the entire migration is rolled back and the version is NOT bumped.
- The app will throw on migration failure — this is intentional. A half-migrated database is worse than a failed startup.
- The pre-migration backup allows recovery: replace `mad.db` with the latest backup file.

## Checklist

Before merging a migration PR:

- [ ] Version number is unique and sequential
- [ ] `schema.sql` updated for any new columns/tables
- [ ] Fresh install tested (delete DB, start app)
- [ ] Upgrade tested (existing DB, start app)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] No `BEGIN`/`COMMIT` in migration code (runner handles this)
