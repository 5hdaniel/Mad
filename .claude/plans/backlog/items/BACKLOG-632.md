# BACKLOG-632: SCIM 2.0 Edge Function

**Priority:** Medium
**Category:** service
**Status:** Pending
**Sprint:** SPRINT-074

## Description

Create a Supabase Edge Function implementing SCIM 2.0 user provisioning (POST/GET/PATCH/DELETE /Users). Azure AD will call this endpoint to automatically create, update, and deactivate users in Magic Audit. Auth via bearer token validated against `scim_tokens` table.

## Acceptance Criteria

- [ ] All CRUD operations on /Users work per SCIM spec
- [ ] Bearer token auth validated against scim_tokens
- [ ] All operations logged in scim_sync_log
- [ ] DELETE = soft-delete (suspend, not hard delete)

## Task File

`.claude/plans/tasks/TASK-1931-scim-edge-function.md`

## Related

- BACKLOG-376: SCIM User Provisioning & Role Management
- SPRINT-070: SSO/SCIM Schema (tables already exist)
