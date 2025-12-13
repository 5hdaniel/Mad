# Enterprise User Management - Engineer Assignment Prompts

> These are the exact prompts to give to each Claude/LLM engineer instance.
> Copy the relevant prompt when assigning a task.

---

## Phase 1: Foundation

### EUM-001 Assignment Prompt

```
You are assigned Task EUM-001 – "Database Schema - Organizations & Members".

Task file: tasks/enterprise-user-management/EUM-001.md

Instructions:
- Branch: feat/EUM-001-database-schema
- Create Supabase migration file with all tables defined in the task file
- Include RLS policies for multi-tenant isolation
- Include triggers for updated_at and seats_used
- Do NOT modify any existing tables (users, etc.)
- Do NOT add any application code - schema only

Stop and ask if:
- You need to modify existing table structure
- RLS policy requirements are unclear
- You're unsure about foreign key cascade behavior

Complete the Implementation Summary in your task file before opening your PR.
CI must be green. Migration must apply cleanly.
```

### EUM-002 Assignment Prompt

```
You are assigned Task EUM-002 – "Organization Service".

Task file: tasks/enterprise-user-management/EUM-002.md

Instructions:
- Branch: feat/EUM-002-organization-service
- Create TypeScript types in electron/types/organization.ts
- Create service in electron/services/organizationService.ts
- Create IPC handlers in electron/handlers/organizationHandlers.ts
- Follow existing service patterns (see databaseService.ts for reference)
- Use Supabase client for all database operations
- Do NOT modify schema (handled in EUM-001)
- Do NOT add UI code

Stop and ask if:
- Supabase client patterns are unclear
- You need to change the schema
- Business logic requirements are ambiguous

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required with >80% coverage. CI must be green.
```

### EUM-003 Assignment Prompt

```
You are assigned Task EUM-003 – "Audit Logging Service".

Task file: tasks/enterprise-user-management/EUM-003.md

Instructions:
- Branch: feat/EUM-003-audit-service
- Create TypeScript types in electron/types/audit.ts
- Create service in electron/services/auditService.ts
- Create IPC handlers in electron/handlers/auditHandlers.ts
- Define all audit action constants as specified
- Implement CSV export functionality
- Do NOT include sensitive data (tokens, secrets) in log details
- Do NOT modify schema (handled in EUM-001)

Stop and ask if:
- New action types are needed beyond those specified
- You're unsure what details to include in logs
- Export format requirements are unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-004 Assignment Prompt

```
You are assigned Task EUM-004 – "RBAC Service".

Task file: tasks/enterprise-user-management/EUM-004.md

Instructions:
- Branch: feat/EUM-004-rbac-service
- Create TypeScript types in electron/types/rbac.ts
- Create permission matrix in electron/services/rbac/permissionMatrix.ts
- Create service in electron/services/rbacService.ts
- Create middleware in electron/middleware/requirePermission.ts
- Follow the exact permission matrix in the task file
- Do NOT add custom roles beyond owner/admin/member
- Do NOT modify schema (handled in EUM-001)

Stop and ask if:
- Permission matrix seems incomplete for a use case
- Role hierarchy is unclear
- You need to add new permission types

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required with >80% coverage. CI must be green.
```

### EUM-005 Assignment Prompt

```
You are assigned Task EUM-005 – "Phase 1 Integration & Testing".

Task file: tasks/enterprise-user-management/EUM-005.md

This is a MERGE GATE task. You must:
1. Ensure all Phase 1 branches are merged into int/phase1-foundation
2. Register all handlers in electron/main.ts
3. Update electron/preload.ts with all new APIs
4. Update src/types/electron.d.ts with TypeScript definitions
5. Write integration tests verifying services work together
6. Verify RLS policies with cross-tenant test
7. Ensure CI is green

Instructions:
- Branch: feat/EUM-005-phase1-integration
- Do NOT add new features - integration only
- Do NOT proceed if any Phase 1 task is incomplete
- Run the RLS verification script

Stop and ask if:
- Any Phase 1 PR is not yet merged
- Integration tests reveal design issues
- RLS policies don't work as expected

Complete the Implementation Summary in your task file before opening your PR.
All tests must pass. CI must be green. This gates Phase 2.
```

---

## Phase 2: SSO

### EUM-006 Assignment Prompt

```
You are assigned Task EUM-006 – "Microsoft Entra ID SSO Service".

