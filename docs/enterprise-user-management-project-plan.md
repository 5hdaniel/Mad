# Enterprise User Management - Project Plan

> Building in-house SSO, user management portal, and user provisioning for team/enterprise clients.
>
> **Stack**: Supabase (PostgreSQL + Edge Functions) | Microsoft Entra ID | Google Workspace
>
> **Not Using**: WorkOS, Auth0, Okta, or generic SAML (can be added later if needed)

## Priority Order
1. **SSO Integration** (Highest) - Enable enterprise authentication with Entra ID & Google Workspace
2. **Admin Portal** - User management interface
3. **User Provisioning** - SCIM and automated provisioning

---

## Dependency Graph

```
                                    PHASE 1: FOUNDATION
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│ EUM-1 │     │ EUM-2 │       │ EUM-3 │       │ EUM-4 │           │
│Schema │     │ Org   │       │ Audit │       │ RBAC  │           │
│       │     │Service│       │Service│       │Service│           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                    ┌───────────┐                                 │
                    │  EUM-5    │                                 │
                    │Integration│                                 │
                    │  & Tests  │                                 │
                    └─────┬─────┘                                 │
                          │                                       │
                    └─────┼───────────────────────────────────────┘
                          │
                          ▼
                                     PHASE 2: SSO
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│ EUM-6 │     │ EUM-7 │       │ EUM-8 │       │ EUM-9 │           │
│EntraID│     │Google │       │  SSO  │       │  JIT  │           │
│  SSO  │     │Worksp.│       │ Core  │       │Provis.│           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                   ┌────────────┐                                 │
                   │  EUM-10    │                                 │
                   │SSO Integr. │                                 │
                   │  & E2E     │                                 │
                   └─────┬──────┘                                 │
                         │                                        │
                    └────┼────────────────────────────────────────┘
                         │
                         ▼
                                   PHASE 3: ADMIN PORTAL
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│EUM-11 │     │EUM-12 │       │EUM-13 │       │EUM-14 │           │
│ Org   │     │ Team  │       │  SSO  │       │ Audit │           │
│ UI    │     │Members│       │Config │       │  UI   │           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                   ┌────────────┐                                 │
                   │  EUM-15    │                                 │
                   │Portal Intg.│                                 │
                   │  & QA      │                                 │
                   └─────┬──────┘                                 │
                         │                                        │
                    └────┼────────────────────────────────────────┘
                         │
                         ▼
                                  PHASE 4: PROVISIONING
                    ┌─────────────────────────────────────────────┐
                    │                                             │
    ┌───────────────┼───────────────┬───────────────┐             │
    │               │               │               │             │
    ▼               ▼               ▼               ▼             │
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐           │
│EUM-16 │     │EUM-17 │       │EUM-18 │       │EUM-19 │           │
│ SCIM  │     │ SCIM  │       │Provis.│       │ Sync  │           │
│Server │     │  UI   │       │ UI    │       │Service│           │
└───┬───┘     └───┬───┘       └───┬───┘       └───┬───┘           │
    │             │               │               │               │
    └─────────────┴───────┬───────┴───────────────┘               │
                          │                                       │
                          ▼                                       │
                   ┌────────────┐                                 │
                   │  EUM-20    │                                 │
                   │ Final QA   │                                 │
                   │ & Release  │                                 │
                   └────────────┘                                 │
                    └─────────────────────────────────────────────┘
```

---

## Phase 1: Foundation Layer

> **Goal**: Database schema, core services, and infrastructure needed by all subsequent phases.

### Parallel Tasks

| Ticket | Title | Description | Dependencies | Parallel With |
|--------|-------|-------------|--------------|---------------|
| **EUM-1** | Database Schema - Organizations & Members | Create Supabase migrations for `organizations`, `organization_members`, `sso_configurations`, `scim_tokens`, `audit_logs` tables with RLS policies | None | EUM-2, EUM-3, EUM-4 |
| **EUM-2** | Organization Service | Create `organizationService.ts` - CRUD for orgs, membership management, invite/remove users, seat tracking | None | EUM-1, EUM-3, EUM-4 |
| **EUM-3** | Audit Logging Service | Create `auditService.ts` - Log all admin actions, query audit logs, retention policies | None | EUM-1, EUM-2, EUM-4 |
| **EUM-4** | RBAC Service | Create `rbacService.ts` - Role definitions (owner/admin/member), permission checks, role assignment | None | EUM-1, EUM-2, EUM-3 |

