# BACKLOG-477: User License Schema in Supabase

**Category**: schema
**Priority**: P0
**Sprint**: SPRINT-057
**Estimated Tokens**: ~25K
**Status**: Pending

---

## Summary

Create `user_licenses` and `device_registrations` tables in Supabase to track user subscription status and device limits.

## Background

Moving from local-only licensing to Supabase enables:
- Blocking expired licenses
- Trial transaction/device limits
- Future team license support

## Requirements

### Schema

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
```

### RLS Policies

- Users can read/update their own license
- Users can manage their own devices
- Device limit trigger function

### TypeScript Types

Create `shared/types/license.ts` with corresponding interfaces.

## Acceptance Criteria

- [ ] `user_licenses` table created with all columns
- [ ] `device_registrations` table created
- [ ] RLS policies enabled and tested
- [ ] Device limit trigger function working
- [ ] TypeScript types generated/created

## Dependencies

- SPRINT-056 must be complete

## Related Files

- `supabase/migrations/XXXXXXXX_user_licenses.sql`
- `shared/types/license.ts`
