# BACKLOG-526: Team/Organization Licensing Model

**Category**: feature
**Priority**: P3 (Low)
**Sprint**: -
**Estimated Tokens**: ~100K
**Status**: Pending
**Created**: 2026-01-26
**Source**: SPRINT-062 SR Engineer Review

---

## Summary

Implement a team/organization licensing model allowing multiple users under a single license with shared limits and centralized management.

## Background

Team licensing enables:
- Brokerages to purchase for all agents
- Shared transaction pool
- Centralized billing
- Admin management of team members

## Requirements

### Database Schema

```sql
-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  license_id UUID REFERENCES licenses(id),
  max_members INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization membership
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Update licenses table
ALTER TABLE licenses
ADD COLUMN organization_id UUID REFERENCES organizations(id);
```

### Features

1. **Organization Creation**
   - Owner creates org
   - Links team license
   - Sets member limits

2. **Member Management**
   - Invite by email
   - Assign roles
   - Remove members
   - Transfer ownership

3. **Shared Limits**
   - Pool of transactions
   - Per-org device limit
   - Usage visible to admins

4. **Billing**
   - Single invoice
   - Per-seat pricing
   - Usage-based add-ons

### UI Components

- Organization settings page
- Member list with role management
- Invitation flow
- Usage dashboard (org-wide)

## Acceptance Criteria

- [ ] Organizations can be created and managed
- [ ] Members can be invited and assigned roles
- [ ] Shared limits work correctly
- [ ] Billing per-seat works
- [ ] RLS policies for org data

## Dependencies

- BACKLOG-520 (Stripe Integration) - Required
- BACKLOG-521 (Admin Dashboard) - Recommended
- BACKLOG-524 (Audit Logging) - Recommended

## Related Files

- Supabase migrations for org tables
- `src/pages/Organization/`
- `electron/services/organizationService.ts`