### Merge Task

| Ticket | Title | Description | Dependencies |
|--------|-------|-------------|--------------|
| **EUM-5** | Phase 1 Integration & Testing | Integrate all foundation services, add IPC handlers, write unit tests, verify RLS policies work correctly | EUM-1, EUM-2, EUM-3, EUM-4 |

---

## Phase 2: SSO Implementation

> **Goal**: Enable enterprise SSO with Microsoft Entra ID and Google Workspace.

### Parallel Tasks

| Ticket | Title | Description | Dependencies | Parallel With |
|--------|-------|-------------|--------------|---------------|
| **EUM-6** | Microsoft Entra ID SSO | Create `entraIdSsoService.ts` - Extend MSAL for enterprise OIDC, tenant-specific auth, group claims | EUM-5 | EUM-7, EUM-8, EUM-9 |
| **EUM-7** | Google Workspace SSO | Create `googleWorkspaceSsoService.ts` - Extend Google auth for Workspace, domain restriction, hd claim | EUM-5 | EUM-6, EUM-8, EUM-9 |
| **EUM-8** | SSO Core Service | Create `ssoService.ts` - SSO config management, provider detection, login routing, SSO enforcement | EUM-5 | EUM-6, EUM-7, EUM-9 |
| **EUM-9** | JIT User Provisioning | Create `jitProvisioningService.ts` - Auto-create users on first SSO login, map IdP attributes to user model | EUM-5 | EUM-6, EUM-7, EUM-8 |

### Merge Task

| Ticket | Title | Description | Dependencies |
|--------|-------|-------------|--------------|
| **EUM-10** | SSO Integration & E2E Testing | Integrate all SSO services, update auth flow, E2E tests with Entra ID and Google Workspace test tenants | EUM-6, EUM-7, EUM-8, EUM-9 |

---

## Phase 3: Admin Portal

> **Goal**: Web-based admin interface for organization and user management.

### Parallel Tasks

| Ticket | Title | Description | Dependencies | Parallel With |
|--------|-------|-------------|--------------|---------------|
| **EUM-11** | Organization Settings UI | React components for org profile, branding, license info, general settings | EUM-10 | EUM-12, EUM-13, EUM-14 |
| **EUM-12** | Team Members Management UI | User list, invite flow, role assignment, suspend/remove users, bulk operations | EUM-10 | EUM-11, EUM-13, EUM-14 |
| **EUM-13** | SSO Configuration Wizard | Step-by-step SSO setup UI - provider selection, metadata upload, attribute mapping, test connection | EUM-10 | EUM-11, EUM-12, EUM-14 |
| **EUM-14** | Audit Logs Viewer | Searchable/filterable audit log UI, export functionality, activity timeline | EUM-10 | EUM-11, EUM-12, EUM-13 |

### Merge Task

| Ticket | Title | Description | Dependencies |
|--------|-------|-------------|--------------|
| **EUM-15** | Portal Integration & QA | Integrate all portal components, navigation, responsive design, accessibility audit, QA testing | EUM-11, EUM-12, EUM-13, EUM-14 |

---

## Phase 4: Automated Provisioning

> **Goal**: SCIM support for automatic user provisioning/deprovisioning.

### Parallel Tasks

| Ticket | Title | Description | Dependencies | Parallel With |
|--------|-------|-------------|--------------|---------------|
| **EUM-16** | SCIM 2.0 Server | Create SCIM endpoints (Supabase Edge Functions) - Users CRUD, Groups, filtering, pagination, error handling | EUM-15 | EUM-17, EUM-18, EUM-19 |
| **EUM-17** | SCIM Token Management UI | Generate/revoke SCIM tokens, token list, last used tracking, expiration settings | EUM-15 | EUM-16, EUM-18, EUM-19 |
| **EUM-18** | Provisioning Status UI | User provisioning status dashboard, sync history, error logs, manual sync trigger | EUM-15 | EUM-16, EUM-17, EUM-19 |
| **EUM-19** | Directory Sync Service | Create `directorySyncService.ts` - Scheduled sync option, conflict resolution, orphan detection | EUM-15 | EUM-16, EUM-17, EUM-18 |

### Merge Task

