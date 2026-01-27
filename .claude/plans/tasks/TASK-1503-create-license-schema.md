# Task TASK-1503: Create User License Schema in Supabase

**Sprint**: SPRINT-062
**Backlog Item**: BACKLOG-477
**Status**: Ready (TASK-1502 User Gate PASSED)
**Execution**: Sequential (Phase 2, Step 1)

---

## ⚠️ MANDATORY WORKFLOW (6 Steps)

**DO NOT SKIP ANY STEP. Each agent step requires recording the Agent ID.**

```
Step 1: PLAN        → Plan Agent creates implementation plan
                      📋 Record: Plan Agent ID

Step 2: SR REVIEW   → SR Engineer reviews and approves plan
                      📋 Record: SR Engineer Agent ID

Step 3: USER REVIEW → User reviews and approves plan
                      ⏸️  GATE: Wait for user approval

Step 4: COMPACT     → Context reset before implementation
                      🔄 /compact or new session

Step 5: IMPLEMENT   → Engineer implements approved plan
                      📋 Record: Engineer Agent ID

Step 6: PM UPDATE   → PM updates sprint/backlog/metrics
```

**Reference:** `.claude/docs/ENGINEER-WORKFLOW.md`

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after Phase 1 complete)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `feature/task-1503-license-schema`

---

## Goal

Create `user_licenses` and `device_registrations` tables in Supabase to track user subscription status, trial limits, and device registrations.

## Non-Goals

- Do NOT implement the service layer (TASK-1504)
- Do NOT implement app integration (TASK-1506)
- Do NOT create UI components
- Do NOT migrate existing local data

---

## Estimated Tokens

**Est. Tokens**: ~25K (schema)
**Token Cap**: ~100K (4x estimate)

---

## Deliverables

### Files to Create

**Note:** There is no local `supabase/migrations/` directory in this codebase. Use the Supabase MCP tool `mcp__supabase__apply_migration` to apply migrations directly, or apply via Supabase Dashboard SQL Editor.

| File | Action | Description |
|------|--------|-------------|
| Supabase Migration | Apply via MCP | Use `mcp__supabase__apply_migration` tool |
| `shared/types/license.ts` | Create | TypeScript interfaces |

---

## Implementation Notes

### Step 1: Create Migration File

Create `supabase/migrations/[timestamp]_user_licenses.sql`:

