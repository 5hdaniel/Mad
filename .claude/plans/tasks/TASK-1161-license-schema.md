# Task TASK-1161: License Type Database Schema Support

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

Add database support for license types (Individual, Team, Enterprise) and AI Detection add-on to both Supabase and local SQLite, enabling license-based feature gating.

## Non-Goals

- Do NOT implement UI components (that's TASK-1163)
- Do NOT implement the License Context (that's TASK-1162)
- Do NOT create the upgrade flow UI
- Do NOT modify existing RLS policies (that's TASK-1164)

## Deliverables

1. New file: `supabase/migrations/20260122_license_support.sql`
2. Update: `electron/database/schema.sql`
3. Update: `src/types/database.ts` (or appropriate type file)
4. Update: `electron/database/migrations/` (add migration file)

## Acceptance Criteria

- [ ] Supabase migration adds `license_type` column to `profiles` table
- [ ] Supabase migration adds `ai_detection_enabled` column to `profiles` table
- [ ] Local SQLite schema includes `license_type` column in `users` table
- [ ] Local SQLite schema includes `ai_detection_enabled` column in `users` table
- [ ] Local SQLite schema includes `organization_id` column in `users` table
- [ ] TypeScript types updated with new license fields
- [ ] Migration preserves existing data (defaults to 'individual', ai_detection=false)
- [ ] `npm run type-check` passes
- [ ] All CI checks pass

## Implementation Notes

### Schema Changes

**Supabase `profiles` table (new columns):**
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'individual'
    CHECK (license_type IN ('individual', 'team', 'enterprise')),
  ADD COLUMN IF NOT EXISTS ai_detection_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS team_upgraded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS team_upgraded_from_profile_id UUID;

-- Add index for license queries
CREATE INDEX IF NOT EXISTS idx_profiles_license_type ON profiles(license_type);
```

**Local SQLite `users` table (new columns):**
```sql
ALTER TABLE users ADD COLUMN license_type TEXT DEFAULT 'individual'
  CHECK (license_type IN ('individual', 'team', 'enterprise'));
ALTER TABLE users ADD COLUMN ai_detection_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN organization_id TEXT;
```

### TypeScript Types

Add to the appropriate type file (likely `src/types/database.ts` or create `src/types/license.ts`):

```typescript
export type LicenseType = 'individual' | 'team' | 'enterprise';

export interface UserLicense {
  licenseType: LicenseType;
  aiDetectionEnabled: boolean;
  organizationId: string | null;
  teamUpgradedAt: Date | null;
}

// Extend existing User type
export interface User {
  // ... existing fields
  licenseType: LicenseType;
  aiDetectionEnabled: boolean;
  organizationId: string | null;
}
```

### Important Details

- The existing `subscription_tier` field in profiles is for B2C standalone usage
- `license_type` is separate and controls feature access
- `ai_detection_enabled` is an add-on that can apply to any license type
- Migration must be backward-compatible (all existing users default to 'individual')

## Integration Notes

- Imports from: `electron/database/schema.sql`
- Exports to: Used by TASK-1162 (License Context Provider)
- Used by: TASK-1162, TASK-1163, TASK-1164
- Depends on: None (this is the foundation)

## Do / Don't

### Do:

- Use `IF NOT EXISTS` for all ALTER statements
- Set sensible defaults for all new columns
- Add appropriate indexes for querying by license type
- Ensure migration is idempotent (can be run multiple times safely)

### Don't:

- Don't modify any existing columns
- Don't add foreign key constraints to organization_id yet (keeps flexibility)
- Don't create new tables (use existing profiles/users)
- Don't touch RLS policies (that's a separate task)

## When to Stop and Ask

- If you're unsure about the relationship between `subscription_tier` and `license_type`
- If existing migration files have conflicting patterns
- If the TypeScript types structure is significantly different than expected
- If there are existing license-related fields you need to consider

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (schema changes don't have unit tests)
- But verify:
  - Migration syntax is correct
  - TypeScript types compile

### Coverage

- Coverage impact: Not applicable (schema/types only)

### Integration / Feature Tests

- Required scenarios:
  - Fresh database creation includes new columns
  - Migration runs without error on existing database

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (existing tests should not break)
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(schema): add license type and ai detection columns`
- **Labels**: `schema`, `feature`, `sprint-051`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~15K-25K

**Token Cap:** 80K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new migration file | +5K |
| Files to modify | 2-3 files (schema, types) | +10K |
| Code volume | ~100 lines total | +5K |
| Test complexity | Low (schema only) | +5K |

**Confidence:** High

**Risk factors:**
- Existing schema structure may require additional research
- Migration compatibility with existing data

**Similar past tasks:** TASK-905 (dedup schema migration, actual: ~10K tokens)

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
- [ ] supabase/migrations/20260122_license_support.sql
- [ ] electron/database/migrations/XXX_add_license_columns.sql

Files modified:
- [ ] electron/database/schema.sql
- [ ] src/types/database.ts (or appropriate type file)

Features implemented:
- [ ] Supabase license_type column
- [ ] Supabase ai_detection_enabled column
- [ ] SQLite license_type column
- [ ] SQLite ai_detection_enabled column
- [ ] SQLite organization_id column
- [ ] TypeScript types updated

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

**Variance:** PM Est ~20K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~20K | ~XK | +/-X% |
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