| Ticket | Title | Description | Dependencies |
|--------|-------|-------------|--------------|
| **EUM-20** | Final Integration, QA & Release | Full integration testing, SCIM compliance testing with Entra ID/Google, documentation, release preparation | EUM-16, EUM-17, EUM-18, EUM-19 |

---

## Detailed Ticket Specifications

### EUM-1: Database Schema - Organizations & Members

**Type**: Backend / Database

**Acceptance Criteria**:
- [ ] `organizations` table created with all fields
- [ ] `organization_members` table with proper foreign keys
- [ ] `sso_configurations` table for SSO settings
- [ ] `scim_tokens` table for SCIM auth
- [ ] `audit_logs` table with proper indexing
- [ ] RLS policies for multi-tenant isolation
- [ ] Migration scripts versioned and reversible

**Schema**:
```sql
-- See enterprise-user-management-analysis.md for full schema
```

---

### EUM-2: Organization Service

**Type**: Backend / Service

**File**: `electron/services/organizationService.ts`

**Acceptance Criteria**:
- [ ] `createOrganization(name, slug, licenseType, seats)`
- [ ] `updateOrganization(orgId, updates)`
- [ ] `deleteOrganization(orgId)` - soft delete
- [ ] `getOrganization(orgId)`
- [ ] `getOrganizationBySlug(slug)`
- [ ] `addMember(orgId, userId, role)`
- [ ] `removeMember(orgId, userId)`
- [ ] `updateMemberRole(orgId, userId, newRole)`
- [ ] `getMembersByOrg(orgId, filters)`
- [ ] `getOrgsByUser(userId)`
- [ ] `checkSeatAvailability(orgId)`
- [ ] `transferOwnership(orgId, fromUserId, toUserId)`
- [ ] Unit tests with >80% coverage

---

### EUM-3: Audit Logging Service

**Type**: Backend / Service

**File**: `electron/services/auditService.ts`

**Acceptance Criteria**:
- [ ] `logAction(orgId, actorId, action, resourceType, resourceId, details, ipAddress)`
- [ ] `getAuditLogs(orgId, filters, pagination)`
- [ ] `getAuditLogsByUser(orgId, userId)`
- [ ] `getAuditLogsByResource(orgId, resourceType, resourceId)`
- [ ] `exportAuditLogs(orgId, dateRange, format)`
- [ ] Automatic logging integration hooks
- [ ] Log retention policy enforcement
- [ ] Unit tests

**Actions to Log**:
- `user.invited`, `user.removed`, `user.role_changed`, `user.suspended`
- `sso.configured`, `sso.updated`, `sso.disabled`
- `scim.token_created`, `scim.token_revoked`
- `org.settings_updated`, `org.deleted`

---

### EUM-4: RBAC Service

**Type**: Backend / Service

**File**: `electron/services/rbacService.ts`

**Acceptance Criteria**:
- [ ] Role definitions: `owner`, `admin`, `member`
- [ ] Permission matrix implementation
- [ ] `hasPermission(userId, orgId, permission)`
- [ ] `getUserRole(userId, orgId)`
- [ ] `canManageUsers(userId, orgId)`
- [ ] `canConfigureSSO(userId, orgId)`
- [ ] `canViewAuditLogs(userId, orgId)`
- [ ] `canManageBilling(userId, orgId)`
- [ ] Middleware/decorator for permission checks
- [ ] Unit tests

**Permission Matrix**:
| Permission | Owner | Admin | Member |
|------------|-------|-------|--------|
| View org settings | ✓ | ✓ | ✓ |
| Edit org settings | ✓ | ✓ | ✗ |
| Manage users | ✓ | ✓ | ✗ |
| Configure SSO | ✓ | ✓ | ✗ |
| View audit logs | ✓ | ✓ | ✗ |
| Manage billing | ✓ | ✗ | ✗ |
| Delete org | ✓ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ |

---

### EUM-5: Phase 1 Integration & Testing

**Type**: Integration / Testing

**Acceptance Criteria**:
- [ ] All Phase 1 services integrated
- [ ] IPC handlers created for all service methods
- [ ] Preload bridge updated with new APIs
- [ ] Integration tests passing
- [ ] RLS policies verified with test data
- [ ] Error handling standardized
- [ ] Logging consistent across services
- [ ] Code review completed

---

### EUM-6: Microsoft Entra ID SSO Service

**Type**: Backend / Service

**File**: `electron/services/entraIdSsoService.ts`

**Dependencies**: Extend existing `@azure/msal-node` (already installed)

