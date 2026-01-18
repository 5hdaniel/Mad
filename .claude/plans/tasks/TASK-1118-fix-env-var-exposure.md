# TASK-1118: Fix Environment Variable Exposure in googleAuthService

**Backlog ID:** BACKLOG-248
**Sprint:** SPRINT-043
**Phase:** 2 (Parallel with TASK-1116)
**Branch:** `fix/task-1115-env-var-exposure`
**Estimated Turns:** 6-10
**Estimated Tokens:** 20K-30K

---

## Objective

Fix the potential environment variable exposure in `googleAuthService.ts` where OAuth credentials (client ID and secret) are loaded via `dotenv` and could theoretically leak to the renderer process through error messages, logs, or other channels.

---

## Context

### Current State

In `electron/services/googleAuthService.ts` (lines 10-14, 75-77):
```typescript
import dotenv from "dotenv";
// ...
dotenv.config({ path: ".env.development" });
// ...
initialize(): void {
  // ...
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
```

The concerns:
1. **dotenv.config() in service file**: Loads env vars into process.env at import time
2. **Credentials in process.env**: Available globally in the main process
3. **Potential leak vectors**:
   - Error messages that include environment context
   - Log statements that might stringify objects with env vars
   - Electron devtools in development mode could inspect main process

### Why This Matters

- OAuth client secrets should be carefully guarded
- If credentials leak to renderer, a compromised renderer could use them
- Defense in depth: minimize exposure surface for sensitive data

### Current Security Measures (Already in Place)

- `contextIsolation: true` prevents direct process.env access from renderer
- Credentials are never intentionally sent to renderer
- Logs use structured logging with explicit field selection

---

## Requirements

### Must Do:
1. Move dotenv.config() to a single, early initialization point (electron/main.ts or dedicated config module)
2. Remove `import dotenv` and `dotenv.config()` from googleAuthService.ts
3. Ensure credentials are only accessed where needed, not stored in class properties
4. Verify no error messages or logs expose the full client secret
5. Consider using a config service that validates and encapsulates credentials

### Must NOT Do:
- Break Google OAuth functionality
- Move credentials to renderer process
- Log credentials (even partially) in error messages
- Create complex abstraction layers - keep it simple
- Change the OAuth flow logic itself

---

## Acceptance Criteria

- [x] dotenv.config() removed from googleAuthService.ts
- [x] Environment variables loaded from a single central location (main.ts)
- [x] No class properties store the full client secret (credentials accessed via process.env only in initialize())
- [x] Error messages don't expose credentials (verified: only says "Missing credentials. Check .env.development file.")
- [x] Log statements verified to not log credentials (only clientIdPrefix logged, not clientSecret)
- [ ] Google OAuth login flow works end-to-end (requires manual testing)
- [ ] Google mailbox connection flow works end-to-end (requires manual testing)
- [ ] All CI tests pass (pending PR)

---

## Files to Modify

- `electron/services/googleAuthService.ts` - Remove dotenv import/config, refactor credential access
- `electron/main.ts` - Ensure dotenv.config() is called early (may already be there)

## Files to Read (for context)

- `electron/main.ts` - Check if dotenv is already loaded here
- `electron/services/microsoftAuthService.ts` - Check if same pattern exists (for consistency)
- `.env.development` - Understand what env vars are expected

---

## Testing Expectations

### Unit Tests
- **Required:** Yes - if any exist for googleAuthService
- **New tests to write:** None - this is a refactor
- **Existing tests to update:** None expected

### Integration Tests
- Google OAuth flow tests should pass unchanged

### Manual Testing Required
1. **Google Login:**
   - Start app with `npm run dev`
   - Log out if logged in
   - Click Google login
   - Complete OAuth flow
   - Verify login succeeds

2. **Google Mailbox Connection:**
   - With a logged-in user
   - Connect Google mailbox
   - Verify connection succeeds
   - Verify emails can be fetched

3. **Error Handling:**
   - Temporarily remove GOOGLE_CLIENT_ID from .env
   - Start app and attempt Google login
   - Verify error message doesn't expose credentials
   - Restore .env

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(security): prevent env var exposure in googleAuthService`
- **Branch:** `fix/task-1115-env-var-exposure`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-01-18*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: Session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: dotenv.config() called in googleAuthService.ts loading .env.development; main.ts only loaded .env.local
- **After**: main.ts loads both .env.development and .env.local centrally; googleAuthService.ts has no dotenv import
- **Actual Turns**: 4 (Est: 6-10)
- **Actual Tokens**: ~15K (Est: 20K-30K)
- **Actual Time**: ~10 min
- **PR**: [Pending]

### Notes

**Deviations from plan:**
- None - followed Option A (simple approach) as recommended

**Issues encountered:**
- Discovered main.ts loaded .env.local but Google credentials were in .env.development
- Solution: Load both files in main.ts (.env.development first, then .env.local for overrides)

**Verification:**
- Error messages verified safe (no credentials logged)
- Log statements verified safe (only clientIdPrefix logged, not clientSecret)
- All 16 googleAuthService tests pass (3x runs, no flakiness)
- Type check passes
- Lint passes (only pre-existing warnings)

---

## Guardrails

**STOP and ask PM if:**
- Google OAuth stops working after changes
- You discover microsoftAuthService has the same pattern and want to fix both
- You find credentials being logged anywhere
- The refactor becomes more complex than expected
- You need to create a new config/credential service
- You encounter blockers not covered in the task file

---

## Technical Notes

### Recommended Approach

**Option A: Simple - Just move dotenv.config() to main.ts**
```typescript
// electron/main.ts (at very top, before other imports)
import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });

// Then in googleAuthService.ts, just remove the dotenv import and config
// process.env.GOOGLE_CLIENT_ID will still work because main.ts loaded it
```

**Option B: Config module (if more structure desired)**
```typescript
// electron/config/env.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });

export const config = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  // ... other config
};
```

Option A is simpler and sufficient for this task. Option B provides more structure but may be overkill.

### Error Message Safety

Current error in googleAuthService.ts (line 78-83):
```typescript
if (!clientId || !clientSecret) {
  logService.error(
    "[GoogleAuth] Missing credentials. Check .env.development file.",
    "GoogleAuth",
  );
  throw new Error("Google OAuth credentials not configured");
}
```

This is already safe - no credentials are logged. Verify this pattern is maintained.

### Log Statement Safety

Check that no log statements use patterns like:
```typescript
// BAD - don't do this
logService.info("Initializing with", { clientId, clientSecret });

// GOOD - only log prefixes if needed
logService.info("Initializing", { clientIdPrefix: clientId.substring(0, 10) + "..." });
```

Current code at line 87-89 is safe:
```typescript
logService.info(
  "[GoogleAuth] Initializing with client ID:",
  "GoogleAuth",
  { clientIdPrefix: clientId.substring(0, 20) + "..." },
);
```
