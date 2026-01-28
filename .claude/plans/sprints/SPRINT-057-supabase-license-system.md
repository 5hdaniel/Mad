# Sprint Plan: SPRINT-057 - Supabase License System

**Created**: 2026-01-24
**Updated**: 2026-01-24
**Status**: Blocked (Waiting for SPRINT-056)
**Goal**: Move user/license management to Supabase with trial limits and license validation
**Track**: Consumer Launch (2 of 4)
**Dependencies**: SPRINT-056 (release infrastructure must be working)

---

## Sprint Goal

This sprint moves the licensing system from local SQLite to Supabase as the source of truth:

1. **User Management in Supabase** - Store user profiles, license status, and device registrations
2. **Trial System** - Track transaction count and device limits for free trial
3. **License Validation** - Check license status on app start and block expired licenses
4. **Future-Proof for Teams** - Schema supports individual → team conversion

This enables:
- Blocking users with expired licenses
- Tracking usage for trial limits
- Device management (limit to 1 device for trial)
- Smooth upgrade path to paid/team licenses

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] Verify SPRINT-056 is complete (signed releases work)
- [ ] `git checkout develop && git pull origin develop`
- [ ] `npm install && npm rebuild better-sqlite3-multiple-ciphers && npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Access to Supabase dashboard

---

## License Model Design

### User Tiers

| Tier | Transaction Limit | Device Limit | Features |
|------|-------------------|--------------|----------|
| **Trial** | 5 transactions | 1 device | Core features, no AI |
| **Individual** | Unlimited | 2 devices | All features, export |
| **Team** | Unlimited | Unlimited | Submit for review, broker workflow |

### Trial Flow

```
1. User signs up → trial_status: 'active', trial_started_at: now()
2. User creates transactions → transaction_count increments
3. If transaction_count >= 5 → show upgrade prompt
4. If trial_days_elapsed >= 14 → trial_status: 'expired'
5. Expired trial → blocked at login, shown upgrade screen
```

---

## In Scope (5 Items)

### Phase 1: Supabase Schema (Sequential)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-477 | User License Schema in Supabase | ~25K | P0 | TASK-1186 |

### Phase 2: License Service Layer (Sequential - After Phase 1)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-478 | License Validation Service | ~30K | P0 | TASK-1187 |
| BACKLOG-479 | Device Registration Service | ~20K | P1 | TASK-1188 |

### Phase 3: App Integration (Sequential - After Phase 2)
| ID | Title | Est. Tokens | Priority | Task File |
|----|-------|-------------|----------|-----------|
| BACKLOG-480 | License Check at App Start | ~15K | P0 | TASK-1189 |
| BACKLOG-481 | Trial Limit Enforcement UI | ~10K | P1 | TASK-1190 |

---

## Phase Plan

### Phase 1: Supabase Schema

**Goal**: Create user_licenses and device_registrations tables

**Schema Design**:

```sql
-- User license and subscription info
CREATE TABLE user_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- License type
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

  -- Organization (for team license)
  organization_id UUID REFERENCES organizations(id),

  -- Subscription (for paid)
  subscription_status TEXT DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due')),
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- Device registrations
CREATE TABLE device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  device_id TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('macos', 'windows')),

  registered_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,

  UNIQUE(user_id, device_id)
);

-- RLS Policies
ALTER TABLE user_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own license
CREATE POLICY "users_own_license" ON user_licenses
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage their own devices
CREATE POLICY "users_own_devices" ON device_registrations
  FOR ALL USING (auth.uid() = user_id);

-- Function to check device limit
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
DECLARE
  device_count INTEGER;
  device_limit INTEGER;
BEGIN
  -- Count active devices for user
  SELECT COUNT(*) INTO device_count
  FROM device_registrations
  WHERE user_id = NEW.user_id AND is_active = true;

  -- Get user's device limit based on license
  SELECT CASE
    WHEN license_type = 'trial' THEN 1
    WHEN license_type = 'individual' THEN 2
    ELSE 999
  END INTO device_limit
  FROM user_licenses
  WHERE user_id = NEW.user_id;

  IF device_count >= COALESCE(device_limit, 1) THEN
    RAISE EXCEPTION 'Device limit reached';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_device_limit
  BEFORE INSERT ON device_registrations
  FOR EACH ROW EXECUTE FUNCTION check_device_limit();
```

**Files to Create/Modify**:
- `supabase/migrations/XXXXXXXX_user_licenses.sql`
- `shared/types/license.ts`

**Integration checkpoint**: Tables created with RLS policies, types generated.

---

### Phase 2: License Service Layer

**Goal**: Create services for license validation and device management

**License Validation Service**:

```typescript
// electron/services/licenseService.ts
export interface LicenseStatus {
  isValid: boolean;
  licenseType: 'trial' | 'individual' | 'team';
  trialStatus?: 'active' | 'expired' | 'converted';
  trialDaysRemaining?: number;
  transactionCount: number;
  transactionLimit: number;
  canCreateTransaction: boolean;
  deviceCount: number;
  deviceLimit: number;
  aiEnabled: boolean;
  blockReason?: 'expired' | 'limit_reached' | 'no_license';
}

export async function validateLicense(userId: string): Promise<LicenseStatus> {
  // 1. Fetch user_licenses from Supabase
  // 2. Check trial expiry
  // 3. Check transaction limits
  // 4. Return status with block reason if applicable
}