**Acceptance Criteria**:
- [ ] Extend existing Microsoft auth for enterprise OIDC/SAML
- [ ] Support Entra ID tenant-specific endpoints
- [ ] Handle enterprise app registration flow
- [ ] Token validation with Entra ID JWKS
- [ ] ID token claims extraction (groups, roles)
- [ ] Support for multi-tenant and single-tenant apps
- [ ] Error handling for common Entra ID issues
- [ ] Unit tests with mock responses

---

### EUM-7: Google Workspace SSO Service

**Type**: Backend / Service

**File**: `electron/services/googleWorkspaceSsoService.ts`

**Dependencies**: Extend existing `googleapis` (already installed)

**Acceptance Criteria**:
- [ ] Extend existing Google auth for Workspace enterprise OIDC
- [ ] Support Workspace domain-restricted login
- [ ] Handle hosted domain (hd) claim verification
- [ ] Token validation with Google JWKS
- [ ] ID token claims extraction (groups via Directory API)
- [ ] Support for Workspace organizational units
- [ ] Error handling for common Google Workspace issues
- [ ] Unit tests with mock responses

---

### EUM-8: SSO Core Service

**Type**: Backend / Service

**File**: `electron/services/ssoService.ts`

**Acceptance Criteria**:
- [ ] `configureSSOForOrg(orgId, ssoConfig)`
- [ ] `getSSOConfig(orgId)`
- [ ] `updateSSOConfig(orgId, updates)`
- [ ] `disableSSO(orgId)`
- [ ] `testSSOConnection(orgId)`
- [ ] `getSSOLoginUrl(orgSlug)` - determine SSO method from email domain
- [ ] `enforceSSOLogin(orgId, enabled)` - block non-SSO login
- [ ] Domain verification for SSO
- [ ] Multiple domain support per org
- [ ] Unit tests

---

### EUM-9: JIT User Provisioning

**Type**: Backend / Service

**File**: `electron/services/jitProvisioningService.ts`

**Acceptance Criteria**:
- [ ] `provisionUserFromSSO(orgId, ssoAttributes)`
- [ ] Attribute mapping: email, name, department, etc.
- [ ] Auto-assign default role on first login
- [ ] Update existing user attributes on subsequent logins
- [ ] Handle user not in org (reject or auto-add based on settings)
- [ ] Sync user status with IdP (active/suspended)
- [ ] Unit tests

---

### EUM-10: SSO Integration & E2E Testing

**Type**: Integration / Testing

**Acceptance Criteria**:
- [ ] All SSO services integrated
- [ ] Auth flow updated to check for SSO org
- [ ] E2E test: Microsoft Entra ID OIDC flow
- [ ] E2E test: Google Workspace OIDC flow
- [ ] SSO enforcement working (block non-SSO login for SSO orgs)
- [ ] JIT provisioning working
- [ ] Error states handled gracefully
- [ ] Logout flow updated (IdP logout consideration)
- [ ] Domain verification working
- [ ] Code review completed

---

### EUM-11: Organization Settings UI

**Type**: Frontend / React

**Files**: `src/components/admin/OrganizationSettings.tsx`

**Acceptance Criteria**:
- [ ] Organization name and slug editing
- [ ] Logo/branding upload
- [ ] License information display (type, seats, usage)
- [ ] Domain management (add/verify/remove)
- [ ] Default member role setting
- [ ] Danger zone: delete organization
- [ ] Responsive design
- [ ] Loading and error states
- [ ] Unit tests

---

### EUM-12: Team Members Management UI

**Type**: Frontend / React

**Files**: `src/components/admin/TeamMembers.tsx`, `src/components/admin/InviteModal.tsx`

**Acceptance Criteria**:
- [ ] Member list with search/filter
- [ ] Invite user by email (with role selection)
- [ ] Bulk invite via CSV
- [ ] Change member role
- [ ] Suspend/reactivate member
- [ ] Remove member (with confirmation)
- [ ] Show provisioning source (manual/SSO/SCIM)
- [ ] Pagination for large teams
- [ ] Responsive design
- [ ] Unit tests

---

### EUM-13: SSO Configuration Wizard

**Type**: Frontend / React

**Files**: `src/components/admin/SSOConfiguration.tsx`, `src/components/admin/SSOWizard.tsx`