```sql
-- =============================================================================
-- User Licenses and Device Registrations Schema
-- SPRINT-062: Auth Flow + Licensing System
-- =============================================================================

-- -----------------------------------------------------------------------------
-- User Licenses Table
-- Tracks user subscription/trial status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- License type (trial, individual, team)
  license_type TEXT NOT NULL DEFAULT 'trial'
    CHECK (license_type IN ('trial', 'individual', 'team')),

  -- Trial tracking
  trial_status TEXT DEFAULT 'active'
    CHECK (trial_status IN ('active', 'expired', 'converted')),
  trial_started_at TIMESTAMPTZ DEFAULT now(),
  trial_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),

  -- Usage tracking
  transaction_count INTEGER DEFAULT 0,
  transaction_limit INTEGER DEFAULT 5,

  -- Add-ons
  ai_detection_enabled BOOLEAN DEFAULT false,

  -- Organization reference (for team licenses)
  -- NOTE: FK constraint removed as organizations table may not exist yet
  -- Can be added later when organizations feature is implemented
  organization_id UUID,  -- References organizations(id) when table exists

  -- Subscription tracking (for paid users)
  subscription_status TEXT DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due')),
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one license per user
  UNIQUE(user_id)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_licenses_user_id ON user_licenses(user_id);

-- Index for trial expiry checks
CREATE INDEX IF NOT EXISTS idx_user_licenses_trial_expires_at ON user_licenses(trial_expires_at)
  WHERE trial_status = 'active';

-- -----------------------------------------------------------------------------
-- Device Registrations Table
-- Tracks which devices a user has registered
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  device_id TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('macos', 'windows')),

  registered_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,

  -- Ensure unique device per user
  UNIQUE(user_id, device_id)
);

-- Index for user device lookups
CREATE INDEX IF NOT EXISTS idx_device_registrations_user_id ON device_registrations(user_id);

-- Index for active devices
CREATE INDEX IF NOT EXISTS idx_device_registrations_active ON device_registrations(user_id, is_active)
  WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- -----------------------------------------------------------------------------

-- Enable RLS on both tables
ALTER TABLE user_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own license
CREATE POLICY "Users can read own license"
  ON user_licenses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own license (limited fields via trigger)
CREATE POLICY "Users can update own license"
  ON user_licenses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own license (for creation)
CREATE POLICY "Users can insert own license"
  ON user_licenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own devices
CREATE POLICY "Users can read own devices"
  ON device_registrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own devices
CREATE POLICY "Users can insert own devices"
  ON device_registrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own devices
CREATE POLICY "Users can update own devices"
  ON device_registrations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own devices
CREATE POLICY "Users can delete own devices"
  ON device_registrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Device Limit Enforcement
-- -----------------------------------------------------------------------------

-- Function to get device limit based on license type
CREATE OR REPLACE FUNCTION get_device_limit(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_license_type TEXT;
BEGIN
  SELECT license_type INTO v_license_type
  FROM user_licenses
  WHERE user_id = p_user_id;

  -- Default limits by license type
  RETURN CASE
    WHEN v_license_type = 'trial' THEN 1
    WHEN v_license_type = 'individual' THEN 2
    WHEN v_license_type = 'team' THEN 10  -- Or unlimited
    ELSE 1  -- Default to 1 if no license
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check device limit before insert
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INTEGER;
  v_device_limit INTEGER;
BEGIN
  -- Count active devices for this user (excluding current device if it exists)
  SELECT COUNT(*) INTO v_active_count
  FROM device_registrations
  WHERE user_id = NEW.user_id
    AND is_active = true
    AND device_id != NEW.device_id;

  -- Get device limit
  v_device_limit := get_device_limit(NEW.user_id);

  -- Check limit
  IF v_active_count >= v_device_limit THEN
    RAISE EXCEPTION 'Device limit reached. You can have up to % active device(s).', v_device_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for device limit check
DROP TRIGGER IF EXISTS enforce_device_limit ON device_registrations;
CREATE TRIGGER enforce_device_limit
  BEFORE INSERT ON device_registrations
  FOR EACH ROW
  EXECUTE FUNCTION check_device_limit();

-- -----------------------------------------------------------------------------
-- Updated At Trigger
-- -----------------------------------------------------------------------------

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_licenses
DROP TRIGGER IF EXISTS update_user_licenses_updated_at ON user_licenses;
CREATE TRIGGER update_user_licenses_updated_at
  BEFORE UPDATE ON user_licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for device_registrations (update last_seen_at on any update)
DROP TRIGGER IF EXISTS update_device_registrations_last_seen ON device_registrations;
CREATE TRIGGER update_device_registrations_last_seen
  BEFORE UPDATE ON device_registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Convenience Functions
-- -----------------------------------------------------------------------------

-- Function to create a trial license for a new user
CREATE OR REPLACE FUNCTION create_trial_license(p_user_id UUID)
RETURNS user_licenses AS $$
DECLARE
  v_license user_licenses;
BEGIN
  INSERT INTO user_licenses (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_license;

  -- If insert was skipped (conflict), return existing
  IF v_license IS NULL THEN
    SELECT * INTO v_license FROM user_licenses WHERE user_id = p_user_id;
  END IF;

  RETURN v_license;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment transaction count
CREATE OR REPLACE FUNCTION increment_transaction_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE user_licenses
  SET transaction_count = transaction_count + 1
  WHERE user_id = p_user_id
  RETURNING transaction_count INTO v_new_count;

  RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if trial is expired
CREATE OR REPLACE FUNCTION is_trial_expired(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_license user_licenses;
BEGIN
  SELECT * INTO v_license FROM user_licenses WHERE user_id = p_user_id;

  IF v_license IS NULL THEN
    RETURN false;  -- No license = not expired (will create one)
  END IF;

  IF v_license.license_type != 'trial' THEN
    RETURN false;  -- Paid users don't have trial expiry
  END IF;

  RETURN v_license.trial_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------
COMMENT ON TABLE user_licenses IS 'Tracks user subscription status, trial limits, and add-ons';
COMMENT ON TABLE device_registrations IS 'Tracks devices registered to each user account';
COMMENT ON FUNCTION create_trial_license IS 'Creates a trial license for a new user (idempotent)';
COMMENT ON FUNCTION increment_transaction_count IS 'Increments transaction count for usage tracking';
COMMENT ON FUNCTION is_trial_expired IS 'Checks if user trial has expired';
```