export async function incrementTransactionCount(userId: string): Promise<void> {
  // Increment transaction_count in Supabase
}

export async function createUserLicense(userId: string): Promise<void> {
  // Create default trial license for new user
}
```

**Device Registration Service**:

```typescript
// electron/services/deviceService.ts
export async function registerDevice(userId: string): Promise<{
  success: boolean;
  error?: 'device_limit_reached' | 'already_registered';
}> {
  // 1. Generate/get device ID
  // 2. Check if already registered
  // 3. Try to register (trigger checks limit)
  // 4. Return result
}

export async function getDeviceId(): Promise<string> {
  // Use machine-id or similar
}

export async function deactivateDevice(userId: string, deviceId: string): Promise<void> {
  // Mark device as inactive
}
```

**Files to Create**:
- `electron/services/licenseService.ts`
- `electron/services/deviceService.ts`
- `electron/license-handlers.ts` (update existing)

**Integration checkpoint**: Services work, can validate license and register device.

---

### Phase 3: App Integration

**Goal**: Check license on app start, enforce limits in UI

**App Start Flow**:

```typescript
// In main.ts or initialization
async function initializeLicense(userId: string): Promise<void> {
  // 1. Validate license
  const status = await validateLicense(userId);

  // 2. If blocked, show appropriate screen
  if (!status.isValid) {
    switch (status.blockReason) {
      case 'expired':
        showUpgradeScreen('trial_expired');
        break;
      case 'limit_reached':
        showUpgradeScreen('limit_reached');
        break;
      case 'no_license':
        await createUserLicense(userId);
        break;
    }
    return;
  }

  // 3. Register device if not already
  const deviceResult = await registerDevice(userId);
  if (!deviceResult.success && deviceResult.error === 'device_limit_reached') {
    showDeviceLimitScreen();
    return;
  }

  // 4. Continue to app
}
```

**UI Components**:
- `TrialStatusBanner` - Shows trial days remaining
- `TransactionLimitWarning` - Shows when approaching limit
- `UpgradeScreen` - Shown when blocked
- `DeviceLimitScreen` - Shown when too many devices

**Files to Modify**:
- `electron/main.ts` (license init)
- `src/App.tsx` (license gate)
- `src/contexts/LicenseContext.tsx` (update to use Supabase)
- New: `src/components/license/` components

**Integration checkpoint**: Expired trial blocks app, limits enforced, upgrade prompts shown.

---

## Migration Strategy

### From Local SQLite to Supabase

1. **New Users**: Automatically get Supabase license record
2. **Existing Users**:
   - On first login after update, create Supabase record
   - Copy any relevant local data (AI addon status)
   - Local `users_local` table becomes cache only

### Backwards Compatibility

- Local license context still works (reads from Supabase now)
- Existing license gating UI unchanged
- `useLicense()` hook interface unchanged

---

## Dependency Graph

```yaml
dependency_graph:
  nodes:
    - id: BACKLOG-477
      type: task
      phase: 1
      title: "User License Schema in Supabase"
    - id: BACKLOG-478
      type: task
      phase: 2
      title: "License Validation Service"
    - id: BACKLOG-479
      type: task
      phase: 2
      title: "Device Registration Service"
    - id: BACKLOG-480
      type: task
      phase: 3
      title: "License Check at App Start"
    - id: BACKLOG-481
      type: task
      phase: 3
      title: "Trial Limit Enforcement UI"

  edges:
    - from: BACKLOG-477
      to: BACKLOG-478
      type: depends_on
    - from: BACKLOG-477
      to: BACKLOG-479
      type: depends_on
    - from: BACKLOG-478
      to: BACKLOG-480
      type: depends_on
    - from: BACKLOG-479
      to: BACKLOG-480
      type: depends_on
    - from: BACKLOG-480
      to: BACKLOG-481
      type: depends_on
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Supabase unavailable | Low | High | Cache license status locally, allow offline grace period |
| Device ID changes | Medium | Medium | Allow device re-registration, show clear error |
| Migration data loss | Low | Medium | Local data is minimal, copy on migration |
| RLS policy blocks valid user | Medium | High | Thorough testing with multiple user types |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Execution |
|-------|-------|-------------|-----------|
| Phase 1: Schema | BACKLOG-477 | ~25K | Sequential |
| Phase 2: Services | BACKLOG-478, 479 | ~50K | Sequential |
| Phase 3: Integration | BACKLOG-480, 481 | ~25K | Sequential |
| **Total** | **5 tasks** | **~100K** | - |

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-1186 | BACKLOG-477 | Blocked | - | - | - |
| 2 | TASK-1187 | BACKLOG-478 | Blocked | - | - | - |
| 2 | TASK-1188 | BACKLOG-479 | Blocked | - | - | - |
| 3 | TASK-1189 | BACKLOG-480 | Blocked | - | - | - |
| 3 | TASK-1190 | BACKLOG-481 | Blocked | - | - | - |

**Blocker**: SPRINT-056 must complete first.

---

## Success Criteria

- [ ] user_licenses table in Supabase with RLS
- [ ] device_registrations table with limit enforcement
- [ ] License validation on app start
- [ ] Trial expiry blocks app access
- [ ] Transaction limit enforced
- [ ] Device limit enforced
- [ ] Upgrade prompts shown when appropriate
- [ ] Existing license context API unchanged

---

## Next Sprint

After SPRINT-057 completes, proceed to **SPRINT-058: Unified Auth + License Gate**.
