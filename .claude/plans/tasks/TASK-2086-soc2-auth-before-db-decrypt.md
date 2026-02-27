# Task TASK-2086: SOC 2 CC6.1 - Validate Auth Token Before Database Decryption

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Backlog Item

**BACKLOG-816:** SOC 2 CC6.1: Validate auth token BEFORE database decryption

## Relationship to TASK-2085

**TASK-2085 is a subset of this task.** TASK-2085 adds `auth.getUser()` after `setSession()` within the existing Phase 3 (loading-auth), which runs AFTER the DB is already decrypted. That prevents a brief UI flash but does NOT address the SOC 2 compliance gap: the database is already decrypted and all data is in memory before auth validation occurs.

This task (TASK-2086) is the comprehensive refactor that reorders the boot sequence so auth validation happens BEFORE DB decryption. TASK-2085 can be implemented first as a quick win (it is independently valuable), but this task is the full solution.

---

## Investigation Findings

### 1. Session Storage Architecture

**Session tokens are stored in TWO places:**

| Store | File | Contents | Encrypted By |
|-------|------|----------|--------------|
| **session.json** | `{userData}/session.json` | User profile, sessionToken, provider, Supabase access/refresh tokens, expiry | `safeStorage` (OS Keychain / DPAPI) |
| **sessions table** | Inside `mad.db` (encrypted SQLite) | session_token, user_id, expires_at, timestamps | SQLCipher (AES-256, key in Keychain) |

**Key finding:** `session.json` exists OUTSIDE the encrypted database and is independently readable (encrypted by `safeStorage`, not by the DB encryption key). The Supabase access/refresh tokens live in `session.json` as `supabaseTokens.access_token` and `supabaseTokens.refresh_token`.

**This means we CAN validate the Supabase session before opening the DB**, because:
1. `session.json` can be read via `sessionService.loadSession()` -- this only uses `safeStorage.decryptString()`, NOT the database
2. `supabaseService.getClient()` auto-initializes via `_ensureClient()` and only needs environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) -- NO database dependency
3. `auth.setSession()` + `auth.getUser()` are pure HTTPS calls to Supabase -- NO local DB needed

### 2. Current Boot Sequence (The Problem)

```
LoadingOrchestrator phases (src/appCore/state/machine/LoadingOrchestrator.tsx):

Phase 1: checking-storage
  -> hasEncryptionKeyStore() -- checks if db-key-store.json exists (file check only)
  -> Dispatches STORAGE_CHECKED

Phase 2: initializing-db
  -> initializeSecureStorage() -> initializeDatabase()
     -> databaseEncryptionService.getEncryptionKey() -- reads Keychain, decrypts key
     -> databaseService.initialize() -- opens mad.db with SQLCipher key
     *** ALL DATA NOW IN MEMORY (contacts, emails, texts, transactions) ***
     -> auditService.initialize()
     -> Worker pool initialized (gets raw DB path + encryption key)
     -> User verified/created in local DB
  -> Dispatches DB_INIT_COMPLETE

Phase 3: loading-auth
  -> handleGetCurrentUser()
     -> databaseService.isInitialized() check
     -> sessionService.loadSession() -- reads session.json (safeStorage)
     -> databaseService.validateSession() -- queries sessions table in DB
     -> sessionSecurityService.checkSessionValidity() -- checks expiry/inactivity
     -> supabaseService.getClient().auth.setSession() -- restores SDK session
     *** ONLY NOW: If setSession fails with "expired"/"invalid", clears session ***
     *** TASK-2085 adds: auth.getUser() call here for server-side validation ***
  -> Dispatches AUTH_LOADED

Phase 4: loading-user-data
  -> Loads phone type, email onboarding, connections, permissions
  -> Dispatches USER_DATA_LOADED
```

**The SOC 2 CC6.1 gap:** Between Phase 2 completion and Phase 3 auth check, the entire database is decrypted and accessible. If the user's account was revoked on the server, Phase 3 eventually discovers this, but the damage is done -- all data was already in memory. For enterprise customers with terminated employees, this is a compliance violation.

