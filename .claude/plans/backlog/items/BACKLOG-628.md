# BACKLOG-628: Admin Consent Migration - Graph API Consent Columns

**Priority:** High
**Category:** schema
**Status:** Pending
**Sprint:** SPRINT-074

## Description

Add `graph_admin_consent_granted` (BOOLEAN) and `graph_admin_consent_at` (TIMESTAMPTZ) columns to the `organizations` table to track whether the IT admin has granted admin consent for the desktop app's Graph API permissions.

## Acceptance Criteria

- [ ] Both columns exist on organizations table
- [ ] Default value is false/null
- [ ] Migration applies cleanly

## Task File

`.claude/plans/tasks/TASK-1928-consent-migration.md`
