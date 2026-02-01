# Task TASK-1508A: Fix URL Fragment Token Parsing

**Sprint**: SPRINT-062
**Backlog Item**: N/A (bug fix)
**Status**: In Progress
**Execution**: Sequential (Phase 3, after TASK-1507)

---

## Problem Statement

During TASK-1508 testing, the auth callback fails with "Missing tokens in callback URL" error.

**Error Message:** `Missing tokens in callback URL`

**Root Cause:** Supabase OAuth returns tokens in URL fragment format (`#access_token=...`), but the current code uses `parsed.searchParams.get()` which only reads query parameters (`?access_token=...`).

**Example URLs:**
- What Supabase sends: `magicaudit://callback#access_token=xxx&refresh_token=yyy`
- What code expects: `magicaudit://callback?access_token=xxx&refresh_token=yyy`

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1507 merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `fix/task-1508a-url-fragment-parsing`

---

## Estimated Tokens

**Est. Tokens**: ~15K
**Token Cap**: ~60K (4x estimate)

---

## Root Cause Analysis

**File:** `electron/main.ts` lines 129-130

**Current Code:**
```typescript
const accessToken = parsed.searchParams.get("access_token");
const refreshToken = parsed.searchParams.get("refresh_token");
```

**Problem:** The `URL.searchParams` API only parses query string parameters (after `?`). URL fragments (after `#`) are stored in `URL.hash` property and require manual parsing.

**OAuth 2.0 Background:** The implicit flow returns tokens in the URL fragment for security reasons - fragments are not sent to servers in HTTP requests, only processed client-side.

---

## Implementation Approach

### Option A: Parse Fragment with URLSearchParams (Recommended)

```typescript
// Extract fragment parameters (remove leading #)
const hashParams = new URLSearchParams(parsed.hash.slice(1));
const accessToken = hashParams.get("access_token");
const refreshToken = hashParams.get("refresh_token");
```

### Option B: Support Both Query and Fragment

```typescript
// Try query params first, fall back to fragment
const queryParams = parsed.searchParams;
const hashParams = new URLSearchParams(parsed.hash.slice(1));

const accessToken = queryParams.get("access_token") || hashParams.get("access_token");
const refreshToken = queryParams.get("refresh_token") || hashParams.get("refresh_token");
```

**Recommendation:** Option B is more robust - supports both OAuth flows and handles edge cases where providers might use either format.

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `electron/main.ts` | Modify | Update `handleDeepLinkCallback()` to parse URL fragment |

---

## Implementation Steps

1. Locate `handleDeepLinkCallback()` function in `electron/main.ts`
2. Find lines 129-130 where tokens are extracted
3. Replace with fragment-aware parsing (Option B)
4. Add logging to show which format was used
5. Test with actual Supabase OAuth flow

---

## Verification Steps

### Manual Testing

1. Clear any existing session
2. Click "Sign In with Browser"
3. Complete OAuth in browser
4. Verify app receives callback URL with fragment tokens
5. Verify tokens are parsed correctly
6. Verify auth flow completes successfully

### Logging to Add

```typescript
log.info("[DeepLink] Parsing callback URL", {
  hasQueryParams: !!queryParams.get("access_token"),
  hasHashParams: !!hashParams.get("access_token"),
});
```

---

## Acceptance Criteria

- [x] Tokens in URL fragment (`#access_token=...`) are parsed correctly
- [x] Tokens in query params (`?access_token=...`) still work (backward compatible)
- [x] Appropriate logging shows which format was detected
- [ ] Full auth flow completes with Supabase OAuth (requires manual test)
- [x] `npm run type-check` passes
- [x] `npm run lint` passes (pre-existing unrelated error)

---

## Dependencies

- **Depends on**: TASK-1507 (license validation at auth) must be merged
- **Blocks**: TASK-1508B (env vars fix), TASK-1508 (manual test)

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- The URL format from Supabase differs from expected
- Need to handle other token parameters (e.g., `expires_in`, `token_type`)
- Unclear on error handling for malformed URLs

---

## PR Preparation

**Title**: `fix: parse OAuth tokens from URL fragment`

**Labels**: `sprint-062`, `bug`, `auth`

**PR Body Template**:
```markdown
## Summary
- Fix "Missing tokens in callback URL" error
- Parse OAuth tokens from URL fragment (`#access_token=...`)
- Maintain backward compatibility with query params

## Root Cause
Supabase OAuth returns tokens in URL fragment, but code used `searchParams.get()` which only reads query parameters.

## Test Plan
- [ ] OAuth with Supabase Google provider completes successfully
- [ ] Tokens parsed from URL fragment
- [ ] Auth flow proceeds to license validation
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | PM Agent | ___________ | ___K | Pending |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Pending |
| 3. Implement | Engineer Agent | ___________ | ___K | Pending |
| 4. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

### Files Changed
- [x] `electron/main.ts` - Updated token parsing in `handleDeepLinkCallback()` function

### Approach Taken
Implemented Option B from the task spec (support both query and fragment):

1. Added `hashParams` parsing using `new URLSearchParams(parsed.hash.slice(1))` when hash exists
2. Token extraction now tries query params first, falls back to hash params
3. Added logging to show which format was detected for debugging

**Code change (lines 128-140):**
```typescript
// TASK-1508A: Parse tokens from both query params AND URL fragment
const hashParams = parsed.hash ? new URLSearchParams(parsed.hash.slice(1)) : null;
const accessToken = parsed.searchParams.get("access_token") || hashParams?.get("access_token");
const refreshToken = parsed.searchParams.get("refresh_token") || hashParams?.get("refresh_token");

// Log which format was detected for debugging
log.info("[DeepLink] Parsing callback URL", {
  hasQueryParams: !!parsed.searchParams.get("access_token"),
  hasHashParams: !!hashParams?.get("access_token"),
});
```

### Testing Done
- [x] TypeScript type-check passes
- [x] ESLint passes (pre-existing unrelated error in NotificationContext.tsx)
- [x] All auth/license tests pass (224 tests)
- [ ] Manual OAuth flow tested (requires manual test)

### Notes for SR Review
- Backward compatible: still supports query params (`?access_token=...`)
- Now also supports fragments (`#access_token=...`) which Supabase OAuth uses
- Null-safe: `hashParams?.get()` handles case when no hash present
- Added descriptive logging for debugging token format detection