### 3. Database Decryption Flow (Can It Be Split?)

**Yes, it can be split.** The "get key" and "open DB" steps are already separate:

```
Step A: databaseEncryptionService.getEncryptionKey()
  -> Reads db-key-store.json (file read)
  -> Decrypts the stored key via safeStorage.decryptString() (Keychain access)
  -> Returns hex-encoded encryption key

Step B: databaseService.initialize()
  -> Uses the encryption key to open mad.db with SQLCipher
  -> Runs schema creation/migration
  -> THIS is when data becomes accessible
```

We do NOT need Step A (getting the key) to validate auth. We only need:
- `session.json` (already outside the DB, readable via safeStorage)
- Supabase client (initializes from env vars, no DB needed)

### 4. Supabase Client Independence

**Confirmed: The Supabase client is fully independent of the local database.**

- `supabaseService._ensureClient()` calls `this.initialize()` which only reads `process.env.SUPABASE_URL` and `process.env.SUPABASE_ANON_KEY`
- `createClient()` creates an HTTP client -- no local storage
- `persistSession: false` -- Supabase SDK does NOT try to read/write any local store
- `auth.setSession()` is a client-side SDK call that parses tokens
- `auth.getUser()` makes an HTTPS request to `{SUPABASE_URL}/auth/v1/user`

### 5. Data at Risk in the Encrypted Database

The following tables contain sensitive data that is decrypted when mad.db is opened:

| Table | Data Type | SOC 2 Sensitivity |
|-------|-----------|-------------------|
| `users_local` | Email, name, avatar, OAuth IDs, subscription | PII |
| `oauth_tokens` | Access tokens, refresh tokens, scopes | Credentials |
| `sessions` | Session tokens, user IDs | Auth tokens |
| `contacts` | Names, companies, titles, phone numbers, emails | PII |
| `contact_emails` | Email addresses | PII |
| `contact_phones` | Phone numbers (E.164) | PII |
| `messages` | Email/SMS/iMessage content (subject, body, participants) | Communication content |
| `emails` | Full email content (subject, body, sender, recipients, CC, BCC) | Communication content |
| `transactions` | Property addresses, financial data (listing price, sale price, earnest money) | Financial PII |
| `transaction_participants` | Contact-to-transaction role assignments | Business relationships |
| `communications` | Message-to-transaction links | Audit trail |
| `attachments` | File paths, extracted text content | Documents |
| `audit_logs` | All user actions with timestamps | Compliance data |
| `llm_settings` | Encrypted API keys (OpenAI, Anthropic) | Credentials |

**Total exposure:** For an active real estate agent, this could be hundreds of contacts, thousands of emails/texts, dozens of transactions with financial details, and all associated documents. All decrypted before auth check.

### 6. Offline Access Policy (SOC 2 Compliant Approaches)

Based on SOC 2 CC6.1 requirements and industry practices:

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Time-limited offline** | Allow offline access for N hours since last successful server validation | Good UX, balances security/usability | Terminated employee has N-hour window |
| **Block entirely** | Require network + successful auth.getUser() before ANY data access | Most secure | Breaks offline-first promise, bad UX |
| **Periodic revalidation** | Require server check every N hours; lock data if overdue | Reasonable balance | Still has a window |
| **Cached validation + expiry** | Store last-validated timestamp in session.json; block after 24h offline | Simple implementation | 24h window for terminated employees |

**Recommendation: Cached validation with configurable expiry (default 24h, enterprise can tighten to 1h)**

This approach:
- Stores `lastServerValidatedAt` timestamp in `session.json`
- On boot: if `(now - lastServerValidatedAt) < offlineGracePeriod` AND network unavailable, proceed
- If `(now - lastServerValidatedAt) >= offlineGracePeriod`, block access even offline
- Enterprise admins could configure `offlineGracePeriod` via org settings
- Matches the existing 24h session expiry pattern already in the app