Task file: tasks/enterprise-user-management/EUM-006.md

Instructions:
- Branch: feat/EUM-006-entra-id-sso
- Extend existing @azure/msal-node integration
- Create electron/types/entraId.ts
- Create electron/services/entraIdSsoService.ts
- Use PKCE for authorization code flow
- Encrypt client secrets before storage
- Validate tenant ID in tokens
- Do NOT modify the SSO core service (handled in EUM-008)
- Do NOT modify existing Microsoft OAuth login flow

Stop and ask if:
- MSAL configuration patterns are unclear
- You need to change existing auth code
- Tenant validation requirements are ambiguous

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-007 Assignment Prompt

```
You are assigned Task EUM-007 – "Google Workspace SSO Service".

Task file: tasks/enterprise-user-management/EUM-007.md

Instructions:
- Branch: feat/EUM-007-google-workspace-sso
- Extend existing googleapis integration
- Create electron/types/googleWorkspace.ts
- Create electron/services/googleWorkspaceSsoService.ts
- Use PKCE for authorization code flow
- Validate hosted domain (hd) claim
- Verify email_verified claim
- Encrypt client secrets before storage
- Do NOT modify the SSO core service (handled in EUM-008)
- Do NOT modify existing Google OAuth login flow

Stop and ask if:
- Google OAuth patterns are unclear
- Domain verification requirements are ambiguous
- You need to change existing auth code

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-008 Assignment Prompt

```
You are assigned Task EUM-008 – "SSO Core Service".

Task file: tasks/enterprise-user-management/EUM-008.md

Instructions:
- Branch: feat/EUM-008-sso-core-service
- Create electron/types/sso.ts
- Create electron/services/ssoService.ts
- Coordinate between Entra ID service (EUM-006) and Google service (EUM-007)
- Implement configuration management
- Implement login method detection (by email domain or org slug)
- Implement SSO enforcement logic
- Do NOT implement provider-specific logic (handled in EUM-006/007)
- Do NOT implement JIT provisioning (handled in EUM-009)

Stop and ask if:
- Interface between core and provider services is unclear
- State management requirements are ambiguous
- SSO enforcement edge cases are unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-009 Assignment Prompt

```
You are assigned Task EUM-009 – "JIT User Provisioning Service".

Task file: tasks/enterprise-user-management/EUM-009.md

Instructions:
- Branch: feat/EUM-009-jit-provisioning
- Create electron/types/jitProvisioning.ts
- Create electron/services/jitProvisioningService.ts
- Handle new user creation on first SSO login
- Handle existing user updates on subsequent SSO logins
- Map IdP attributes to user model
- Add users to organization with correct role
- Log all provisioning events to audit service
- Do NOT modify user creation in existing auth flow

Stop and ask if:
- Attribute mapping requirements are unclear
- User deduplication logic is ambiguous
- Default role assignment is unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-010 Assignment Prompt

```
You are assigned Task EUM-010 – "SSO Integration & E2E Testing".

Task file: tasks/enterprise-user-management/EUM-010.md

This is a MERGE GATE task. You must:
1. Ensure all Phase 2 branches are merged into int/phase2-sso
2. Register SSO handlers in electron/main.ts
3. Update auth flow to support SSO
4. Update preload bridge with SSO APIs
5. Perform E2E testing with real Entra ID tenant
6. Perform E2E testing with real Google Workspace domain
7. Verify JIT provisioning works
8. Verify SSO enforcement works

Instructions:
- Branch: feat/EUM-010-sso-integration
- Do NOT add new features - integration and testing only
- Do NOT proceed if any Phase 2 task is incomplete

Stop and ask if:
- Any Phase 2 PR is not yet merged
- E2E tests reveal design issues
- IdP configuration is not available for testing

Complete the Implementation Summary in your task file before opening your PR.
E2E tests must pass. CI must be green. This gates Phase 3.
```

---

## Phase 3: Admin Portal

### EUM-011 Assignment Prompt

```
You are assigned Task EUM-011 – "Organization Settings UI".

Task file: tasks/enterprise-user-management/EUM-011.md

