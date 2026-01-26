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
| 1. Plan | Plan Agent | ___________ | ___K | ☐ Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | ☐ Pending |
| 3. User Review | (No agent) | N/A | N/A | ☐ Pending |
| 4. Compact | (Context reset) | N/A | N/A | ☐ Pending |
| 5. Implement | Engineer Agent | ___________ | ___K | ☐ Pending |
| 6. PM Update | PM Agent | ___________ | ___K | ☐ Pending |

### Step 1: Plan Output

*Plan Agent writes implementation plan here after Step 1*

```
[Plan to be written here]
```

### Step 2: SR Review Notes

*SR Engineer writes review notes here after Step 2*

```
[SR Review notes to be written here]
```

### Step 3: User Review

- [ ] User reviewed plan
- [ ] User approved plan
- Date: _______________

---

## Implementation Summary

*To be completed by Engineer after Step 5*

### Files Changed
- [ ] List actual files modified

### Approach Taken
- [ ] Describe implementation decisions

### Testing Done
- [ ] List manual tests performed
- [ ] Note any edge cases discovered

### Notes for SR Review
- [ ] Any concerns or areas needing extra review

### Final Metrics

| Metric | Estimated | Actual | Variance |
|--------|-----------|--------|----------|
| Plan tokens | ~5K | ___K | ___% |
| SR Review tokens | ~5K | ___K | ___% |
| Implement tokens | ~25K | ___K | ___% |
| **Total** | ~35K | ___K | ___% |
