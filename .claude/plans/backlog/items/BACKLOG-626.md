# BACKLOG-626: JIT Join Organization RPC

**Priority:** Critical
**Category:** schema
**Status:** Pending
**Sprint:** SPRINT-074

## Description

Create a `jit_join_organization` Supabase RPC function that allows authenticated Azure AD users from a known tenant to automatically join the existing organization with the org's `default_member_role`. This replaces the dangerous auto-provision-as-IT-admin behavior that caused the Madison incident.

## Acceptance Criteria

- [ ] RPC function exists and returns success/failure with org info
- [ ] Known tenant -> join with default_member_role
- [ ] Unknown tenant -> return org_not_found error
- [ ] Idempotent (no duplicate memberships)

## Task File

`.claude/plans/tasks/TASK-1925-jit-join-rpc.md`

## Related

- Incident: Madison Del Vigo ended up in wrong org
- TASK-1818: IT Admin Setup Flow (predecessor)
- SPRINT-070: SSO/SCIM Schema (deployed schema)