**Acceptance Criteria**:
- [ ] Provider selection (Microsoft Entra ID or Google Workspace)
- [ ] Step-by-step setup flow with provider-specific instructions
- [ ] Entra ID: Tenant ID, Client ID configuration
- [ ] Google Workspace: Domain, Client ID configuration
- [ ] Domain verification flow
- [ ] Test connection button
- [ ] SSO enforcement toggle
- [ ] Setup instructions per provider (with screenshots)
- [ ] Current SSO status display
- [ ] Disable SSO option
- [ ] Unit tests

---

### EUM-14: Audit Logs Viewer

**Type**: Frontend / React

**Files**: `src/components/admin/AuditLogs.tsx`

**Acceptance Criteria**:
- [ ] Paginated log list
- [ ] Filter by date range
- [ ] Filter by action type
- [ ] Filter by actor
- [ ] Search functionality
- [ ] Log detail expansion
- [ ] Export to CSV
- [ ] Relative timestamps with hover for absolute
- [ ] Responsive design
- [ ] Unit tests

---

### EUM-15: Portal Integration & QA

**Type**: Integration / QA

**Acceptance Criteria**:
- [ ] All portal components integrated
- [ ] Navigation/routing setup
- [ ] Permission-based UI (hide/disable based on role)
- [ ] Consistent styling with app design system
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Cross-browser testing
- [ ] Responsive design verification
- [ ] QA test cases executed
- [ ] Bug fixes completed
- [ ] Code review completed

---

### EUM-16: SCIM 2.0 Server

**Type**: Backend / API

**Location**: Supabase Edge Functions or `supabase/functions/scim/`

**Acceptance Criteria**:
- [ ] `POST /scim/v2/Users` - Create user
- [ ] `GET /scim/v2/Users/:id` - Get user
- [ ] `PUT /scim/v2/Users/:id` - Replace user
- [ ] `PATCH /scim/v2/Users/:id` - Update user (SCIM PATCH operations)
- [ ] `DELETE /scim/v2/Users/:id` - Deactivate user
- [ ] `GET /scim/v2/Users` - List users with filtering
- [ ] `GET /scim/v2/ServiceProviderConfig` - SCIM capabilities
- [ ] `GET /scim/v2/Schemas` - Schema discovery
- [ ] Bearer token authentication
- [ ] Proper SCIM error responses
- [ ] Rate limiting
- [ ] Unit tests
- [ ] SCIM compliance test suite

**SCIM Attribute Mapping**:
```json
{
  "userName": "email",
  "name.givenName": "first_name",
  "name.familyName": "last_name",
  "displayName": "display_name",
  "active": "is_active",
  "emails[primary].value": "email"
}
```

---

### EUM-17: SCIM Token Management UI

**Type**: Frontend / React

**Files**: `src/components/admin/SCIMSettings.tsx`

**Acceptance Criteria**:
- [ ] Generate new SCIM token (show once)
- [ ] List existing tokens (masked)
- [ ] Token last used timestamp
- [ ] Token expiration settings
- [ ] Revoke token
- [ ] SCIM endpoint URL display
- [ ] Setup instructions for Entra ID, Google Workspace
- [ ] Unit tests

---

### EUM-18: Provisioning Status UI

**Type**: Frontend / React

**Files**: `src/components/admin/ProvisioningStatus.tsx`

**Acceptance Criteria**:
- [ ] Provisioning overview (total synced, pending, errors)
- [ ] Recent sync activity list
- [ ] Error log with details
- [ ] Manual sync trigger button
- [ ] User provisioning source indicator
- [ ] Filter by provisioning status
- [ ] Unit tests

---

### EUM-19: Directory Sync Service

**Type**: Backend / Service

**File**: `electron/services/directorySyncService.ts`

**Acceptance Criteria**:
- [ ] Scheduled sync job (configurable interval)
- [ ] Full sync vs incremental sync
- [ ] Conflict resolution (IdP wins, local wins, manual)
- [ ] Orphan user detection (users removed from IdP)
- [ ] Sync status tracking
- [ ] Sync history logging
- [ ] Error notification to admins
- [ ] Unit tests

---

### EUM-20: Final Integration, QA & Release

**Type**: Integration / Release

**Acceptance Criteria**:
- [ ] All features integrated and working together
- [ ] SCIM compliance testing with Microsoft Entra ID
- [ ] SCIM compliance testing with Google Workspace
- [ ] Full regression testing
- [ ] Performance testing (large org with 1000+ users)
- [ ] Security audit
- [ ] Documentation complete
  - [ ] Admin guide
  - [ ] SSO setup guides per provider
  - [ ] SCIM setup guides per provider
  - [ ] API documentation
