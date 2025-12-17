# Task TASK-304: Supabase Platform Allowance Schema

## Goal

Add LLM platform allowance fields to the Supabase users table, enabling admin-managed token budgets that sync to the local application.

## Non-Goals

- Do NOT implement the sync logic (that's in TASK-311)
- Do NOT modify local SQLite schema (handled in TASK-302)
- Do NOT add UI components
- Do NOT implement usage tracking logic

## Deliverables

1. New file: `supabase/migrations/YYYYMMDD_add_llm_allowance.sql` - Supabase migration
2. Update: Documentation in backlog item for manual application via Supabase dashboard

## Acceptance Criteria

- [ ] Migration SQL documented for Supabase
- [ ] Fields match local llm_settings table structure
- [ ] Migration can be run via Supabase dashboard
- [ ] Documentation clear for manual application

## Implementation Notes

### Supabase Migration SQL

Create `supabase/migrations/YYYYMMDD_add_llm_allowance.sql`:

```sql
-- Migration: Add LLM Platform Allowance Fields
-- Purpose: Enable admin-managed LLM token budgets per user
-- Date: 2025-12-16

-- Add LLM allowance fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_monthly_allowance INTEGER DEFAULT 50000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_allowance_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_allowance_reset_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN users.llm_monthly_allowance IS 'Admin-set monthly token budget for LLM features (default 50K tokens)';
COMMENT ON COLUMN users.llm_allowance_used IS 'Tokens used against platform allowance this month';
COMMENT ON COLUMN users.llm_allowance_reset_date IS 'Date when allowance was last reset';

-- Create function to reset allowance monthly (optional - can be cron job)
CREATE OR REPLACE FUNCTION reset_llm_allowance_if_needed()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset if it's a new month since last reset
  IF NEW.llm_allowance_reset_date IS NULL OR
     DATE_TRUNC('month', NEW.llm_allowance_reset_date) < DATE_TRUNC('month', CURRENT_DATE) THEN
    NEW.llm_allowance_used := 0;
    NEW.llm_allowance_reset_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger creation is optional, can be handled in application code
-- CREATE TRIGGER reset_llm_allowance_trigger
-- BEFORE UPDATE ON users
-- FOR EACH ROW
-- EXECUTE FUNCTION reset_llm_allowance_if_needed();
```

### Manual Application Steps

Since Supabase migrations require dashboard access:

1. Go to Supabase Dashboard → SQL Editor
2. Copy the migration SQL above
3. Execute the SQL
4. Verify columns added: `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'llm%';`

### TypeScript Type Update (Optional)

If there's a Supabase types file, add:

```typescript
// In types/supabase.ts or similar
export interface SupabaseUser {
  // ... existing fields ...
  llm_monthly_allowance?: number;
  llm_allowance_used?: number;
  llm_allowance_reset_date?: string;
}
```

### Important Details

- Default allowance is 50,000 tokens (~$0.05-0.10 depending on model)
- Allowance is separate from BYOK usage (user's own API key)
- Admin can adjust per-user allowance via Supabase dashboard
- Reset logic can be trigger-based or application-based

## Integration Notes

- Imports from: None (Supabase schema)
- Exports to: None
- Used by: TASK-311 (LLM Config Service) for sync
- Depends on: None (can start immediately)

## Do / Don't

### Do:
- Use `IF NOT EXISTS` for idempotent migration
- Add comments for documentation
- Document manual application steps clearly

### Don't:
- Don't assume direct database access (need Supabase dashboard)
- Don't create complex triggers without testing
- Don't modify other Supabase tables

## When to Stop and Ask

- If Supabase users table structure is different than expected
- If there's no access to Supabase dashboard
- If existing llm-related columns exist with different names
- If organization uses different Supabase migration workflow

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (Supabase schema, tested via dashboard)
- New tests to write: None
- Existing tests to update: None

### Coverage

- Coverage impact: No change (Supabase schema not in local tests)

### Integration / Feature Tests

- Required scenarios:
  - Verify columns exist after migration (manual check)
  - Verify default values applied

### CI Requirements

This task's PR MUST pass:
- [ ] Lint / format checks for SQL file (if applicable)
- [ ] Documentation review

**Note:** This is primarily a documentation task. The actual migration is applied manually.

## PR Preparation

- **Branch**: `feature/TASK-304-supabase-llm-allowance`
- **Title**: `feat(supabase): add LLM platform allowance schema`
- **Labels**: `database`, `supabase`, `ai-mvp`, `sprint-004`
- **Depends on**: None

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] supabase/migrations/YYYYMMDD_add_llm_allowance.sql

Documentation:
- [ ] Manual application steps documented
- [ ] Verification query documented

Verification:
- [ ] SQL syntax validated
- [ ] Migration applied to Supabase (manual step)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any deviations, explain what and why>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything reviewer should pay attention to>

---

## SR Engineer Review Notes

**Review Date:** 2025-12-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** int/schema-foundation
- **Suggested Branch Name:** feature/TASK-304-supabase-llm-allowance

### Execution Classification
- **Parallel Safe:** Yes (with TASK-301, TASK-302, TASK-303)
- **Depends On:** None
- **Blocks:** TASK-305 (Migration Testing) - weak dependency, primarily documentation

### Shared File Analysis
- Files created:
  - `supabase/migrations/YYYYMMDD_add_llm_allowance.sql`
- Conflicts with:
  - **NONE** - This task creates a new file in a separate directory (Supabase schema)
  - No overlap with local SQLite migrations

### Technical Considerations
- **Lowest risk parallel task** - completely isolated file changes
- Supabase migration applied manually via dashboard, not automated
- SQL file is documentation + manual execution
- Default allowance 50,000 tokens per month
- Reset trigger is optional (can be handled in application code)
- TypeScript type update is optional if Supabase types file exists
- **No tests required** - Supabase schema not in local tests

### Integration Branch Note
- Integration branch `int/schema-foundation` must be created from `develop` before parallel execution begins
- This task has NO conflicts - can merge at any time in Phase 1

### Manual Steps Required
- After PR merge, manually apply SQL via Supabase Dashboard
- Verify columns exist with provided verification query
