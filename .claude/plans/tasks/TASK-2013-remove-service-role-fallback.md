# TASK-2013: Remove Supabase service_role key fallback from client app

**Backlog ID:** BACKLOG-739
**Sprint:** SPRINT-088
**Phase:** Phase 1 (Parallel - low risk, isolated)
**Branch:** `fix/task-2013-remove-service-role-fallback`
**Estimated Tokens:** ~5K

---

## Objective

Remove the `|| process.env.SUPABASE_SERVICE_KEY` fallback from the Supabase client initialization in `supabaseService.ts`. The service_role key bypasses all Row Level Security (RLS) policies and must never exist in a client-side application. This is a security hardening fix.

---

## Context

### Investigation Findings

- **File:** `electron/services/supabaseService.ts` line 110
- **Current code:** `const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;`
- **Comment at top of file (line 4):** `* Currently uses service_role key for development`
- **Risk:** If `SUPABASE_ANON_KEY` is ever unset (e.g., bad `.env` file), the app silently falls back to the service_role key, bypassing all RLS. This is a privilege escalation vulnerability.

### Related Test Files

- `electron/services/__tests__/supabaseService.test.ts` -- lines 46, 109-125 reference `SUPABASE_SERVICE_KEY`
- `electron/services/__tests__/supabaseService.conflict.test.ts` -- line 38 sets `SUPABASE_SERVICE_KEY`

---

## Requirements

### Must Do

1. **Remove the `|| process.env.SUPABASE_SERVICE_KEY` fallback** on line 110 of `supabaseService.ts`
2. **Update the file header comment** (line 4) to remove the mention of service_role key for development
3. **Add a guard:** If `SUPABASE_ANON_KEY` is not set, throw an explicit error at startup rather than silently falling back
4. **Update test files** to remove references to `SUPABASE_SERVICE_KEY` as a valid fallback
5. **Verify no other files reference `SUPABASE_SERVICE_KEY`** in production code

### Must NOT Do

- Do NOT remove `SUPABASE_SERVICE_KEY` from `.env.example` if it exists (server-side tooling may use it)
- Do NOT modify any Supabase cloud configuration
- Do NOT change the anon key itself

### Acceptance Criteria

- [ ] `supabaseService.ts` only uses `SUPABASE_ANON_KEY` (no fallback)
- [ ] Missing anon key throws a clear error at initialization time
- [ ] All existing tests pass (update mocks as needed)
- [ ] `npm run type-check` passes
- [ ] `npm test` passes

---

## Files to Modify

| File | Change |
|------|--------|
| `electron/services/supabaseService.ts` | Remove fallback, add guard, update comment |
| `electron/services/__tests__/supabaseService.test.ts` | Update tests that rely on SERVICE_KEY fallback |
| `electron/services/__tests__/supabaseService.conflict.test.ts` | Remove SERVICE_KEY setup if present |

---

## Implementation Summary

| Field | Value |
|-------|-------|
| Agent ID | (auto-captured) |
| Branch | fix/task-2013-remove-service-role-fallback |
| PR | TBD |
| Files Changed | 3 |
| Tests Added/Modified | 2 test files updated |
| Actual Tokens | ~5K |

### Changes Made

1. **`electron/services/supabaseService.ts`**:
   - Updated file header comment to remove service_role key mention
   - Removed `|| process.env.SUPABASE_SERVICE_KEY` fallback from line 110
   - Enhanced error message to list which specific env vars are missing (SUPABASE_URL and/or SUPABASE_ANON_KEY)

2. **`electron/services/__tests__/supabaseService.test.ts`**:
   - Changed `SUPABASE_SERVICE_KEY` env setup to `SUPABASE_ANON_KEY` (line 46)
   - Updated "missing credentials" test to save/restore `SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_KEY` (lines 105-126)

3. **`electron/services/__tests__/supabaseService.conflict.test.ts`**:
   - Changed `SUPABASE_SERVICE_KEY` env setup to `SUPABASE_ANON_KEY` (line 38)

### Verification

- `npm run type-check`: PASS
- `supabaseService.test.ts`: 39/39 PASS
- `supabaseService.conflict.test.ts`: 9 pre-existing failures (confirmed identical on base branch), 6 PASS
- Lint: PASS
- No other production code references to `SUPABASE_SERVICE_KEY` (only docs, CI configs, and server-side Edge Functions)

### Deviations

None.

### Issues/Blockers

None.
