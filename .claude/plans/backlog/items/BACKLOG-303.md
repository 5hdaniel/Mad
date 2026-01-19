# BACKLOG-303: Centralize dotenv.config() in supabaseService.ts

## Status: COMPLETE
## Completed: 2026-01-18
## PR: #466
## Priority: Low
## Category: Security / Code Quality
## Estimated Tokens: ~3K

---

## Problem Statement

`supabaseService.ts` still has its own `dotenv.config()` call. For consistency with the centralization pattern established in TASK-1118 (which centralized `googleAuthService.ts`), this should also be centralized to `electron/main.ts`.

## Current Behavior

`supabaseService.ts` calls `dotenv.config()` directly within the service file, similar to how `googleAuthService.ts` previously did before TASK-1118.

## Expected Behavior

Environment variables should be loaded once in `electron/main.ts` at application startup, and `supabaseService.ts` should rely on that centralized initialization rather than calling `dotenv.config()` itself.

## Proposed Solution

1. Remove the `dotenv.config()` call from `supabaseService.ts`
2. Ensure `electron/main.ts` loads environment variables early enough for Supabase initialization
3. Verify Supabase client initialization still works correctly

## Affected Files

- `electron/services/supabaseService.ts` - Remove `dotenv.config()` call
- `electron/main.ts` - Verify centralized `dotenv.config()` is loaded early enough

## Acceptance Criteria

- [ ] `dotenv.config()` call removed from `supabaseService.ts`
- [ ] Supabase client initializes correctly using env vars from centralized config
- [ ] No regression in cloud sync functionality
- [ ] Pattern consistent with TASK-1118 (googleAuthService.ts centralization)

## Related

- **TASK-1118**: Centralized dotenv.config() in googleAuthService.ts
- **BACKLOG-248**: Original security audit that identified scattered dotenv calls

## Notes

This is a low-priority consistency improvement. It is not a security risk since the env vars are the same regardless of where `dotenv.config()` is called, but centralizing makes the codebase more maintainable and follows the established pattern.