**SOC 2 reference:** [Trustero - Access Removal for Terminated Users](https://blog.trustero.com/soc-2-controls-access-removal-for-terminated-or-transferred-users/) states access should be revoked within 24 hours. A 24h offline grace period aligns with this.

---

## Goal

Reorder the app boot sequence so that the user's Supabase auth token is validated with the server BEFORE the encrypted local database is opened, ensuring SOC 2 CC6.1 compliance (data only accessible to currently authorized users).

## Non-Goals

- Do NOT change the login flow (OAuth, deep link, `LOGIN_SUCCESS` dispatch). This only modifies the **returning user boot path**.
- Do NOT remove or replace `session.json` -- it remains the file-based session store. We are adding a field to it, not replacing it.
- Do NOT change the Supabase client initialization or auth state listener (TASK-2040).
- Do NOT modify the `useSessionValidator` polling hook (TASK-2062) -- that handles mid-session invalidation.
- Do NOT change keychain/safeStorage APIs -- we use them as-is.
- Do NOT build the enterprise admin configuration UI for offline grace period -- that comes later. Hardcode a reasonable default (24h).
- Do NOT change the license check flow -- `LicenseProvider` still runs after `ready`.
- Do NOT refactor `databaseService` internals -- only the initialization call ordering changes.

## Deliverables

### Phase 1: Pre-DB Auth Validation (New Loading Phase)

1. **Modify:** `src/appCore/state/machine/types.ts` -- Add new loading phase `"validating-auth"` between `"checking-storage"` and `"initializing-db"`
2. **Modify:** `src/appCore/state/machine/reducer.ts` -- Handle `STORAGE_CHECKED` -> `validating-auth` transition, add `AUTH_PRE_VALIDATED` action
3. **Modify:** `src/appCore/state/machine/LoadingOrchestrator.tsx` -- Add Phase 1.5 (validating-auth) that calls the new pre-DB auth validation IPC
4. **Modify:** `src/appCore/state/machine/components/LoadingScreen.tsx` -- Add display message for `validating-auth` phase

### Phase 2: Pre-DB Auth Validation IPC Handler

5. **Create:** `electron/handlers/preAuthValidationHandler.ts` -- New IPC handler for pre-DB auth validation
6. **Modify:** `electron/main.ts` or `electron/auth-handlers.ts` -- Register the new handler
7. **Modify:** `src/window.d.ts` -- Add type for the new IPC channel
8. **Modify:** `electron/preload/systemBridge.ts` (or relevant preload) -- Expose new IPC channel

### Phase 3: Session Service Enhancement

9. **Modify:** `electron/services/sessionService.ts` -- Add `lastServerValidatedAt` field to `SessionData` interface

### Phase 4: Existing Flow Adjustments

10. **Modify:** `electron/handlers/sessionHandlers.ts` -- `handleGetCurrentUser()` can skip DB-session validation for pre-validated sessions (avoid redundant server call)
11. **Modify:** `electron/handlers/systemHandlers.ts` -- `system:initialize-secure-storage` handler: only proceed if pre-auth passed

### Phase 5: Tests

12. **Create:** `electron/__tests__/pre-auth-validation.test.ts`
13. **Modify:** `src/appCore/state/machine/reducer.test.ts` -- Add tests for new phase transitions
14. **Modify:** `src/appCore/state/machine/LoadingOrchestrator.test.tsx` -- Add tests for new phase orchestration

### Phase 6: Migration

15. **Modify:** `electron/services/sessionService.ts` -- Handle existing `session.json` files that lack `lastServerValidatedAt` (treat as "never validated" -> force online check)

## Acceptance Criteria

- [ ] When a returning user opens the app online with a valid session, Supabase `auth.getUser()` is called BEFORE `databaseService.initialize()` -- verified by log ordering
- [ ] When Supabase `auth.getUser()` returns an error (user revoked/deleted), the app shows Login screen WITHOUT ever decrypting mad.db
- [ ] When the app is offline and `lastServerValidatedAt` is within 24 hours, the app proceeds to DB decryption (offline grace period)
- [ ] When the app is offline and `lastServerValidatedAt` is older than 24 hours (or missing), the app shows Login screen WITHOUT decrypting mad.db
- [ ] When `session.json` does not exist (new user / cleared session), the app skips pre-auth validation and proceeds to DB init + login screen normally
- [ ] The new `validating-auth` loading phase shows an appropriate message (e.g., "Verifying your account...")
- [ ] The login flow (OAuth callback, `LOGIN_SUCCESS` action) is completely unaffected
- [ ] The `useSessionValidator` polling hook (TASK-2062) still works for mid-session invalidation
- [ ] All existing tests pass
- [ ] New tests cover: valid session (online), revoked session (online), offline within grace, offline expired grace, no session.json, migration from old session format
- [ ] All CI checks pass

## Implementation Notes

### Target Boot Sequence (After This Task)

```
LoadingOrchestrator phases:

Phase 1: checking-storage
  -> hasEncryptionKeyStore() -- same as today
  -> Dispatches STORAGE_CHECKED

Phase 1.5: validating-auth  *** NEW ***
  -> sessionService.loadSession() -- reads session.json (safeStorage only, no DB)
  -> If no session: skip to Phase 2 (new user path)
  -> If session exists:
     a. supabaseService.getClient().auth.setSession(tokens)
     b. supabaseService.getClient().auth.getUser() -- server validation
     c. If valid: update lastServerValidatedAt in session.json, proceed to Phase 2
     d. If revoked: clear session.json, dispatch AUTH_PRE_VALIDATED(valid: false)
        -> State machine transitions to unauthenticated, NEVER opens DB
     e. If network error: check lastServerValidatedAt
        - Within 24h: proceed to Phase 2 (offline grace)
        - Expired/missing: dispatch AUTH_PRE_VALIDATED(valid: false)
  -> Dispatches AUTH_PRE_VALIDATED

Phase 2: initializing-db
  -> initializeSecureStorage() -- same as today, but ONLY reached if auth passed
  -> Dispatches DB_INIT_COMPLETE

Phase 3: loading-auth
  -> handleGetCurrentUser() -- can skip redundant server call since Phase 1.5 already validated
  -> Dispatches AUTH_LOADED

Phase 4: loading-user-data
  -> Same as today
  -> Dispatches USER_DATA_LOADED
```

### Key Implementation Details

#### 1. New State Machine Action: AUTH_PRE_VALIDATED

Add to `reducer.ts`:

```typescript
case "AUTH_PRE_VALIDATED": {
  if (state.status !== "loading" || state.phase !== "validating-auth") {
    return state;
  }

  if (!action.valid) {
    // Auth failed pre-DB -- go to unauthenticated WITHOUT ever opening DB
    return {
      status: "unauthenticated",
      reason: action.reason || "session_revoked",
    };
  }

  // Auth passed -- proceed to DB initialization
  // For new users (no session), action.noSession === true
  if (action.noSession) {
    // New user path: Phase 1 detected no key store, go to appropriate flow
    // This matches existing behavior for new users
  }

  return {
    status: "loading",
    phase: "initializing-db",
  };
}
```

#### 2. New IPC Handler: pre-auth:validate-session

```typescript
// electron/handlers/preAuthValidationHandler.ts

import sessionService from "../services/sessionService";
import supabaseService from "../services/supabaseService";
import logService from "../services/logService";

const OFFLINE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PreAuthResult {
  valid: boolean;
  noSession?: boolean;
  reason?: string;
}

export async function handlePreAuthValidation(): Promise<PreAuthResult> {
  // Step 1: Read session.json (safeStorage decryption, no DB needed)
  const session = await sessionService.loadSession();

  if (!session || !session.supabaseTokens) {
    // No session or no Supabase tokens -- new user or cleared session
    // Proceed to DB init (will show login screen after Phase 3)
    await logService.info(
      "Pre-auth: No session found, proceeding to DB init",
      "PreAuthValidation"
    );
    return { valid: true, noSession: true };
  }

  // Step 2: Try server-side validation
  try {
    // Initialize Supabase client (env vars only, no DB)
    const client = supabaseService.getClient();

    // Restore SDK session from stored tokens
    const { error: setSessionError } = await client.auth.setSession({
      access_token: session.supabaseTokens.access_token,
      refresh_token: session.supabaseTokens.refresh_token,
    });

    if (setSessionError) {
      // Token parsing failed (expired, malformed)
      await logService.info(
        "Pre-auth: setSession failed, clearing session",
        "PreAuthValidation",
        { error: setSessionError.message }
      );
      await sessionService.clearSession();
      return { valid: false, reason: "token_invalid" };
    }

    // Server-side validation
    const { data, error: getUserError } = await client.auth.getUser();

    if (getUserError || !data.user) {
      // User revoked/deleted on server
      await logService.info(
        "Pre-auth: Server rejected session, clearing",
        "PreAuthValidation",
        { error: getUserError?.message }
      );
      await sessionService.clearSession();
      return { valid: false, reason: "session_revoked" };
    }

    // Valid! Update lastServerValidatedAt
    await sessionService.updateSession({
      lastServerValidatedAt: Date.now(),
    });

    await logService.info(
      "Pre-auth: Session validated server-side",
      "PreAuthValidation"
    );
    return { valid: true };

  } catch (networkError) {
    // Network error -- check offline grace period
    const lastValidated = session.lastServerValidatedAt || 0;
    const elapsed = Date.now() - lastValidated;

    if (elapsed < OFFLINE_GRACE_PERIOD_MS) {
      await logService.info(
        "Pre-auth: Offline but within grace period, proceeding",
        "PreAuthValidation",
        { elapsedMs: elapsed, graceMs: OFFLINE_GRACE_PERIOD_MS }
      );
      return { valid: true };
    }

    // Grace period expired
    await logService.warn(
      "Pre-auth: Offline and grace period expired, blocking",
      "PreAuthValidation",
      { elapsedMs: elapsed, graceMs: OFFLINE_GRACE_PERIOD_MS }
    );
    return { valid: false, reason: "offline_grace_expired" };
  }
}
```

#### 3. SessionData Interface Change

```typescript
// In electron/services/sessionService.ts

interface SessionData {
  user: User;
  sessionToken: string;
  provider: OAuthProvider;
  subscription?: Subscription;
  expiresAt: number;
  createdAt: number;
  savedAt?: number;
  supabaseTokens?: {
    access_token: string;
    refresh_token: string;
  };
  lastServerValidatedAt?: number;  // NEW: timestamp of last successful auth.getUser()
}
```

#### 4. LoadingOrchestrator Phase 1.5

```typescript
// In LoadingOrchestrator.tsx, add between Phase 1 and Phase 2:

// ============================================
// PHASE 1.5: Pre-DB auth validation
// ============================================
useEffect(() => {
  if (state.status !== "loading" || loadingPhase !== "validating-auth") {
    return;
  }

  let cancelled = false;

  const runPhase = async () => {
    try {
      await waitForApi();
    } catch (err) {
      if (!cancelled) dispatchApiNotReady(err);
      return;
    }

    if (cancelled) return;

    window.api.auth
      .preValidateSession()
      .then((result) => {
        if (cancelled) return;
        dispatch({
          type: "AUTH_PRE_VALIDATED",
          valid: result.valid,
          noSession: result.noSession,
          reason: result.reason,
        });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        // On error, proceed optimistically (don't block app)
        dispatch({
          type: "AUTH_PRE_VALIDATED",
          valid: true,
          noSession: true,
        });
      });
  };

  runPhase();

  return () => { cancelled = true; };
}, [state.status, loadingPhase, dispatch, dispatchApiNotReady]);
```

#### 5. Migration Path

Existing `session.json` files will not have `lastServerValidatedAt`. This is handled by:
- `lastServerValidatedAt` is optional in the interface (defaults to `undefined`)
- In the pre-auth handler, `session.lastServerValidatedAt || 0` treats missing values as "never validated"
- On first successful online validation, the field is written
- No database migration needed (this is a file format change, not a schema change)

#### 6. Phase 1 -> Phase 1.5 Transition

In the reducer, `STORAGE_CHECKED` currently transitions to either:
- `initializing-db` (returning user with key store, or Windows)
- `loading-auth` with `deferredDbInit: true` (new macOS user without key store)

New logic:
- If `hasKeyStore === true`: transition to `validating-auth` (was: `initializing-db`)
- If `hasKeyStore === false` (new user): transition to `loading-auth` with `deferredDbInit: true` (unchanged -- new users don't have a session to validate)

#### 7. Handling the deferredDbInit Path

For new macOS users (no key store exists):
- They go directly to `loading-auth` with `deferredDbInit: true`
- They see the login screen, then onboarding
- The pre-auth validation phase is skipped entirely (no session to validate)
- This path is unchanged

#### 8. Preventing Redundant Server Calls

After TASK-2086, Phase 1.5 already calls `auth.getUser()`. Phase 3's `handleGetCurrentUser()` does NOT need to call it again. Options:
- Pass a `preValidated: true` flag through the state machine
- Or simply let `handleGetCurrentUser()` run as-is (the second `auth.getUser()` is ~200ms, acceptable)
- **Recommendation:** Let Phase 3 run as-is for now. The server call is idempotent and provides defense-in-depth. Optimize later if needed.

### Relationship to TASK-2085

TASK-2085 adds `auth.getUser()` inside Phase 3's `handleGetCurrentUser()`. This is valuable independently because:
1. It handles the case where the DB is already open (e.g., the "app is running" scenario handled by `useSessionValidator`)
2. It provides defense-in-depth even with Phase 1.5

**Recommendation:** Implement TASK-2085 first (quick win, ~30K tokens), then implement this task (comprehensive fix, ~120K tokens). They are compatible and complementary.

## Do / Don't

### Do:
- Add the new phase BETWEEN `checking-storage` and `initializing-db`
- Use `sessionService.loadSession()` in the new phase (it only uses safeStorage, not DB)
- Handle the "no session" case by proceeding to DB init (new user flow)
- Treat network errors as "offline" and apply grace period logic
- Update `lastServerValidatedAt` on every successful server validation
- Log clearly at every decision point for SOC 2 audit trail
- Keep the existing Phase 3 auth flow intact (defense-in-depth)

### Don't:
- Do NOT call `databaseService.initialize()` before auth is validated
- Do NOT call `databaseService.validateSession()` in the new phase (requires DB)
- Do NOT block new users (no session.json) from proceeding to login
- Do NOT remove the Phase 3 auth check -- keep it as defense-in-depth
- Do NOT hardcode enterprise-specific grace periods -- use a constant that can be made configurable later
- Do NOT add a UI for configuring offline grace period (future task)
- Do NOT modify the Supabase client initialization -- `_ensureClient()` auto-initializes

## When to Stop and Ask

- If `sessionService.loadSession()` turns out to require DB access (it should NOT based on current code, but verify)
- If `supabaseService.getClient()` auto-initialization fails without DB being open (should NOT happen)
- If the state machine reducer changes significantly between when this task was written and implementation
- If adding the new phase breaks the `deferredDbInit` path for new macOS users
- If the `auth.setSession()` call in Phase 1.5 causes issues with the Phase 3 `setSession()` call (should be idempotent)
- If token cap (~480K) is approaching

## Testing Expectations (MANDATORY)

### Unit Tests

**New test file:** `electron/__tests__/pre-auth-validation.test.ts`
- Valid session, online, server confirms -> returns `{ valid: true }`
- Valid session, online, server rejects (user deleted) -> clears session, returns `{ valid: false, reason: "session_revoked" }`
- Valid session, online, setSession fails (expired tokens) -> clears session, returns `{ valid: false, reason: "token_invalid" }`
- Valid session, offline, lastServerValidatedAt within 24h -> returns `{ valid: true }`
- Valid session, offline, lastServerValidatedAt older than 24h -> returns `{ valid: false, reason: "offline_grace_expired" }`
- Valid session, offline, lastServerValidatedAt missing (migration) -> returns `{ valid: false, reason: "offline_grace_expired" }`
- No session.json -> returns `{ valid: true, noSession: true }`
- Session exists but no supabaseTokens -> returns `{ valid: true, noSession: true }`

**Modified test file:** `src/appCore/state/machine/reducer.test.ts`
- `STORAGE_CHECKED` with `hasKeyStore: true` -> transitions to `validating-auth` (was: `initializing-db`)
- `AUTH_PRE_VALIDATED` with `valid: true` -> transitions to `initializing-db`
- `AUTH_PRE_VALIDATED` with `valid: false` -> transitions to `unauthenticated`
- `AUTH_PRE_VALIDATED` with `noSession: true` -> transitions to `initializing-db`

**Modified test file:** `src/appCore/state/machine/LoadingOrchestrator.test.tsx`
- Phase 1.5 calls `preValidateSession` when in `validating-auth` phase
- Phase 1.5 dispatches `AUTH_PRE_VALIDATED` with correct payload

### Existing Tests to Verify

- `electron/__tests__/auth-handlers.test.ts` -- login flow unchanged
- `electron/__tests__/auth-handlers.integration.test.ts` -- integration unchanged
- `electron/__tests__/session-handlers-2062.test.ts` -- polling validator unchanged
- `src/appCore/state/machine/__tests__/fullFlow.integration.test.tsx` -- full flow
- `src/appCore/state/machine/reducer.test.ts` -- existing transitions preserved

### Coverage

- Coverage impact: Should increase (new code, new tests)

### Integration / Manual Testing

1. **Normal app restart (online, valid session):** Dashboard loads normally, "Verifying your account..." briefly visible
2. **Delete user from Supabase Admin, restart app (online):** Login screen shown, DB never decrypted
3. **Disconnect network, restart app (within 24h):** Dashboard loads from cache
4. **Disconnect network, restart app (after 24h):** Login screen shown, DB never decrypted
5. **Fresh install (no session.json):** Normal onboarding flow unchanged
6. **Upgrade from old version (session.json without lastServerValidatedAt):** Online: validates and adds timestamp; Offline: blocks (treats as "never validated")

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(auth): validate auth token before database decryption (SOC 2 CC6.1)`
- **Labels**: `fix`, `auth`, `security`, `soc2`
- **Depends on**: None (but TASK-2085 can be implemented first for a quick win)

---

## Risk Analysis

### Risk 1: New loading phase adds startup latency
- **Impact:** ~200-500ms additional delay on every app restart (online)
- **Mitigation:** The `auth.getUser()` call is fast. Offline users within grace period skip it entirely. The "Verifying your account..." message provides visual feedback.

### Risk 2: Offline users blocked after 24h
- **Impact:** Users without internet for >24h cannot access the app
- **Mitigation:** This is intentional for SOC 2 compliance. The grace period can be configured for enterprise needs. Individual users can set a longer period (future task).

### Risk 3: safeStorage availability before DB init
- **Impact:** `sessionService.loadSession()` uses `safeStorage.decryptString()`. If safeStorage is unavailable, session.json cannot be read.
- **Mitigation:** If safeStorage is unavailable, `loadSession()` already returns `null` (graceful fallback). The new phase treats "no session" as "proceed to DB init" -- same as new user path.
- **Analysis:** safeStorage is available after `app.ready`. The `waitForApi()` call in LoadingOrchestrator ensures the renderer doesn't start before the main process is ready.

### Risk 4: Phase 1.5 setSession conflicts with Phase 3 setSession
- **Impact:** Both phases call `auth.setSession()` with the same tokens. Could this cause issues?
- **Analysis:** `setSession()` is idempotent. Calling it twice with the same tokens is safe. The SDK caches the session internally. The second call in Phase 3 is essentially a no-op.

### Risk 5: Regression in deferredDbInit path (new macOS users)
- **Impact:** New macOS users without a keychain might hit the new phase unexpectedly
- **Mitigation:** The new phase is only entered when `hasKeyStore === true`. New users (`hasKeyStore === false`) bypass it entirely and go to `loading-auth` with `deferredDbInit: true` -- unchanged behavior.

### Risk 6: Worker pool gets DB path before auth validation
- **Impact:** In current code, the worker pool is initialized inside `system:initialize-secure-storage` with raw DB path + encryption key
- **Mitigation:** Phase 2 (DB init) now only runs AFTER Phase 1.5 passes. The worker pool initialization is inside Phase 2, so it only happens after auth is validated.

---

## PM Estimate (PM-Owned)

**Category:** `service` (with security elements)

**Estimated Tokens:** ~80K-120K (engineer) + ~40K-60K (SR review)

**Token Cap:** 480K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 (handler + test) | +20K |
| Files to modify | ~10 files (types, reducer, orchestrator, preload, session service, etc.) | +50K |
| Code volume | ~150 lines production, ~300 lines test | +30K |
| Test complexity | High (mocking Supabase SDK, state machine, safeStorage) | +20K |
| State machine changes | Medium complexity (new phase, new action) | +15K |
| Integration risk | High (touches boot sequence) | +15K |

**Confidence:** Medium (state machine changes are well-understood, but boot sequence refactoring has integration risk)

**Risk factors:**
- State machine tests may need significant updates
- LoadingOrchestrator test setup is complex
- Phase ordering bugs could cause boot failures that are hard to debug

**Similar past tasks:**
- TASK-2062 (session validation, ~30K) -- similar scope but this is 3-4x larger
- TASK-2085 (subset of this, ~30K) -- this task adds the phase reordering on top

---

## Should This Be Broken Into Subtasks?

**Yes.** This task has natural breakpoints:

| Subtask | Scope | Can Be Independent? | Estimated Tokens |
|---------|-------|---------------------|-----------------|
| **TASK-2085** (existing) | Add `auth.getUser()` in Phase 3 (quick win) | Yes -- already defined | ~30K |
| **TASK-2086a** | Add `lastServerValidatedAt` to session.json + pre-auth IPC handler | Yes | ~30K |
| **TASK-2086b** | Add `validating-auth` phase to state machine + reducer | Depends on 2086a | ~40K |
| **TASK-2086c** | Wire LoadingOrchestrator Phase 1.5 + preload bridge | Depends on 2086b | ~30K |
| **TASK-2086d** | Tests + integration testing | Depends on 2086c | ~30K |

**Recommended execution order:** TASK-2085 -> TASK-2086a -> TASK-2086b -> TASK-2086c -> TASK-2086d (all sequential)

**Alternative:** Implement all of TASK-2086 as one task (the subtask boundaries above are included for scoping reference, not as separate task files).

---

## Decision Required: Offline Access Policy

**This requires a product decision before implementation.**

| Option | Grace Period | Enterprise Impact | UX Impact |
|--------|-------------|-------------------|-----------|
| A. Strict | 0 (always online) | Maximum security | Blocks offline use entirely |
| B. Standard (recommended) | 24 hours | Matches SOC 2 24h revocation window | Reasonable for real estate agents |
| C. Lenient | 72 hours | More flexible but wider window | Better for field agents |
| D. Configurable | Per-org setting | Best of all worlds | Requires admin UI (future task) |

**Current recommendation:** Option B (24h) with a TODO for Option D (configurable).

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [ ] electron/handlers/preAuthValidationHandler.ts
- [ ] electron/__tests__/pre-auth-validation.test.ts

Files modified:
- [ ] src/appCore/state/machine/types.ts
- [ ] src/appCore/state/machine/reducer.ts
- [ ] src/appCore/state/machine/reducer.test.ts
- [ ] src/appCore/state/machine/LoadingOrchestrator.tsx
- [ ] src/appCore/state/machine/LoadingOrchestrator.test.tsx
- [ ] src/appCore/state/machine/components/LoadingScreen.tsx
- [ ] src/window.d.ts
- [ ] electron/preload/systemBridge.ts (or authBridge.ts)
- [ ] electron/services/sessionService.ts
- [ ] electron/handlers/sessionHandlers.ts
- [ ] electron/main.ts or electron/auth-handlers.ts

Features implemented:
- [ ] Pre-DB auth validation phase (validating-auth)
- [ ] Pre-auth IPC handler with server validation
- [ ] Offline grace period with lastServerValidatedAt
- [ ] Session.json migration (missing lastServerValidatedAt)
- [ ] State machine transitions for new phase
- [ ] LoadingOrchestrator wiring
- [ ] Loading screen message for new phase

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~100K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~100K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
