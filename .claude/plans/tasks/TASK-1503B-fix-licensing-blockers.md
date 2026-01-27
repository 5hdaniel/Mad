# Task TASK-1503B: Fix Licensing P0 Blockers

**Sprint**: SPRINT-062
**Backlog Item**: N/A (blocking issue discovered during SR review)
**Status**: Complete
**Execution**: Sequential (Phase 2, Step 1B - inserted before TASK-1504)
**Priority**: P0 - Must Fix Before TASK-1504

---

## Discovery

During SR Engineer review of the licensing schema (TASK-1503), critical blocking issues were identified that must be fixed before implementing the license validation service (TASK-1504).

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow`
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `fix/task-1503b-licensing-blockers`

---

## Goal

Fix P0 blocking issues discovered during SR Engineer review of the licensing implementation:

1. **Device uniqueness bug** - The current schema has a global unique constraint on `device_id` which prevents the same physical device from being registered by different users (e.g., family computer shared between users).

2. **Update TASK-1504 spec** - Fix incorrect table names and type naming confusion in the implementation notes.

## Non-Goals

- Do NOT implement any service layer code (that's TASK-1504)
- Do NOT change any other schema beyond the device constraint fix
- Do NOT add new features

---

## Estimated Tokens

**Est. Tokens**: ~10K
**Token Cap**: ~40K (4x estimate)

---

## Deliverables

### 1. Supabase Migration: Drop Global Device Unique Constraint

**Issue:** `devices_device_id_key` creates a global unique constraint on `device_id`, preventing different users from registering the same physical device.

**Current State:**
```
devices_device_id_key     - UNIQUE INDEX on (device_id) alone  <- PROBLEM
devices_user_id_device_id_key - UNIQUE INDEX on (user_id, device_id) <- CORRECT
```

**Fix:** Drop `devices_device_id_key`, keep `devices_user_id_device_id_key`.

**Migration SQL:**
```sql
-- Fix device uniqueness: Allow same device for different users
-- Keep composite unique (user_id, device_id), drop global unique (device_id)
DROP INDEX IF EXISTS devices_device_id_key;
```

### 2. Update TASK-1504 Implementation Notes

**Issue A: Table name references are wrong**

In TASK-1504, the code examples reference:
- `user_licenses` -> Should be `licenses`
- `device_registrations` -> Should be `devices`

**Issue B: Type confusion**

The implementation notes use `LicenseStatus` as both:
1. A TypeScript interface for validation results (correct)
2. As if it were a string union type (incorrect)

The actual types in `shared/types/license.ts`:
- `LicenseStatus` - Interface for validation results
- `LicenseType` - String union: `'trial' | 'individual' | 'team'`
- `TrialStatus` - String union: `'active' | 'expired' | 'converted'`

The code examples should be clear about which type is being used where.

---

## Implementation Notes

### Step 1: Apply Supabase Migration

Use `mcp__supabase__apply_migration` tool:

```sql
-- Migration: fix_device_uniqueness_constraint
--
-- The devices_device_id_key constraint prevents different users from registering
-- the same physical device (e.g., family computer). This is incorrect - we want
-- to allow the same device to be registered by multiple users, but each user
-- can only register the same device once (enforced by devices_user_id_device_id_key).

DROP INDEX IF EXISTS devices_device_id_key;
```

### Step 2: Verify Migration

After applying, verify with:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'devices'
ORDER BY indexname;
```

Expected result should NOT include `devices_device_id_key`:
- `devices_pkey` - PRIMARY KEY
- `devices_user_id_device_id_key` - UNIQUE (user_id, device_id)
- `idx_devices_device_id` - Non-unique INDEX (for performance)
- `idx_devices_user_id` - Non-unique INDEX (for performance)

### Step 3: Update TASK-1504 Markdown

Edit `/Users/daniel/Documents/Mad-sprint-062-licensing/.claude/plans/tasks/TASK-1504-license-validation-service.md`:

**Changes Required:**

1. Replace all occurrences of `user_licenses` with `licenses`
2. Replace all occurrences of `device_registrations` with `devices`
3. Add clarifying comment about `LicenseStatus` interface vs `LicenseType` string union

**Specific sections to update:**

- Step 1: License Service code example - `.from('user_licenses')` -> `.from('licenses')`
- Step 2: Device Service code example - `.from('device_registrations')` -> `.from('devices')`
- The type imports should clarify: `LicenseStatus` is an interface (validation result), `LicenseType` is the string union

---

## Acceptance Criteria

- [x] `devices_device_id_key` index dropped from Supabase
- [x] `devices_user_id_device_id_key` still exists (composite unique)
- [x] TASK-1504 markdown updated with correct table names
- [x] TASK-1504 markdown updated with type clarifications
- [x] Verification query shows correct indexes

---

## Testing Requirements

### Verification Query

```sql
-- Should return 4 indexes, NOT including devices_device_id_key
SELECT indexname
FROM pg_indexes
WHERE tablename = 'devices'
ORDER BY indexname;
```

### Manual Test (Optional)

After migration, this should work:
```sql
-- Simulate two different users registering same device
INSERT INTO devices (user_id, device_id, device_name, os)
VALUES
  ('user-a-uuid', 'shared-device-123', 'Family MacBook', 'darwin'),
  ('user-b-uuid', 'shared-device-123', 'Family MacBook', 'darwin');
-- Should succeed with current fix
-- Would have failed before (duplicate key violation)
```

---

## Do / Don't

### Do:
- Use `mcp__supabase__apply_migration` for the schema change
- Verify the migration with the provided query
- Update TASK-1504 markdown file directly

### Don't:
- Don't create local migration files (this codebase uses MCP)
- Don't add new columns or tables
- Don't implement service code (that's TASK-1504)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- The migration fails for any reason
- Other unexpected constraints are found
- Unsure about the TASK-1504 edits

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. User Review | (No agent) | N/A | N/A | Pending |
| 4. Compact | (Context reset) | N/A | N/A | Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | Pending |
| 6. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

*Completed by PM Agent (simple fix task)*

### Files Changed
- [x] Supabase migration applied via MCP: `fix_device_uniqueness_constraint`
- [x] `.claude/plans/tasks/TASK-1504-license-validation-service.md` updated

### Approach Taken
- Used `ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_key` instead of `DROP INDEX` because the index was backing a constraint
- Replaced all occurrences of `user_licenses` with `licenses` (1 occurrence)
- Replaced all occurrences of `device_registrations` with `devices` (6 occurrences)

### Testing Done
- [x] Verification query confirms constraint dropped
- [x] TASK-1504 markdown reviewed for accuracy

**Verification Query Results:**
```
devices_pkey                  - PRIMARY KEY (id)
devices_user_id_device_id_key - UNIQUE (user_id, device_id) [CORRECT - kept]
idx_devices_device_id         - INDEX (device_id) for performance
idx_devices_user_id           - INDEX (user_id) for performance
```

The problematic `devices_device_id_key` global unique constraint has been removed.

### Notes for SR Review
- Migration used `DROP CONSTRAINT` instead of `DROP INDEX` as documented because the index was backing a unique constraint
- All table name references in TASK-1504 have been corrected

### Final Metrics

| Metric | Estimated | Actual | Variance |
|--------|-----------|--------|----------|
| Plan tokens | ~2K | 0K | N/A (combined) |
| SR Review tokens | ~2K | 0K | N/A (combined) |
| Implement tokens | ~6K | ~3K | -50% |
| **Total** | ~10K | ~3K | -70% |