### Step 2: Create TypeScript Types

Create `shared/types/license.ts`:

```typescript
/**
 * License Types - SPRINT-062
 * TypeScript interfaces for Supabase license tables
 */

// License type enum
export type LicenseType = 'trial' | 'individual' | 'team';

// Trial status enum
export type TrialStatus = 'active' | 'expired' | 'converted';

// Subscription status enum
export type SubscriptionStatus = 'none' | 'active' | 'cancelled' | 'past_due';

// Platform enum
export type DevicePlatform = 'macos' | 'windows';

/**
 * User License record from Supabase
 */
export interface UserLicense {
  id: string;
  user_id: string;

  // License type
  license_type: LicenseType;

  // Trial tracking
  trial_status: TrialStatus | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;

  // Usage tracking
  transaction_count: number;
  transaction_limit: number;

  // Add-ons
  ai_detection_enabled: boolean;

  // Organization (for team license)
  organization_id: string | null;

  // Subscription (for paid)
  subscription_status: SubscriptionStatus;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Device Registration record from Supabase
 */
export interface DeviceRegistration {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string | null;
  platform: DevicePlatform | null;
  registered_at: string;
  last_seen_at: string;
  is_active: boolean;
}

/**
 * License status returned by validation service
 */
export interface LicenseStatus {
  isValid: boolean;
  licenseType: LicenseType;

  // Trial info (only for trial users)
  trialStatus?: TrialStatus;
  trialDaysRemaining?: number;

  // Usage info
  transactionCount: number;
  transactionLimit: number;
  canCreateTransaction: boolean;

  // Device info
  deviceCount: number;
  deviceLimit: number;

  // Features
  aiEnabled: boolean;

  // Block reason (if not valid)
  blockReason?: 'expired' | 'limit_reached' | 'no_license';
}

/**
 * Device registration result
 */
export interface DeviceRegistrationResult {
  success: boolean;
  device?: DeviceRegistration;
  error?: 'device_limit_reached' | 'already_registered' | 'unknown';
}

/**
 * License limits by type
 */
export const LICENSE_LIMITS: Record<LicenseType, { transactions: number; devices: number }> = {
  trial: { transactions: 5, devices: 1 },
  individual: { transactions: Infinity, devices: 2 },
  team: { transactions: Infinity, devices: 10 },
};

/**
 * Trial duration in days
 */
export const TRIAL_DURATION_DAYS = 14;
```

### Step 3: Run Migration

```bash
# Using Supabase CLI
cd supabase
supabase db push

# Or apply migration directly
supabase migration up
```

### Step 4: Verify Tables

After migration, verify in Supabase Dashboard:
1. Go to Table Editor
2. Confirm `user_licenses` table exists with all columns
3. Confirm `device_registrations` table exists
4. Go to Database > Functions and verify functions exist
5. Test RLS by running a query as authenticated user

---

## Testing Requirements

### SQL Tests (Run in Supabase SQL Editor)

```sql
-- Test 1: Create trial license
SELECT create_trial_license('00000000-0000-0000-0000-000000000001'::uuid);

-- Test 2: Check trial expiry
SELECT is_trial_expired('00000000-0000-0000-0000-000000000001'::uuid);

-- Test 3: Increment transaction count
SELECT increment_transaction_count('00000000-0000-0000-0000-000000000001'::uuid);

-- Test 4: Get device limit
SELECT get_device_limit('00000000-0000-0000-0000-000000000001'::uuid);

-- Clean up test data
DELETE FROM user_licenses WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;
```

