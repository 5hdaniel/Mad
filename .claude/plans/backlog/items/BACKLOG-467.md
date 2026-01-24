# BACKLOG-467: Sync AI Add-on License from Supabase

## Status
- **State**: backlog
- **Priority**: high
- **Complexity**: medium
- **Created**: 2026-01-24

## Description

The AI detection add-on (`ai_detection_enabled`) is currently only stored in the local SQLite database with no cloud sync from Supabase. This means:

1. The AI add-on flag doesn't persist across devices
2. There's no central management of who has the AI add-on
3. License changes require manual database updates

## Current State

- `ai_detection_enabled` exists in local `users_local` table (SQLite)
- License handlers read from local DB or session
- No Supabase table/column for AI add-on exists
- Dev toggle handler added for testing (`license:dev:toggle-ai-addon`)

## Requirements

### Backend (Supabase)

1. Add `ai_detection_enabled` column to appropriate table:
   - Option A: Add to `users` table (simple, per-user)
   - Option B: Add to `organizations.settings` JSONB (org-wide)
   - Option C: Create new `user_licenses` table with add-ons (flexible)

2. Add RLS policies for the new field

### Desktop App

1. Sync AI add-on status during login (from Supabase to local)
2. Update `getLicenseData()` to check Supabase if not in session
3. Handle license refresh when add-on is purchased/changed
4. Remove or guard the dev toggle handler (don't ship to production)

## Acceptance Criteria

- [ ] AI add-on status is stored in Supabase
- [ ] Desktop app syncs AI add-on on login
- [ ] License refresh updates AI add-on status
- [ ] Admin can enable/disable AI add-on for users
- [ ] Dev toggle handler is removed or guarded

## Technical Notes

Current files involved:
- `electron/license-handlers.ts` - License IPC handlers
- `electron/services/sessionService.ts` - Session management
- `electron/services/db/userDbService.ts` - Local user DB
- `src/contexts/LicenseContext.tsx` - Frontend license state

## Related

- BACKLOG-426: License model design (base license types)
- BACKLOG-427: LicenseGate component