Instructions:
- Branch: feat/EUM-011-org-settings-ui
- Create React components in src/components/admin/
- Follow existing Tailwind design patterns
- Implement profile editing, domain management, license display
- Include danger zone for org deletion
- Use window.api.org.* for all operations
- Do NOT implement SSO configuration (handled in EUM-013)
- Do NOT implement member management (handled in EUM-012)

Stop and ask if:
- Design patterns are unclear
- RBAC visibility rules are ambiguous
- Delete confirmation flow is unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. Responsive design required. CI must be green.
```

### EUM-012 Assignment Prompt

```
You are assigned Task EUM-012 – "Team Members Management UI".

Task file: tasks/enterprise-user-management/EUM-012.md

Instructions:
- Branch: feat/EUM-012-team-members-ui
- Create React components in src/components/admin/
- Implement member list with search/filter/pagination
- Implement invite flow (single and bulk CSV)
- Implement role changes, suspend, remove actions
- Show provisioning source indicators
- Use window.api.org.* for all operations
- Respect RBAC - hide/disable actions user can't perform

Stop and ask if:
- Bulk invite error handling is unclear
- Role change restrictions are ambiguous
- Pagination requirements are unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. Responsive design required. CI must be green.
```

### EUM-013 Assignment Prompt

```
You are assigned Task EUM-013 – "SSO Configuration Wizard".

Task file: tasks/enterprise-user-management/EUM-013.md

Instructions:
- Branch: feat/EUM-013-sso-config-ui
- Create React components in src/components/admin/sso/
- Implement provider selection (Entra ID or Google Workspace)
- Implement step-by-step wizard for each provider
- Include setup instructions with copy-paste values
- Implement test connection functionality
- Implement enable/disable and enforcement toggle
- Use window.api.sso.* for all operations

Stop and ask if:
- Setup instruction content is unclear
- Test connection feedback is ambiguous
- Enforcement toggle behavior is unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. Both provider flows must work. CI must be green.
```

### EUM-014 Assignment Prompt

```
You are assigned Task EUM-014 – "Audit Logs Viewer".

Task file: tasks/enterprise-user-management/EUM-014.md

Instructions:
- Branch: feat/EUM-014-audit-logs-ui
- Create React components in src/components/admin/
- Implement paginated log list
- Implement filters (date range, action type, actor)
- Implement search functionality
- Implement CSV export
- Implement expandable log details
- Use window.api.audit.* for all operations

Stop and ask if:
- Filter combinations are unclear
- Export format requirements are ambiguous
- Performance concerns with large datasets

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. Pagination must work. CI must be green.
```

### EUM-015 Assignment Prompt

```
You are assigned Task EUM-015 – "Portal Integration & QA".

Task file: tasks/enterprise-user-management/EUM-015.md

This is a MERGE GATE task. You must:
1. Ensure all Phase 3 branches are merged into int/phase3-portal
2. Set up admin routes in src/routes/
3. Create AdminLayout and AdminSidebar components
4. Implement permission-based UI visibility
5. Ensure consistent styling throughout
6. Perform accessibility audit
7. Perform QA testing across browsers

Instructions:
- Branch: feat/EUM-015-portal-integration
- Do NOT add new features - integration and QA only
- Do NOT proceed if any Phase 3 task is incomplete

Stop and ask if:
- Any Phase 3 PR is not yet merged
- QA testing reveals design issues
- Accessibility issues require component changes

Complete the Implementation Summary in your task file before opening your PR.
QA checklist must be complete. CI must be green. This gates Phase 4.
```

---

## Phase 4: Provisioning

### EUM-016 Assignment Prompt

```
You are assigned Task EUM-016 – "SCIM 2.0 Server".

Task file: tasks/enterprise-user-management/EUM-016.md

Instructions:
- Branch: feat/EUM-016-scim-server
- Create Supabase Edge Function in supabase/functions/scim/
- Implement all SCIM 2.0 Users endpoints
- Implement bearer token authentication
- Follow SCIM spec for request/response formats
- Follow SCIM spec for error responses
- Support filtering and pagination
- Log all operations to audit service
- Do NOT implement Groups endpoint (out of scope)

Stop and ask if:
- SCIM spec requirements are unclear
- Token authentication patterns are ambiguous
- Supabase Edge Function patterns are unclear

Complete the Implementation Summary in your task file before opening your PR.
SCIM compliance tests must pass. CI must be green.
```

### EUM-017 Assignment Prompt

```
You are assigned Task EUM-017 – "SCIM Token Management UI".

