# BACKLOG-551: Unify User IDs in Supabase (public.users vs auth.users)

## Status
- **Priority**: P1
- **Type**: Technical Debt
- **Status**: open
- **Created**: 2026-01-27
- **Sprint**: -
- **Related**: TASK-1507G (local SQLite fix)

## Problem

Same ID mismatch issue as TASK-1507G, but on the **Supabase cloud side**:

| Table | ID Example | Source |
|-------|------------|--------|
| `auth.users` | `67614fc0-1be2-474d-8c99-58305472736a` | Supabase Auth |
| `public.users` | `388d5ad0-f7eb-4d0f-8f8e-c4b5d20fcbfa` | Auto-generated UUID |

This causes RLS policy violations because:
- RLS policies use `auth.uid()` which returns the auth.users ID
- Application code uses public.users.id which is different
- INSERT/UPDATE operations fail RLS checks

**Current patch:** `supabaseService.registerDevice()` now fetches auth session and uses `auth.uid()` directly.

## Proposed Fix

Align `public.users.id` with `auth.users.id`:

1. **New users:** Create public.users with `id = auth.uid()`
2. **Existing users:** Migration to update IDs (similar to TASK-1507G)
3. **FK updates:** Update all child tables (devices, user_licenses, etc.)

## Affected Tables

| Table | FK Column | Notes |
|-------|-----------|-------|
| `public.users` | `id` (PK) | Must match auth.uid() |
| `devices` | `user_id` | RLS uses auth.uid() |
| `user_licenses` | `user_id` | RLS uses auth.uid() |
| `device_registrations` | `user_id` | If exists |

## Implementation Notes

- This is the cloud-side equivalent of TASK-1507G
- Requires Supabase migration
- May need to update `supabaseService.upsertUser()` to use auth.uid()
- Consider using Supabase triggers to auto-create public.users on auth.users insert

## Acceptance Criteria

- [ ] public.users.id = auth.users.id for all users
- [ ] New user creation uses auth.uid() as ID
- [ ] Existing users migrated
- [ ] All RLS policies pass without patches
- [ ] Remove patch from supabaseService.registerDevice()