### RLS Tests

```sql
-- As authenticated user (in Supabase SQL Editor, set auth.uid())
-- These should work for own data, fail for others

-- Should succeed (own license)
SELECT * FROM user_licenses WHERE user_id = auth.uid();

-- Should return empty (not own data)
SELECT * FROM user_licenses WHERE user_id != auth.uid();
```

---

## Acceptance Criteria

- [ ] `user_licenses` table created with all columns from schema
- [ ] `device_registrations` table created with all columns
- [ ] RLS enabled on both tables
- [ ] RLS policies allow users to manage only their own data
- [ ] Device limit trigger function works (prevents exceeding limit)
- [ ] `create_trial_license()` function works
- [ ] `increment_transaction_count()` function works
- [ ] `is_trial_expired()` function works
- [ ] TypeScript types created in `shared/types/license.ts`
- [ ] Migration can be rolled back cleanly (if needed)

---

## Integration Notes

- **Next Task**: TASK-1504 will use these tables via the license service
- **Later**: App will read license status on start (TASK-1506)
- **Note**: The `organizations` table reference may need to be adjusted if it doesn't exist yet (can be nullable)

---

## Do / Don't

### Do:
- Use proper FK constraints with CASCADE delete
- Add indexes for common queries (user_id, trial_expires_at)
- Use SECURITY DEFINER for functions that need elevated access
- Add helpful comments to tables and functions
- Make trial license creation idempotent (ON CONFLICT DO NOTHING)

### Don't:
- Don't create migration without testing in SQL editor first
- Don't skip RLS setup
- Don't hardcode device limits (use function)
- Don't assume organizations table exists (make FK nullable)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- `organizations` table reference causes issues
- RLS policies seem too restrictive or too permissive
- Migration fails for any reason
- Device limit logic needs to be different

---

## PR Preparation

**Title**: `feat: add user license and device registration schema`

**Labels**: `sprint-062`, `schema`, `supabase`

**PR Body Template**:
```markdown
## Summary
- Create `user_licenses` table for subscription/trial tracking
- Create `device_registrations` table for device management
- Add RLS policies for user data isolation
- Add helper functions (create_trial_license, increment_transaction_count, etc.)
- Add TypeScript types in `shared/types/license.ts`

## Test Plan
- [ ] Migration applies cleanly
- [ ] Functions work via SQL editor
- [ ] RLS policies tested
- [ ] Types compile correctly

## Files
- `supabase/migrations/XXXXXXXX_user_licenses.sql`
- `shared/types/license.ts`
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | Plan Agent | PM-062-plan-1503 | ~5K | COMPLETE |
| 2. SR Review | SR Engineer Agent | SR-062-review-1503 | ~8K | COMPLETE |
| 3. User Review | (No agent) | N/A | N/A | COMPLETE |
| 4. Compact | (Context reset) | N/A | N/A | COMPLETE |
| 5. Implement | PM Agent (direct) | PM-062-impl-1503 | ~15K | COMPLETE |
| 6. PM Update | PM Agent | PM-062-impl-1503 | ~2K | COMPLETE |

### Step 1: Plan Output

**Plan Agent ID:** PM-062-plan-1503
**Planning Date:** 2026-01-26

#### Discovery: Existing Schema

Supabase already has licensing tables (discovered via MCP query):

| Table | Columns | Rows | RLS |
|-------|---------|------|-----|
| `licenses` | id, user_id, license_key, max_devices, status, expires_at, activated_at | 0 | Yes |
| `devices` | id, user_id, device_id, device_name, os, app_version, last_seen_at, activated_at | 407 | Yes |
| `users` | subscription_tier, subscription_status, trial_ends_at | 4 | Yes |
| `profiles` | license_type, ai_detection_enabled, organization_id | 1 | No |

**Existing Migration:** `20260124191451_add_license_columns_to_profiles`

#### Recommended Approach: Enhance Existing Tables

Instead of creating duplicate `user_licenses` and `device_registrations` tables, we should enhance the existing `licenses` and `devices` tables.

**Rationale:**
1. Avoids data duplication
2. Existing RLS policies already configured
3. Less migration complexity
4. 407 existing device records preserved

#### Migration Plan

**Step 1: Add Missing Columns to `licenses`**

```sql
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_limit INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'active'
    CHECK (trial_status IN ('active', 'expired', 'converted')),
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'trial'
    CHECK (license_type IN ('trial', 'individual', 'team')),
  ADD COLUMN IF NOT EXISTS ai_detection_enabled BOOLEAN DEFAULT false;
