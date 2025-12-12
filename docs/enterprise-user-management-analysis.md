# Enterprise User Management Analysis

> Analysis for building a user management website for team/enterprise license clients with SSO, SCIM, and automatic user provisioning.

## Current State Summary

**Magic Audit** is an Electron desktop app with:
- ✅ OAuth authentication (Google & Microsoft)
- ✅ Local SQLite + Supabase PostgreSQL databases
- ✅ TypeScript throughout with strict mode
- ✅ User model with `subscription_tier: 'free' | 'pro' | 'enterprise'`
- ❌ No team/organization model
- ❌ No RBAC, SSO, SCIM, or user provisioning

---

## What Would It Take: Enterprise User Management

### 1. Database Schema Changes

**New Supabase Tables Needed:**

```sql
-- Organizations/Teams
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sso_enabled BOOLEAN DEFAULT FALSE,
  sso_provider TEXT, -- 'saml' | 'oidc' | null
  sso_config JSONB,
  scim_enabled BOOLEAN DEFAULT FALSE,
  scim_token_hash TEXT,
  default_role TEXT DEFAULT 'member',
  license_type TEXT NOT NULL, -- 'team' | 'enterprise'
  license_seats INTEGER NOT NULL,
  seats_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Memberships
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'pending'
  provisioned_by TEXT DEFAULT 'manual', -- 'manual' | 'scim' | 'sso_jit'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- SSO Configurations
CREATE TABLE sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL, -- 'saml' | 'oidc'
  entity_id TEXT,
  sso_url TEXT,
  certificate TEXT,
  metadata_url TEXT, -- for Entra ID/Azure AD
  attribute_mapping JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCIM Provisioning Tokens
CREATE TABLE scim_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### 2. SSO Implementation

| Provider | Protocol | Library | Effort |
|----------|----------|---------|--------|
| **Microsoft Entra ID / Azure AD** | SAML 2.0 / OIDC | `passport-azure-ad` or `@azure/msal-node` (already have) | Medium |
| **Google Workspace** | SAML 2.0 / OIDC | `passport-google-oauth20` (already have) | Low |
| **Okta** | SAML 2.0 / OIDC | `passport-saml` | Medium |
| **Generic SAML** | SAML 2.0 | `saml2-js` or `passport-saml` | Medium |

**Implementation Components:**
- SSO configuration wizard UI
- SAML assertion consumer service (ACS) endpoint
- OIDC callback handler
- Certificate management
- Just-in-time (JIT) user provisioning on first SSO login
- SSO enforcement (block password login for SSO orgs)

### 3. SCIM Provisioning

**SCIM 2.0 Endpoints Needed:**

```
POST   /scim/v2/Users           -- Create user
GET    /scim/v2/Users/:id       -- Get user
PUT    /scim/v2/Users/:id       -- Replace user
PATCH  /scim/v2/Users/:id       -- Update user
DELETE /scim/v2/Users/:id       -- Deactivate user
GET    /scim/v2/Users           -- List/filter users
GET    /scim/v2/Groups          -- List groups (optional)
```

**Implementation:**
- SCIM server running as Supabase Edge Function or separate API
- Bearer token authentication per organization
- Map SCIM attributes → your user model
- Handle provisioning/deprovisioning lifecycle

**Provider Setup Guides Needed:**
- Entra ID (Azure AD) → SCIM app registration
- Google Workspace → SCIM provisioning setup
- Okta → SCIM integration

### 4. Automatic User Provisioning Options

| Method | Trigger | Real-time? | Complexity |
|--------|---------|------------|------------|
| **SCIM** | IdP pushes changes | Yes | Medium-High |
| **SSO JIT** | User's first login | At login | Low |
| **Directory Sync** | Scheduled sync job | No (batched) | Medium |

**Recommended:** Start with SSO JIT provisioning, then add SCIM for enterprises that need it.

### 5. New Services Required

```
electron/services/
├── organizationService.ts      -- Org CRUD, membership management
├── ssoService.ts               -- SSO config, SAML/OIDC handling
├── scimService.ts              -- SCIM protocol implementation
├── rbacService.ts              -- Role & permission checks
├── auditService.ts             -- Action logging
└── provisioningService.ts      -- User lifecycle management
```

### 6. New UI Components

```
src/components/admin/
├── OrganizationSettings.tsx    -- General org settings
├── TeamMembers.tsx             -- User list, invite, remove
├── SSOConfiguration.tsx        -- SSO setup wizard
├── SCIMSettings.tsx            -- SCIM token management
├── AuditLogs.tsx               -- Activity viewer
├── RoleManagement.tsx          -- Roles & permissions
└── UserProvisioning.tsx        -- Provisioning status/logs
```

### 7. Architecture Decision: Where to Host SSO/SCIM?

| Option | Pros | Cons |
|--------|------|------|
| **Supabase Edge Functions** | Already using Supabase, easy deployment | Limited compute, cold starts |
| **Separate API Server** | Full control, better for SCIM | Extra infrastructure |
| **Auth0/WorkOS Integration** | Turnkey SSO/SCIM, handles complexity | Monthly cost ($500+/mo enterprise), vendor lock-in |

**Recommendation:** Consider **WorkOS** or **Auth0** for enterprise SSO/SCIM - they handle the complexity of SAML certificate rotation, SCIM compliance, and provider-specific quirks. Otherwise, build on Supabase Edge Functions.

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Organization/team database schema
- [ ] Organization CRUD API
- [ ] Team member management (invite/remove)
- [ ] Basic admin UI
- [ ] Audit logging foundation

### Phase 2: SSO
- [ ] SAML 2.0 service provider implementation
- [ ] OIDC integration (Entra ID, Google Workspace)
- [ ] SSO configuration wizard
- [ ] JIT user provisioning
- [ ] SSO enforcement toggle

### Phase 3: SCIM
- [ ] SCIM 2.0 server endpoints
- [ ] Token management UI
- [ ] User provisioning/deprovisioning handlers
- [ ] Sync status dashboard
- [ ] Provider setup guides

### Phase 4: Polish
- [ ] Comprehensive audit logs
- [ ] Role-based permissions
- [ ] Directory sync (optional)
- [ ] Compliance reports

---

## Key Technical Decisions Needed

1. **Build vs Buy for SSO/SCIM?**
   - Build: Full control, ongoing maintenance
   - Buy (WorkOS/Auth0): Faster integration, $500+/month

2. **Multi-tenant Architecture?**
   - Current: User-level isolation
   - Needed: Organization-level isolation with RLS policies

3. **Admin Portal Location?**
   - In-app admin section (current Electron app)
   - Separate web admin portal (more common for enterprise)

4. **Licensing Model?**
   - Per-seat pricing
   - Per-organization flat rate
   - Hybrid

---

## Estimated Total Effort

| Approach | Timeline | Cost |
|----------|----------|------|
| **Full custom build** | 8-12 weeks | Dev time only |
| **With WorkOS/Auth0** | 3-4 weeks | Dev + $500-2000/mo |
| **MVP (SSO JIT only)** | 3-4 weeks | Dev time only |

---

## Next Steps

1. Decide on build vs buy approach for SSO/SCIM
2. Design detailed database schema
3. Choose admin portal strategy (in-app vs separate web portal)
4. Begin Phase 1 implementation
