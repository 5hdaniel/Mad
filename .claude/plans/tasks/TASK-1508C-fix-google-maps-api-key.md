# TASK-1508C: Fix Google Maps API Key in Packaged Builds

**Sprint:** SPRINT-062
**Backlog Item:** Follow-up to TASK-1508B
**Priority:** P2 (Not blocking core functionality)
**Estimated Tokens:** ~10K
**Execution:** Parallel (can be done alongside TASK-1507E)

---

## Context

User reported "No Google Maps API key configured" error. This is the same class of issue as TASK-1508B (env vars undefined in packaged builds), but for a different env var.

### Error Message

```
Google Maps API key not configured
```

### Location

```typescript
// electron/services/addressVerificationService.ts:76
this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || null;
```

---

## Root Cause

TASK-1508B fixed `SUPABASE_URL` and `SUPABASE_KEY` by embedding them at build time. However, `GOOGLE_MAPS_API_KEY` was not included in that fix.

In development, `process.env.GOOGLE_MAPS_API_KEY` works because `dotenv` loads the `.env` file. In packaged builds, `dotenv.config()` cannot find the `.env` file, so the env var is undefined.

---

## Solution

Add `GOOGLE_MAPS_API_KEY` to the build-time embedding in the same pattern as TASK-1508B.

### Check TASK-1508B Implementation

1. Find where SUPABASE vars are embedded (likely `vite.main.config.ts` or similar)
2. Add `GOOGLE_MAPS_API_KEY` to the same list
3. Verify it's available in `addressVerificationService.ts`

---

## Acceptance Criteria

- [ ] Google Maps API key available in packaged builds
- [ ] Address verification works in packaged app
- [ ] Env var not exposed in frontend bundle (security)

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `vite.main.config.ts` (or equivalent) | Modify | Add GOOGLE_MAPS_API_KEY to define |
| `electron/services/addressVerificationService.ts` | Verify | May need to use embedded config pattern |

---

## Branch Information

**Branch From:** `project/licensing-and-auth-flow`
**Branch Into:** `project/licensing-and-auth-flow`
**Branch Name:** `fix/task-1508c-google-maps-api-key`

---

## Notes

This is lower priority than TASK-1507E because:
1. Google Places API is used for address verification, not core auth/licensing
2. Core functionality (email connection, imports) blocked by TASK-1507E
3. Can be done in parallel if resources available

---

## Implementation Summary

*(To be filled by Engineer)*

### Changes Made
- [ ] ...

### Agent ID
- Engineer: _(record on assignment)_
