# Supabase Backup & Migration Verification

## Current Backup Strategy

Supabase provides automatic daily backups for all projects on the Pro plan and above.

### Automatic Backups (Supabase-managed)
- **Frequency:** Daily
- **Retention:** 7 days (Pro), 14 days (Team), 30 days (Enterprise)
- **Type:** Point-in-time recovery (PITR) on supported plans
- **Location:** Supabase dashboard > Settings > Database > Backups

### Manual Backups
For critical migrations, create a manual backup before proceeding:

```bash
# Using Supabase CLI (requires authenticated session)
supabase db dump --project-ref <project-ref> -f backup_$(date +%Y%m%d_%H%M%S).sql

# Using pg_dump directly (requires connection string)
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --clean --if-exists --no-owner --no-privileges \
  -f backup_$(date +%Y%m%d_%H%M%S).sql
```

## Pre-Migration Checklist

Before applying any migration to production:

- [ ] **Verify latest backup exists** -- Check Supabase dashboard for backup within last 24 hours
- [ ] **Run migration lint** -- `bash scripts/lint-migrations.sh`
- [ ] **Test migration locally** -- `supabase db reset` against local instance
- [ ] **Review migration SQL** -- Check for destructive operations (DROP, TRUNCATE, DELETE)
- [ ] **Check for dependent migrations** -- Ensure prerequisites are applied
- [ ] **Notify team** -- Alert team members before production migration
- [ ] **Schedule during low-traffic** -- Prefer off-peak hours

## Migration Validation (CI)

The `migration-check.yml` GitHub Actions workflow automatically validates migration files on PRs that modify `supabase/migrations/`.

### What It Checks

| Check | Severity | Description |
|-------|----------|-------------|
| Naming convention | Error | Files must match `YYYYMMDD_description.sql` or `YYYYMMDDHHMMSS_description.sql` |
| Duplicate filenames | Error | No two migration files can have the same name |
| DROP without IF EXISTS | Warning | DROP TABLE/COLUMN should use IF EXISTS for safety |
| TRUNCATE statements | Warning | TRUNCATE is almost always dangerous in production |
| DROP SCHEMA | Error | Dropping schemas is extremely dangerous |
| DELETE without WHERE | Warning | Mass deletes should be reviewed carefully |
| Empty migrations | Warning | Migration files should contain SQL statements |

### Running Locally

```bash
# Check all migrations
bash scripts/lint-migrations.sh

# The script will report errors, warnings, and a summary
```

## Restore Procedure

### From Supabase Dashboard Backup
1. Go to Supabase dashboard > Settings > Database > Backups
2. Select the backup closest to (but before) the issue
3. Click "Restore" and confirm
4. Note: This replaces the entire database

### From Manual pg_dump Backup
```bash
# Restore from SQL dump
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  < backup_YYYYMMDD_HHMMSS.sql
```

### Rollback a Specific Migration
If a migration needs to be reversed:

1. **Write a reverse migration** -- Create a new migration that undoes the changes
2. **Do NOT delete the original migration** -- Supabase tracks applied migrations
3. **Name it clearly** -- e.g., `20260319_revert_20260318_some_change.sql`

```sql
-- Example: Revert adding a column
ALTER TABLE some_table DROP COLUMN IF EXISTS new_column;
```

## Migration Best Practices

1. **Always use IF EXISTS / IF NOT EXISTS** for DROP/CREATE operations
2. **Make migrations idempotent** where possible -- running twice should be safe
3. **Keep migrations small** -- One logical change per file
4. **Test locally first** -- `supabase db reset` runs all migrations from scratch
5. **Never modify applied migrations** -- Create a new migration to fix issues
6. **Use transactions** for multi-statement migrations (Supabase wraps each file in a transaction by default)

## Emergency Contacts

- **Database issues:** Check Supabase status page: https://status.supabase.com/
- **Restore needed:** Supabase dashboard or contact support for PITR
- **Migration stuck:** Check `supabase_migrations.schema_migrations` table for applied state
