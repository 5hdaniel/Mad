# Task TASK-1928: Add `graph_admin_consent` Columns to Organizations

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**
See `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow.

---

## Goal

Add `graph_admin_consent_granted` (BOOLEAN) and `graph_admin_consent_at` (TIMESTAMPTZ) columns to the `organizations` table to track whether the IT admin has granted admin consent for the desktop app's Graph API permissions (Mail.Read, Contacts.Read).

## Non-Goals

- Do NOT create the consent page UI (TASK-1929)
- Do NOT modify any existing routes or callbacks
- Do NOT add RLS policies beyond what is inherited from the existing `organizations` table policies
- Do NOT add any application code changes

## Deliverables

1. New Supabase migration: add `graph_admin_consent_granted` and `graph_admin_consent_at` columns

## Acceptance Criteria

- [ ] `graph_admin_consent_granted BOOLEAN DEFAULT FALSE` column exists on `organizations`
- [ ] `graph_admin_consent_at TIMESTAMPTZ` column exists on `organizations`
- [ ] Existing organizations have `graph_admin_consent_granted = false` (default)
- [ ] Migration applies cleanly without data loss
- [ ] Existing RLS policies on `organizations` cover the new columns (they should, since RLS is row-level)
- [ ] All CI checks pass

## Implementation Notes

### Migration SQL

```sql
-- Add Graph API admin consent tracking to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS graph_admin_consent_granted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS graph_admin_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.graph_admin_consent_granted IS
  'Whether IT admin has granted org-wide admin consent for desktop app Graph API permissions (Mail.Read, Contacts.Read)';

COMMENT ON COLUMN public.organizations.graph_admin_consent_at IS
  'Timestamp when admin consent was granted via Microsoft admin consent URL';
```

### Important Details

- Use `IF NOT EXISTS` for safety (idempotent)
- No index needed on these columns (they are read infrequently, per-org)
- Existing RLS policies on `organizations` are row-level, so they automatically cover new columns

## Integration Notes

- **Used by:** TASK-1929 (consent callback will update these columns)
- **Used by:** TASK-1930 (setup callback will check these columns)
- **No shared files** with other tasks (migration only)

## Do / Don't

### Do:
- Use `IF NOT EXISTS` for column additions
- Add column comments for documentation
- Follow existing migration naming conventions

### Don't:
- Do NOT add application code
- Do NOT modify RLS policies (existing ones are sufficient)
- Do NOT add indexes (not needed for these columns)

## When to Stop and Ask

- If `organizations` table structure has changed unexpectedly
- If migration conflicts with another in-flight migration

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (migration only)

### Coverage
- Coverage impact: None

### Integration / Feature Tests
- Verify via SQL:
  ```sql
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'organizations'
  AND column_name LIKE 'graph_%';
  ```

### CI Requirements
- [ ] Migration applies cleanly

## PR Preparation

- **Title**: `feat(db): add graph_admin_consent columns to organizations`
- **Labels**: `database`
- **Depends on**: None (can run in parallel with TASK-1925)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~5K-8K

**Token Cap:** 32K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 migration | +3K |
| Code volume | ~10 lines SQL | +2K |
| Complexity | Very low | +3K |

**Confidence:** High

**Similar past tasks:** TASK-1804-1807 (schema migrations, actual ~3-5K each)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist
```
Files created:
- [ ] Supabase migration for graph_admin_consent columns

Verification:
- [ ] Migration applies cleanly
- [ ] Columns verified in information_schema
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Merge Information
**PR Number:** #XXX
**Merged To:** project/org-setup-bulletproof

- [ ] PR merge verified