- [ ] Release notes prepared
- [ ] Migration guide for existing users
- [ ] Feature flags configured for gradual rollout

---

## Detailed Dependency Graph (Text Format)

```
LEGEND:
  ──► Sequential dependency (must complete before)
  ═══► Phase boundary (all tasks in phase must complete)

START
  │
  ├──► EUM-1 (Schema) ─────────────────────────────┐
  │                                                │
  ├──► EUM-2 (Org Service) ────────────────────────┤
  │                                                │──► EUM-5 (Phase 1 Merge)
  ├──► EUM-3 (Audit Service) ──────────────────────┤         │
  │                                                │         │
  └──► EUM-4 (RBAC Service) ───────────────────────┘         │
                                                             │
  ═══════════════════════════════════════════════════════════╪═══
                                                             │
                                                             ▼
  ┌──────────────────────────────────────────────────────────┤
  │                                                          │
  ├──► EUM-6 (Entra ID SSO) ───────────────────────┐         │
  │                                                │         │
  ├──► EUM-7 (Google Workspace SSO) ───────────────┤         │
  │                                                │──► EUM-10 (Phase 2 Merge)
  ├──► EUM-8 (SSO Core) ───────────────────────────┤         │
  │                                                │         │
  └──► EUM-9 (JIT Provisioning) ───────────────────┘         │
                                                             │
  ═══════════════════════════════════════════════════════════╪═══
                                                             │
                                                             ▼
  ┌──────────────────────────────────────────────────────────┤
  │                                                          │
  ├──► EUM-11 (Org Settings UI) ───────────────────┐         │
  │                                                │         │
  ├──► EUM-12 (Team Members UI) ───────────────────┤         │
  │                                                │──► EUM-15 (Phase 3 Merge)
  ├──► EUM-13 (SSO Config UI) ─────────────────────┤         │
  │                                                │         │
  └──► EUM-14 (Audit Logs UI) ─────────────────────┘         │
                                                             │
  ═══════════════════════════════════════════════════════════╪═══
                                                             │
                                                             ▼
  ┌──────────────────────────────────────────────────────────┤
  │                                                          │
  ├──► EUM-16 (SCIM Server) ───────────────────────┐         │
  │                                                │         │
  ├──► EUM-17 (SCIM Token UI) ─────────────────────┤         │
  │                                                │──► EUM-20 (Phase 4 Merge/Release)
  ├──► EUM-18 (Provisioning UI) ───────────────────┤
  │                                                │
  └──► EUM-19 (Directory Sync) ────────────────────┘

                                                             │
                                                             ▼
                                                           DONE
```

---

## Quick Reference: Parallel Execution

| Phase | Parallel Tasks | Merge Task |
|-------|---------------|------------|
| **1** | EUM-1, EUM-2, EUM-3, EUM-4 | EUM-5 |
| **2** | EUM-6, EUM-7, EUM-8, EUM-9 | EUM-10 |
| **3** | EUM-11, EUM-12, EUM-13, EUM-14 | EUM-15 |
| **4** | EUM-16, EUM-17, EUM-18, EUM-19 | EUM-20 |

---

## Tech Stack for Implementation

| Component | Technology |
|-----------|------------|
| Microsoft Entra ID SSO | `@azure/msal-node` (already installed) |
| Google Workspace SSO | `googleapis` (already installed) |
| SCIM Server | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL |
| Frontend | React + TypeScript + Tailwind |
| State | React Context + existing patterns |
| Hosting | Supabase (no external auth providers) |

---

## Notes

- **Existing Assets**: You already have Microsoft and Google developer accounts with OAuth configured - the SSO work will extend these existing integrations.
- **SSO Testing**: Create test enterprise tenants in both Entra ID and Google Workspace for E2E testing.
- **SCIM Testing**: Both Entra ID and Google Workspace have SCIM provisioning test modes.
- **Gradual Rollout**: Consider feature flags to enable enterprise features per-organization.
- **Future Expansion**: Okta, OneLogin, and generic SAML support can be added in a future phase if customer demand exists.
- **In-House Build**: All authentication handled via Supabase and existing Microsoft/Google libraries - no external auth vendors (WorkOS, Auth0).