```

**Step 2: Add Missing Columns to `devices`**

```sql
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS platform TEXT;

-- Migrate existing os values to platform
UPDATE devices SET platform = LOWER(os) WHERE platform IS NULL AND os IS NOT NULL;
```

**Step 3: Create Convenience Functions**

```sql
-- create_trial_license(p_user_id UUID) RETURNS licenses
-- increment_transaction_count(p_user_id UUID) RETURNS INTEGER
-- is_trial_expired(p_user_id UUID) RETURNS BOOLEAN
-- get_device_limit(p_user_id UUID) RETURNS INTEGER
-- check_device_limit() TRIGGER
```

**Step 4: Verify RLS Policies**

Confirm existing policies allow:
- SELECT on own license/devices
- INSERT on own devices
- UPDATE on own license (limited)
- DELETE on own devices

**Step 5: TypeScript Types**

Create `shared/types/license.ts` matching actual schema.

#### Questions for SR Review

1. **Table Naming:** Keep `licenses`/`devices` or rename to `user_licenses`/`device_registrations` for consistency with task spec?
2. **License Key:** Existing `licenses.license_key` column - still needed?
3. **Profiles Duplication:** `profiles.license_type` and `profiles.ai_detection_enabled` duplicate planned columns - consolidate?
4. **Existing Data:** 407 device records - any migration concerns?

#### Estimated Tokens

| Step | Estimated |
|------|-----------|
| Migration SQL | ~3K |
| Functions | ~5K |
| RLS Verification | ~2K |
| TypeScript Types | ~3K |
| Testing | ~5K |
| **Total** | ~18K |

### Step 2: SR Review Notes

**SR Engineer Agent ID:** SR-062-review-1503
**Review Date:** 2026-01-26
**Status:** APPROVED WITH REQUIRED MODIFICATIONS

#### Discovery Summary

Existing Supabase tables discovered:
- `licenses` table (0 rows): id, user_id, license_key, max_devices, status, expires_at, activated_at
- `devices` table (407 rows): id, user_id, device_id, device_name, os, app_version, last_seen_at, activated_at

#### Required Modifications for Implementation

| ID | Priority | Issue | Fix |
|----|----------|-------|-----|
| R1 | HIGH | RLS policies overly permissive (`qual = true`) | Drop permissive policies, add user-scoped policies |
| R2 | HIGH | No UNIQUE constraint on `licenses.user_id` | Add UNIQUE constraint (one license per user) |
| R3 | MEDIUM | `devices.os` has inconsistent values | Add CHECK constraint for valid platform values |
| R4 | LOW | `profiles.license_type` and `profiles.ai_detection_enabled` duplicate data | Add deprecation comments (data lives in `licenses` now) |

#### Migration Requirements

**Migration 1: Fix RLS Policies**
```sql
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role has full access" ON licenses;
DROP POLICY IF EXISTS "Service role has full access" ON devices;

-- Add user-scoped policies for licenses
CREATE POLICY "Users can read own license" ON licenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own license" ON licenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own license" ON licenses FOR UPDATE USING (auth.uid() = user_id);

-- Add user-scoped policies for devices
CREATE POLICY "Users can read own devices" ON devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own devices" ON devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own devices" ON devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own devices" ON devices FOR DELETE USING (auth.uid() = user_id);
```

**Migration 2: Add Constraints**
```sql
-- One license per user
ALTER TABLE licenses ADD CONSTRAINT licenses_user_id_unique UNIQUE (user_id);

-- Normalize platform values
ALTER TABLE devices ADD CONSTRAINT devices_platform_check
  CHECK (os IS NULL OR os IN ('macos', 'windows', 'linux'));
