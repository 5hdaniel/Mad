# RLS Audit Summary

**Task:** BACKLOG-419
**Date:** 2026-01-24
**Status:** Complete

## Overview

This document summarizes the Row Level Security (RLS) audit for the Keepr B2B Broker Portal. The audit ensures brokers can:
- Read submissions for their organization
- Update submission status (approve/reject/needs_changes)
- Read/write submission attachments
- View messages and create comments

## Tables with RLS Enabled

| Table | RLS Status |
|-------|------------|
| `profiles` | Enabled |
| `organizations` | Enabled |
| `organization_members` | Enabled |
| `transaction_submissions` | Enabled |
| `submission_messages` | Enabled |
| `submission_attachments` | Enabled |
| `submission_comments` | Enabled |

## Policy Summary by Table

### profiles

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `users_can_read_own_profile` | Own profile only |
| UPDATE | `users_can_update_own_profile` | Own profile only |
| INSERT | Via trigger | SECURITY DEFINER |
| ALL | `service_role_full_access_profiles` | Service role |

### organizations

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `members_can_read_org` | Organization members |
| UPDATE | `admins_can_modify_org` | Admin/IT Admin only |
| ALL | `service_role_full_access_organizations` | Service role |

### organization_members

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `members_can_read_org_members` | Members can see other members |
| ALL | `admins_can_manage_members` | Admin/IT Admin |
| UPDATE | `users_can_accept_invite` | Invited user (by email match) |
| ALL | `service_role_full_access_members` | Service role |

### transaction_submissions

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `agents_can_read_own_submissions` | Own submissions |
| SELECT | `brokers_can_read_org_submissions` | Broker/Admin in org |
| INSERT | `agents_can_create_submissions` | Org members |
| UPDATE | `agents_can_update_own_submissions` | Owner when status='needs_changes' |
| UPDATE | `brokers_can_review_submissions` | Broker/Admin in org |
| ALL | `service_role_full_access_submissions` | Service role |

### submission_messages

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `message_access_via_submission` | Via parent submission access |
| INSERT | `agents_can_insert_messages` | Owner of parent submission |
| ALL | `service_role_full_access_messages` | Service role |

### submission_attachments

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `attachment_access_via_submission` | Via parent submission access |
| INSERT | `agents_can_insert_attachments` | Owner of parent submission |
| ALL | `service_role_full_access_attachments` | Service role |

### submission_comments

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `comment_access_via_submission` | Via parent (internal=broker only) |
| INSERT | `users_can_create_comments` | Users with submission access |
| ALL | `service_role_full_access_comments` | Service role |

## Storage Bucket Policies

**Bucket:** `submission-attachments`
**Path Convention:** `{org_id}/{submission_id}/{filename}`

| Operation | Policy | Who Can Access |
|-----------|--------|----------------|
| SELECT | `Members can view submission attachments` | Org members |
| INSERT | `Members can upload submission attachments` | Org members |
| UPDATE | `Members can update submission attachments` | Org members |
| DELETE | `Admins can delete submission attachments` | Admin/IT Admin |

## Broker Access Matrix

| Action | Required Policy | Status |
|--------|-----------------|--------|
| View org submissions | `brokers_can_read_org_submissions` | OK |
| Approve/reject submission | `brokers_can_review_submissions` | OK |
| View submission messages | `message_access_via_submission` | OK |
| View submission attachments | `attachment_access_via_submission` | OK |
| Download storage files | `Members can view submission attachments` | OK |
| Create comments | `users_can_create_comments` | OK |
| View internal comments | `comment_access_via_submission` (broker check) | OK |

## Migration Files

1. **`20260122_b2b_broker_portal.sql`** - Creates tables and initial RLS policies
2. **`20260122_storage_bucket_policies.sql`** - Storage bucket RLS
3. **`20260123_fix_attachment_rls.sql`** - Fixes attachment RLS with EXISTS pattern
4. **`20260123_rls_audit.sql`** - Comprehensive RLS audit (application tables)
5. **`20260124_rls_restore_complete.sql`** - Complete restoration including storage (idempotent)

## Verification Queries

Run these queries in Supabase SQL Editor to verify RLS is configured:

```sql
-- Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'profiles', 'organizations', 'organization_members',
  'transaction_submissions', 'submission_messages',
  'submission_attachments', 'submission_comments'
);

-- List all policies by table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN (
  'profiles', 'organizations', 'organization_members',
  'transaction_submissions', 'submission_messages',
  'submission_attachments', 'submission_comments'
)
ORDER BY tablename, policyname;

-- List storage policies
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';
```

## Known Issues Fixed

1. **Attachment RLS using IN instead of EXISTS** - Fixed in `20260123_fix_attachment_rls.sql`
   - Original policy had potential RLS recursion issues
   - Changed to EXISTS pattern for reliable broker access

2. **Storage policies not idempotent** - Fixed in `20260124_rls_restore_complete.sql`
   - Original `20260122_storage_bucket_policies.sql` lacked DROP IF EXISTS
   - Now uses DROP IF EXISTS before CREATE for safe re-runs

3. **Missing storage policies in RLS audit** - Fixed in `20260124_rls_restore_complete.sql`
   - `20260123_rls_audit.sql` only covered application tables
   - New migration includes storage bucket policies

## Login Flow Impact

The login flow uses these tables:
1. `auth.users` (Supabase managed - no custom RLS)
2. `profiles` (auto-created via trigger with SECURITY DEFINER)
3. `organization_members` (checked for org membership)

**No impact on login flow** - The trigger uses SECURITY DEFINER to bypass RLS during profile creation, and the initial membership lookup uses service role.