Task file: tasks/enterprise-user-management/EUM-017.md

Instructions:
- Branch: feat/EUM-017-scim-token-ui
- Create React components in src/components/admin/scim/
- Implement token generation (show token ONCE)
- Implement token list with metadata
- Implement token revocation
- Display SCIM endpoint URL
- Include setup instructions for IdPs
- Create electron service for token management

Stop and ask if:
- Token display security is unclear
- Setup instruction content is ambiguous
- Token metadata requirements are unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. Token shown only once. CI must be green.
```

### EUM-018 Assignment Prompt

```
You are assigned Task EUM-018 – "Provisioning Status UI".

Task file: tasks/enterprise-user-management/EUM-018.md

Instructions:
- Branch: feat/EUM-018-provisioning-status-ui
- Create React components in src/components/admin/provisioning/
- Implement overview dashboard with stats
- Implement sync history list
- Implement error log viewer
- Show provisioning source for each user
- Create electron service for provisioning stats

Stop and ask if:
- Stats calculation is unclear
- History display requirements are ambiguous
- Error retry behavior is unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-019 Assignment Prompt

```
You are assigned Task EUM-019 – "Directory Sync Service".

Task file: tasks/enterprise-user-management/EUM-019.md

Instructions:
- Branch: feat/EUM-019-directory-sync
- Create electron/services/directorySyncService.ts
- Implement full sync capability
- Implement incremental sync capability
- Implement orphan user detection
- Implement conflict resolution strategies
- Log all sync operations
- Do NOT implement UI (handled in EUM-018)

Stop and ask if:
- Sync scheduling requirements are unclear
- Conflict resolution rules are ambiguous
- Orphan handling policy is unclear

Complete the Implementation Summary in your task file before opening your PR.
Unit tests required. CI must be green.
```

### EUM-020 Assignment Prompt

```
You are assigned Task EUM-020 – "Final Integration, QA & Release".

Task file: tasks/enterprise-user-management/EUM-020.md

This is the FINAL MERGE GATE task. You must:
1. Ensure all Phase 4 branches are merged into int/phase4-provisioning
2. Perform SCIM compliance testing with Entra ID
3. Perform SCIM compliance testing with Google Workspace
4. Perform full regression testing
5. Perform performance testing (100+ users)
6. Perform security audit
7. Complete all documentation
8. Prepare release notes
9. Configure feature flags
10. Merge to main

Instructions:
- Branch: feat/EUM-020-final-release
- Do NOT add new features - testing and documentation only
- Do NOT proceed if any Phase 4 task is incomplete
- Do NOT merge to main until all validation passes

Stop and ask if:
- Any Phase 4 PR is not yet merged
- Compliance testing reveals issues
- Security audit reveals concerns

Complete the Implementation Summary in your task file before opening your PR.
All validation must pass. Documentation must be complete. Then merge to main.
```

---

## Quick Reference: Branch Names

| Task | Branch Name |
|------|-------------|
| EUM-001 | `feat/EUM-001-database-schema` |
| EUM-002 | `feat/EUM-002-organization-service` |
| EUM-003 | `feat/EUM-003-audit-service` |
| EUM-004 | `feat/EUM-004-rbac-service` |
| EUM-005 | `feat/EUM-005-phase1-integration` |
| EUM-006 | `feat/EUM-006-entra-id-sso` |
| EUM-007 | `feat/EUM-007-google-workspace-sso` |
| EUM-008 | `feat/EUM-008-sso-core-service` |
| EUM-009 | `feat/EUM-009-jit-provisioning` |
| EUM-010 | `feat/EUM-010-sso-integration` |
| EUM-011 | `feat/EUM-011-org-settings-ui` |
| EUM-012 | `feat/EUM-012-team-members-ui` |
| EUM-013 | `feat/EUM-013-sso-config-ui` |
| EUM-014 | `feat/EUM-014-audit-logs-ui` |
| EUM-015 | `feat/EUM-015-portal-integration` |
| EUM-016 | `feat/EUM-016-scim-server` |
| EUM-017 | `feat/EUM-017-scim-token-ui` |
| EUM-018 | `feat/EUM-018-provisioning-status-ui` |
| EUM-019 | `feat/EUM-019-directory-sync` |
| EUM-020 | `feat/EUM-020-final-release` |