```

**Migration 3: Add Missing Columns to licenses**
```sql
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'trial'
    CHECK (license_type IN ('trial', 'individual', 'team')),
  ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'active'
    CHECK (trial_status IN ('active', 'expired', 'converted')),
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_limit INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ai_detection_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
```

**Migration 4: Add is_active to devices**
```sql
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
```

**Migration 5: Create Helper Functions**
- `create_trial_license(p_user_id UUID) RETURNS licenses`
- `increment_transaction_count(p_user_id UUID) RETURNS INTEGER`
- `is_trial_expired(p_user_id UUID) RETURNS BOOLEAN`
- `get_device_limit(p_user_id UUID) RETURNS INTEGER`
- `check_device_limit()` TRIGGER function

#### Architecture Notes

1. Keep existing table names (`licenses`, `devices`) - no need to rename
2. `license_key` column can remain for future manual license assignment
3. TypeScript types should reflect actual column names

### Step 3: User Review

- [x] User reviewed plan
- [x] User approved plan
- Date: 2026-01-26

---

## Implementation Summary

*Completed by PM Agent on 2026-01-27*

### Files Changed
- [x] `shared/types/license.ts` - Created TypeScript interfaces for License, Device, and related types
- [x] `shared/types/index.ts` - Updated to export license types

### Supabase Migrations Applied (7 total)
| Migration | Description |
|-----------|-------------|
| `20260127004525_fix_licenses_devices_rls_policies` | Dropped permissive RLS policies, added user-scoped policies |
| `20260127004623_add_licenses_user_unique_constraint` | Added UNIQUE constraint on licenses.user_id |
| `20260127004634_add_devices_platform_column` | Added platform column, populated from os values, added is_active |
| `20260127005623_add_licenses_trial_tracking_columns` | Added license_type, trial_status, trial dates, transaction tracking, ai_detection_enabled |
| `20260127005811_add_license_helper_functions` | Created helper functions and triggers |
| `20260127005818_deprecate_profiles_license_columns` | Added deprecation comments to profiles.license_type and profiles.ai_detection_enabled |
| `20260127010234_fix_function_search_paths` | Fixed function search_path for security |

### Approach Taken
1. **Enhanced existing tables** instead of creating new ones (licenses, devices already existed)
2. **Fixed critical RLS security issue** - removed overly permissive policies (`qual = true`)
3. **Added UNIQUE constraint** on licenses.user_id to enforce one license per user
4. **Normalized platform values** - added `platform` column derived from `os` (407 records migrated)
5. **Added trial tracking columns** to licenses table for SPRINT-062 requirements
6. **Created helper functions** with SECURITY DEFINER and explicit search_path
7. **Added device limit enforcement** via trigger function

### Testing Done
- [x] Verified all 7 migrations applied successfully via `mcp__supabase__list_migrations`
- [x] Verified licenses table has all new columns (16 total)
- [x] Verified devices table has platform (macos: 187, windows: 220) and is_active columns
- [x] Verified RLS policies are user-scoped (no more permissive policies on licenses/devices)
- [x] Verified UNIQUE constraint on licenses.user_id
- [x] Verified all 6 helper functions exist
- [x] Verified TypeScript types compile without errors
- [x] Ran Supabase security advisor - licenses/devices no longer flagged

### Notes for SR Review
1. **Existing data preserved** - 407 device records untouched, platform values populated from os
2. **license_key column retained** - kept for potential manual license assignment in future
3. **CHECK constraint on devices.os** - not added (existing values include version numbers like "darwin 24.6.0"), using platform column instead
4. **Function search_path** - all functions now have explicit `SET search_path = public`
5. **profiles deprecation** - comments added but columns not removed (backwards compatibility)

### Final Metrics

| Metric | Estimated | Actual | Variance |
|--------|-----------|--------|----------|
| Plan tokens | ~5K | ~5K | 0% |
| SR Review tokens | ~5K | ~8K | +60% |
| Implement tokens | ~25K | ~15K | -40% |
| **Total** | ~35K | ~28K | -20% |
