# Task TASK-1508B: Fix Env Vars for Packaged Builds

**Sprint**: SPRINT-062
**Backlog Item**: N/A (bug fix)
**Status**: Pending
**Execution**: Sequential (Phase 3, after TASK-1508A)

---

## Problem Statement

During TASK-1508 testing in packaged builds, the auth flow fails with "Authentication not configured" error.

**Error Message:** `Authentication not configured`

**Root Cause:** The code uses `process.env.SUPABASE_URL` which is loaded via `dotenv.config()` in development. In packaged Electron apps, `.env` files are not bundled and `dotenv` cannot find them because the path is relative to the source directory, not the packaged app resources.

**Affected Files:**
- `electron/main.ts` - Uses dotenv with incorrect path for packaged builds
- `electron/services/supabaseService.ts` - Uses `process.env.SUPABASE_URL` and `SUPABASE_SERVICE_KEY`

---

## Branch Information

**Branch From**: `project/licensing-and-auth-flow` (after TASK-1508A merged)
**Branch Into**: `project/licensing-and-auth-flow`
**Branch Name**: `fix/task-1508b-env-vars-packaged`

---

## Estimated Tokens

**Est. Tokens**: ~20K
**Token Cap**: ~80K (4x estimate)

---

## Root Cause Analysis

**File:** `electron/main.ts` lines 41-43

**Current Code:**
```typescript
// Load environment files: .env.development first (OAuth credentials), then .env.local for overrides
dotenv.config({ path: path.join(__dirname, "../.env.development") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });
```

**Problem:** In packaged builds:
1. `__dirname` points to `Resources/app.asar/dist-electron/` or similar
2. `../.env.development` does not exist in the packaged app
3. Environment variables are undefined

**File:** `electron/services/supabaseService.ts` lines 104-105

**Current Code:**
```typescript
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Using service_role for now
```

**Security Concern:** `SUPABASE_SERVICE_KEY` is a service role key that bypasses RLS. It is NOT safe to embed in client apps. This must be addressed as part of this fix.

---

## Implementation Approach

### Recommended: extraResources + dotenv path detection

Use `app.isPackaged` to determine the correct `.env` file path:

**Development:** Load from project root (existing behavior)
**Production:** Load from `process.resourcesPath` (extraResources folder)

```typescript
import { app } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

// Determine env file path based on packaged vs development
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env.production')
  : path.join(__dirname, '../.env.development');

dotenv.config({ path: envPath });

// Also load .env.local for local overrides (dev only)
if (!app.isPackaged) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}
```

**Why this approach:**
- Maintains existing dotenv pattern
- Works with existing CI/CD (just add `.env.production` to extraResources)
- Electron main process uses `tsc`, NOT Vite - no `define` option available
- Simple, testable, debuggable

---

## Security: SUPABASE_SERVICE_KEY Concern

**Problem:** `SUPABASE_SERVICE_KEY` is a service role key with full database access. It should NEVER be embedded in client applications.

**Current Usage in `supabaseService.ts`:**
```typescript
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Using service_role for now
```

**Resolution Options:**

### Option A: Replace with Anon Key (Recommended for this task)

The TODO comment suggests this is temporary. For auth flows, the anon key is sufficient:

```typescript
const supabaseKey = process.env.SUPABASE_ANON_KEY;
```

This is safe to embed - anon key is designed for client-side use.

### Option B: Keep Service Key Server-Side Only

If service key operations are needed, they should be:
1. Moved to Supabase Edge Functions
2. Called via API from the client

**For this task:** Use Option A. Document that any service-key-requiring operations need to be moved to Edge Functions in a future task.

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `electron/main.ts` | Modify | Update dotenv path logic for packaged builds |
| `electron/services/supabaseService.ts` | Modify | Replace SUPABASE_SERVICE_KEY with SUPABASE_ANON_KEY |
| `package.json` | Modify | Add `.env.production` to extraResources |
| `.env.production` | Create | Production environment file (public vars only) |
| `.gitignore` | Verify | Ensure `.env.production` is NOT gitignored (public vars are OK) |

---

## Implementation Steps

### Step 1: Audit Env Var Usage

Find all `process.env` usage in electron code:
```bash
grep -r "process.env" electron/ --include="*.ts"
```

Document which variables are needed and classify as public/secret.

### Step 2: Create `.env.production`

Create a production environment file with PUBLIC variables only:

```env
# .env.production - PUBLIC variables for packaged builds
# SAFE TO COMMIT - these are client-safe values

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# DO NOT add secrets here:
# - No SUPABASE_SERVICE_KEY
# - No database connection strings
# - No API secrets
```

### Step 3: Update `electron/main.ts`

Update dotenv loading to handle packaged builds:

```typescript
import { app } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
// In development: Load from project root
// In production: Load from app resources (bundled via extraResources)
if (app.isPackaged) {
  const envPath = path.join(process.resourcesPath, '.env.production');
  dotenv.config({ path: envPath });
  log.info('[Env] Loaded production env from:', envPath);
} else {
  // Development: load .env.development first, then .env.local for overrides
  dotenv.config({ path: path.join(__dirname, '../.env.development') });
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}
```

**Note:** This must come BEFORE any code that uses `process.env` values.

### Step 4: Update `electron/services/supabaseService.ts`

Replace service key with anon key:

```typescript
initialize(): void {
  if (this.initialized) {
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY; // Changed from SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    logService.error(
      "[Supabase] Missing credentials. Check environment configuration.",
      "Supabase"
    );
    throw new Error("Supabase credentials not configured");
  }

  // ... rest of initialization
}
```

Add TODO comment for future service key migration:

```typescript
// TODO: Service-role operations should be moved to Supabase Edge Functions
// The anon key is used here for client-safe operations
// See BACKLOG-XXX for Edge Function migration plan
```

### Step 5: Update `package.json` extraResources

Add `.env.production` to electron-builder extraResources:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources/win",
        "to": "win",
        "filter": ["**/*"]
      },
      {
        "from": ".env.production",
        "to": ".env.production"
      }
    ]
  }
}
```

### Step 6: Verify `.gitignore`

Ensure `.env.production` is NOT ignored (it contains public values):

```
# .gitignore should NOT include:
# .env.production

# Should still ignore:
.env
.env.local
.env.development.local
```

---

## Verification Steps

### Development Testing

1. Run `npm run dev`
2. Verify auth flow works (uses `.env.development`)
3. Check console for `[Env] Loaded` message

### Production Build Testing

1. Create `.env.production` with valid public credentials
2. Run `npm run package:dev` (unsigned local build)
3. Launch packaged app
4. Check log file for `[Env] Loaded production env from: ...`
5. Click "Sign In with Browser"
6. Verify browser opens with correct Supabase URL
7. Complete OAuth flow
8. Verify callback is received

### Security Verification

1. Verify `.env.production` contains ONLY public variables
2. Verify no `SUPABASE_SERVICE_KEY` in packaged app
3. Search packaged app for any secrets: `strings MagicAudit.app/Contents/Resources/* | grep -i "service_key"`

---

## Acceptance Criteria

- [ ] Auth flow works in development mode
- [ ] Auth flow works in packaged/production builds
- [ ] No "Authentication not configured" error
- [ ] `SUPABASE_SERVICE_KEY` is NOT embedded in packaged app
- [ ] `SUPABASE_ANON_KEY` is used instead (client-safe)
- [ ] `.env.production` is in extraResources
- [ ] Logging indicates which env file was loaded
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Packaged app tested manually

---

## Dependencies

- **Depends on**: TASK-1508A (URL fragment parsing) must be merged
- **Blocks**: TASK-1508 (manual test of full flow)

---

## Security Considerations

- **Supabase Anon Key:** This is a public key by design - safe to embed
- **Supabase URL:** Public project URL - safe to embed
- **CRITICAL - DO NOT embed:**
  - `SUPABASE_SERVICE_KEY` (bypasses RLS)
  - Database connection strings
  - OAuth client secrets
  - Any API secrets

---

## Future Work (Out of Scope)

If the app needs service-role operations in the future:
1. Create Supabase Edge Functions for those operations
2. Call Edge Functions from client via `supabase.functions.invoke()`
3. Service key stays server-side only

Create backlog item for this if needed.

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Existing code depends on service key operations that will break
- Other secrets found in electron code that need handling
- Build configuration conflicts with existing setup
- `.env.production` should contain values PM needs to provide

---

## PR Preparation

**Title**: `fix: use dotenv with extraResources for packaged build env vars`

**Labels**: `sprint-062`, `bug`, `auth`, `build`, `security`

**PR Body Template**:
```markdown
## Summary
- Fix "Authentication not configured" error in packaged builds
- Use `app.isPackaged` and `process.resourcesPath` to locate env file
- Add `.env.production` to extraResources in electron-builder config
- Replace `SUPABASE_SERVICE_KEY` with `SUPABASE_ANON_KEY` (security fix)

## Root Cause
In packaged builds, `dotenv.config()` could not find `.env.development` because the
path was relative to source directory, not the packaged app resources.

## Security Note
Removed usage of `SUPABASE_SERVICE_KEY` in client code. Service role keys should
never be embedded in client applications. The anon key is used instead, which is
designed for client-side use.

## Test Plan
- [ ] Dev mode: auth flow works
- [ ] Packaged build: auth flow works
- [ ] Verified no secrets in packaged app
- [ ] Log shows correct env file loaded
```

---

## Workflow Progress

### Agent ID Tracking (MANDATORY)

| Step | Agent Type | Agent ID | Tokens | Status |
|------|------------|----------|--------|--------|
| 1. Plan | PM Agent | ___________ | ___K | Complete |
| 2. SR Review | SR Engineer Agent | ___________ | ___K | Complete |
| 3. Implement | Engineer Agent | ___________ | ___K | Pending |
| 4. PM Update | PM Agent | ___________ | ___K | Pending |

---

## Implementation Summary

*To be completed by Engineer Agent after implementation*

### Files Changed
- [ ] `electron/main.ts` - Updated dotenv path logic
- [ ] `electron/services/supabaseService.ts` - Replaced service key with anon key
- [ ] `package.json` - Added extraResources entry
- [ ] `.env.production` - Created production env file
- [ ] `.gitignore` - Verified (no changes needed if already correct)

### Approach Taken
*Describe the implementation approach*

### Testing Done
- [ ] TypeScript type-check passes
- [ ] ESLint passes
- [ ] Dev mode tested
- [ ] Packaged build tested
- [ ] Security verification (no secrets in bundle)

### Notes for SR Review
*Any notes or considerations*
