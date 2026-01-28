# Sprint Plan: SPRINT-062 - Auth Flow + Licensing System

**Created**: 2026-01-26
**Updated**: 2026-01-27 (PM: Added TASK-1510 - Browser auth landing page with provider selection)
**Status**: Ready
**Goal**: Implement browser-based auth flow with Supabase licensing system
**Branch**: `project/licensing-and-auth-flow`

---

## Sprint Goal

This sprint combines auth infrastructure and licensing into a unified implementation:

1. **Browser-Based OAuth** - Auth happens in system browser with deep link callback
2. **License System in Supabase** - User licenses, trial limits, device registration
3. **License Gate at Login** - Validate license immediately after auth success
4. **Blocking for Expired/Invalid** - Users blocked before entering app

**Why Combined?** Auth and licensing are tightly coupled - the auth callback must validate the license. Building them together avoids integration friction.

---

## Prerequisites / Environment Setup

Before starting sprint work, engineers must:
- [ ] `git checkout project/licensing-and-auth-flow && git pull origin project/licensing-and-auth-flow`
- [ ] `npm install && npm rebuild better-sqlite3-multiple-ciphers && npx electron-rebuild`
- [ ] Verify app starts: `npm run dev`
- [ ] Access to Supabase dashboard

---

## In Scope (19 Implementation Tasks + 1 SR Review)

### Phase 1: Auth Infrastructure
| Task ID | Backlog | Title | Est. Tokens | Execution |
|---------|---------|-------|-------------|-----------|
| TASK-1500 | BACKLOG-482 | Desktop Deep Link Handler | ~25K | Sequential |
| TASK-1501 | BACKLOG-483 | Browser Auth Landing Page | ~30K | Sequential |
| TASK-1502 | - | Manual Test Auth Flow (USER GATE) | ~5K | User |

### Phase 2: Licensing Backend
| Task ID | Backlog | Title | Est. Tokens | Execution |
|---------|---------|-------|-------------|-----------|
| TASK-1503 | BACKLOG-477 | Create User License Schema in Supabase | ~25K | Sequential |
| TASK-1503B | - | Fix Licensing P0 Blockers (SR Review findings) | ~10K | Sequential |
| TASK-1504 | BACKLOG-478 | Implement License Validation Service | ~30K | Sequential |
| TASK-1505 | - | Manual Test License Service (USER GATE) | ~5K | User |

### Phase 3: Integration
| Task ID | Backlog | Title | Est. Tokens | Execution |
|---------|---------|-------|-------------|-----------|
| TASK-1506 | BACKLOG-480 | Add License Check at App Start | ~15K | Sequential |
| TASK-1507 | BACKLOG-484 | Add License Validation at Auth | ~15K | Sequential |
| TASK-1507B | - | Wire Deep Link Auth Success to Frontend (Bug Fix) | ~20K | Sequential |
| TASK-1507C | - | Fix Deep Link Auth Not Setting currentUser (Bug Fix) | ~15K | Sequential |
| TASK-1507D | - | Fix Local SQLite User Not Created (Bug Fix) | ~25K | Sequential |
| TASK-1507E | - | Fix Existing Users Missing Local SQLite User (Bug Fix) | ~30K | Sequential |
| TASK-1507F | - | Fix User ID Mismatch in Renderer Callback (Bug Fix) | ~15K | Sequential |
| TASK-1507G | - | Unify User IDs Across Local SQLite and Supabase | ~50K | Sequential |
| TASK-1508A | - | Fix URL Fragment Token Parsing (Bug Fix) | ~15K | Sequential |
| TASK-1508B | - | Fix Env Vars for Packaged Builds (Bug Fix) | ~20K | Sequential |
| TASK-1508C | - | Fix Google Maps API Key in Packaged Builds (Bug Fix) | ~10K | Parallel |
| TASK-1510 | BACKLOG-548 | Browser Auth Landing Page with Provider Selection | ~5K | Sequential |
| TASK-1508 | - | Manual Test Full Flow (USER GATE) | ~5K | User |

### Phase 4: Review
| Task ID | Backlog | Title | Est. Tokens | Execution |
|---------|---------|-------|-------------|-----------|
| TASK-1509 | - | SR Engineer Final Review | ~20K | Sequential |

---

## Dependency Graph

```yaml
dependency_graph:
  phases:
    - id: phase-1
      name: "Auth Infrastructure"
      tasks: [TASK-1500, TASK-1501]
      gate: TASK-1502 (USER GATE)

    - id: phase-2
      name: "Licensing Backend"
      requires: phase-1
      tasks: [TASK-1503, TASK-1504]
      gate: TASK-1505 (USER GATE)

    - id: phase-3
      name: "Integration"
      requires: [phase-1, phase-2]
      tasks: [TASK-1506, TASK-1507, TASK-1507B, TASK-1507C, TASK-1507D, TASK-1507E, TASK-1507F, TASK-1507G, TASK-1508A, TASK-1508B, TASK-1510]
      gate: TASK-1508 (USER GATE)

    - id: phase-4
      name: "Final Review"
      requires: phase-3
      tasks: [TASK-1509]

  edges:
    # Phase 1 internal
    - from: TASK-1500
      to: TASK-1501
      reason: "Browser auth needs deep link handler first"

    # Phase 1 -> User Gate
    - from: TASK-1501
      to: TASK-1502
      reason: "User validates auth flow works end-to-end"

    # Phase 2 internal
    - from: TASK-1503
      to: TASK-1503B
      reason: "Fix P0 blockers before implementing service"

    - from: TASK-1503B
      to: TASK-1504
      reason: "License service needs blockers fixed first"

    # Phase 2 -> User Gate
    - from: TASK-1504
      to: TASK-1505
      reason: "User validates license service works"

    # Phase 1+2 -> Phase 3
    - from: TASK-1502
      to: TASK-1506
      reason: "Auth must work before integrating license check"
    - from: TASK-1505
      to: TASK-1506
      reason: "License service must work before app integration"

    # Phase 3 internal
    - from: TASK-1506
      to: TASK-1507
      reason: "App start check before auth callback integration"

    - from: TASK-1507
      to: TASK-1507B
      reason: "Wire deep link auth handler to frontend"

    - from: TASK-1507B
      to: TASK-1507C
      reason: "Fix currentUser not being set after deep link auth"

    - from: TASK-1507C
      to: TASK-1507D
      reason: "Fix local SQLite user creation after currentUser is set"

    - from: TASK-1507D
      to: TASK-1507E
      reason: "Fix existing users missing local SQLite user (retroactive fix)"

    - from: TASK-1507E
      to: TASK-1507F
      reason: "Fix user ID mismatch - send local ID to renderer"

    - from: TASK-1507F
      to: TASK-1507G
      reason: "Unify user IDs - architectural fix for ID mismatch root cause"

    - from: TASK-1507G
      to: TASK-1508A
      reason: "Fix URL fragment parsing bug discovered during testing"

    - from: TASK-1508A
      to: TASK-1508B
      reason: "Fix env vars bug depends on auth flow working"

    - from: TASK-1508B
      to: TASK-1508C
      reason: "Fix Google Maps API key (parallel, lower priority)"

    - from: TASK-1507
      to: TASK-1510
      reason: "Provider selection page needs deep link auth working first"

    # Phase 3 -> User Gate
    - from: TASK-1510
      to: TASK-1508
      reason: "User validates full flow including provider selection"

    - from: TASK-1508B
      to: TASK-1508
      reason: "User validates full flow after bug fixes (TASK-1508C can be parallel)"

    # User Gate -> SR Review
    - from: TASK-1508
      to: TASK-1509
      reason: "SR reviews after user approval"
```

### Visual Dependency Flow

```
Phase 1: Auth Infrastructure          Phase 2: Licensing Backend
  TASK-1500 (Deep Link Handler)         (Can start AFTER Phase 1 gate passes)
       |
       v                                TASK-1503 (License Schema)
  TASK-1501 (Browser Auth Landing)           |
       |                                     v
       v                                TASK-1503B (Fix P0 Blockers)
  TASK-1502 [USER GATE]                      |
       |                                     v
       | (Phase 1 must pass)            TASK-1504 (License Service)
       |                                     |
       |                                     v
       |                                TASK-1505 [USER GATE]
       |                                     |
       +------------------------------------>+
                                             |
                                             v
Phase 3: Integration (requires BOTH Phase 1 AND Phase 2 gates to pass)
  TASK-1506 (License Check at App Start)
       |
       v
  TASK-1507 (License Validation at Auth)
       |
       v
  TASK-1507B (Wire Deep Link Auth to Frontend) <---- Bug fix: handler not wired
       |
       v
  TASK-1507C (Fix currentUser Not Set) <---- Bug fix: login() not called
       |
       v
  TASK-1507D (Fix Local SQLite User) <---- Bug fix: FK constraint failures (NEW auth)
       |
       v
  TASK-1507E (Fix Existing Users) <---- Bug fix: FK failures for EXISTING users
       |
       v
  TASK-1507F (Fix User ID Mismatch) <---- Bug fix: Send local ID to renderer
       |
       v
  TASK-1507G (Unify User IDs) <---- Architectural fix: Use Supabase ID everywhere
       |
       v
  TASK-1508A (Fix URL Fragment Parsing) <---- Bug fix: Supabase returns #access_token
       |
       v
  TASK-1508B (Fix Env Vars for Packaged) <---- Bug fix: process.env undefined in prod
       |
       +----> TASK-1508C (Google Maps API Key) <---- Parallel, P2
       |
       v
  TASK-1508 [USER GATE] <---- User tests full flow after bug fixes
       |
       v
Phase 4: Final Review
  TASK-1509 (SR Engineer Review)
```

**Execution Note:** Phase 2 can technically run in parallel with Phase 1 since they don't share files, but Phase 2 is BLOCKED until Phase 1's USER GATE (TASK-1502) passes. This ensures auth works before building licensing on top of it.

---

## User Gates

### TASK-1502: Auth Flow Test (After Phase 1)

**Status: PASSED** (2026-01-26)

**What to test:**
1. Click login in desktop app - browser opens
2. Login with Google/Microsoft in browser
3. Browser redirects to `magicaudit://callback`
4. Desktop app receives tokens and shows authenticated state

**Pass criteria:**
- [x] Deep link `magicaudit://` registered (app opens when clicked)
- [x] Browser auth page shows login options
- [x] OAuth completes successfully
- [x] Desktop receives tokens via deep link
- [x] Works when app is already running
- [ ] Works when app is NOT running (cold start) - **Note: Dev mode limitation, works in production builds**

**User Notes:** Cold start only works in production builds. This is expected Electron dev mode behavior.

### TASK-1505: License Service Test (After Phase 2)

**What to test:**
1. New user gets trial license created
2. Trial limits are tracked correctly
3. Transaction count increments
4. License status is queryable

**Pass criteria:**
- [ ] user_licenses table exists in Supabase
- [ ] device_registrations table exists in Supabase
- [ ] RLS policies work (user can only see own license)
- [ ] validateLicense() returns correct status
- [ ] incrementTransactionCount() updates Supabase

### TASK-1508: Full Flow Test (After Phase 3)

**What to test:**
1. Login via browser -> license validated -> app opens
2. Expired trial blocks access with upgrade prompt
3. Transaction limit shows warning when approaching
4. Device registration works

**Pass criteria:**
- [ ] New user: login -> trial created -> app opens
- [ ] Expired user: login -> blocked with upgrade screen
- [ ] Transaction limit warning shown at limit
- [ ] Device registered on first login
- [ ] Offline grace period works (24 hours)

---

## Files Affected by Phase

### Phase 1: Auth Infrastructure
| File | Action | Task |
|------|--------|------|
| `electron/main.ts` | Modify - add deep link handler | TASK-1500 |
| `electron-builder.yml` | Modify - register URL scheme | TASK-1500 |
| `build/entitlements.mac.plist` | Modify - add applinks | TASK-1500 |
| `electron/preload.ts` | Modify - expose auth:callback | TASK-1500 |
| `broker-portal/app/auth/desktop/page.tsx` | Create | TASK-1501 |
| `broker-portal/app/auth/desktop/callback/page.tsx` | Create | TASK-1501 |

### Phase 2: Licensing Backend
| File | Action | Task |
|------|--------|------|
| `supabase/migrations/XXXXXXXX_user_licenses.sql` | Create | TASK-1503 |
| `shared/types/license.ts` | Create | TASK-1503 |
| `electron/services/licenseService.ts` | Create | TASK-1504 |
| `electron/services/deviceService.ts` | Create | TASK-1504 |
| `electron/license-handlers.ts` | Modify | TASK-1504 |

### Phase 3: Integration
| File | Action | Task |
|------|--------|------|
| `electron/main.ts` | Modify - add license init | TASK-1506 |
| `src/App.tsx` | Modify - add license gate | TASK-1506 |
| `src/contexts/LicenseContext.tsx` | Modify - use Supabase | TASK-1506 |
| `src/components/license/` | Create - UI components | TASK-1506 |
| `src/appCore/state/flows/useAuthFlow.ts` | Modify | TASK-1507 |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deep link not working on Windows | Medium | High | Test early in Phase 1, have manual token fallback |
| Supabase unavailable | Low | High | Cache license locally, 24-hour grace period |
| OAuth popup blocked by browser | Low | Medium | Use window.location, not window.open |
| Device ID changes on reinstall | Medium | Medium | Allow device re-registration, clear error message |
| RLS policy blocks valid user | Medium | High | Thorough testing at each user gate |

---

## Estimated Effort Summary

| Phase | Tasks | Est. Tokens | Notes |
|-------|-------|-------------|-------|
| Phase 1: Auth | TASK-1500, 1501 | ~55K | Sequential |
| Phase 1: Gate | TASK-1502 | ~5K | User testing |
| Phase 2: Licensing | TASK-1503, 1503B, 1504 | ~65K | Sequential |
| Phase 2: Gate | TASK-1505 | ~5K | User testing |
| Phase 3: Integration | TASK-1506, 1507 | ~30K | Sequential |
| Phase 3: Bug Fixes | TASK-1507B, 1507C, 1507D, 1507E, 1507F, 1508A, 1508B, 1508C | ~150K | Sequential (discovered during testing) |
| Phase 3: Architecture | TASK-1507G | ~50K | Unify user IDs |
| Phase 3: Feature | TASK-1510 | ~5K | Provider selection redirect (uses existing broker portal) |
| Phase 3: Gate | TASK-1508 | ~5K | User testing |
| Phase 4: Review | TASK-1509 | ~20K | SR Engineer |
| **Total** | **21 tasks** | **~390K** | - |

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-1500 | BACKLOG-482 | Complete | a1c8591 | #622 | ~53K |
| 1 | TASK-1501 | BACKLOG-483 | Complete | PM direct | #627 | ~37K |
| 1 | TASK-1502 | - | **PASSED** | USER | - | - |
| 2 | TASK-1503 | BACKLOG-477 | **Complete** | PM direct | - | ~28K |
| 2 | TASK-1503B | - | **Complete** | PM direct | - | ~3K |
| 2 | TASK-1504 | BACKLOG-478 | **Testing** | PM direct | #632 | ~45K |
| 2 | TASK-1505 | - | Blocked | USER | - | - |
| 3 | TASK-1506 | BACKLOG-480 | **Planning** | - | - | - |
| 3 | TASK-1507 | BACKLOG-484 | **Complete** | PM direct | #634 | ~22K |
| 3 | TASK-1507B | - | **Complete** | PM direct | #637 | - |
| 3 | TASK-1507C | - | **Complete** | PM direct | #638 | - |
| 3 | TASK-1507D | - | **Complete** | PM direct | #639 | - |
| 3 | TASK-1507E | - | **Ready** | - | - | - |
| 3 | TASK-1507F | - | **Ready** | - | - | - |
| 3 | TASK-1507G | - | **Ready** | - | - | - |
| 3 | TASK-1508A | - | **Complete** | PM direct | #636 | - |
| 3 | TASK-1508B | - | Blocked | - | - | - |
| 3 | TASK-1508C | - | **Ready** (P2) | - | - | - |
| 3 | TASK-1510 | BACKLOG-548 | **Complete** | PM direct | #646 | - |
| 3 | TASK-1508 | - | Blocked | USER | - | - |
| 3 | TASK-1509A | BACKLOG-546 | **Complete** | engineer | #644, #645 | ~15K |
| 4 | TASK-1509 | - | Blocked | - | - | - |

---

## Bugs Discovered During Testing (2026-01-26, updated 2026-01-27)

During TASK-1508 manual testing, multiple blocking bugs were discovered:

**Bug 1: Deep Link Auth Not Wired to Frontend (TASK-1507B)**
- **Error:** App stays on login screen after successful deep link auth
- **Root Cause:** `Login.tsx` has `onDeepLinkAuthSuccess` prop but `AppRouter.tsx` never passes it
- **Status:** Complete (PR #637)

**Bug 2: Deep Link Auth Not Setting currentUser (TASK-1507C)**
- **Error:** "Failed to start Google OAuth: undefined" when connecting email after deep link auth
- **Root Cause:** `handleDeepLinkAuthSuccess` dispatches `LOGIN_SUCCESS` but does NOT call `login()` function
- **Status:** Complete (PR #638)

**Bug 3: Local SQLite User Not Created (TASK-1507D)**
- **Error:** "FOREIGN KEY constraint failed" when connecting mailbox
- **Root Cause:** Deep link auth creates user in Supabase but NOT in local SQLite database
- **Status:** Complete (PR #639)

**Bug 4: Existing Users Missing Local SQLite User (TASK-1507E)**
- **Error:** FK constraint failures for users who authenticated before TASK-1507D fix
- **Root Cause:** TASK-1507D only handles NEW auth flows, not existing sessions
- **Status:** Ready

**Bug 5: User ID Mismatch in Renderer Callback (TASK-1507F)**
- **Error:** FK constraint failures persist even after local user created
- **Root Cause:** `sendToRenderer()` sends Supabase UUID instead of local SQLite user ID
- **File:** `electron/main.ts` lines 342-354
- **Status:** Ready

**Bug 6: URL Fragment Token Parsing (TASK-1508A)**
- **Error:** "Missing tokens in callback URL"
- **Root Cause:** Supabase OAuth returns tokens in URL fragment, code only reads query params
- **Status:** Complete (PR #636)

**Bug 7: Env Vars in Packaged App (TASK-1508B)**
- **Error:** "Authentication not configured"
- **Root Cause:** `process.env.SUPABASE_URL` undefined in packaged builds
- **Status:** Blocked

**Bug 8: Google Maps API Key Not Embedded (TASK-1508C)**
- **Error:** "No Google Maps API key configured"
- **Root Cause:** TASK-1508B only embeds Supabase vars, not Google Maps API key
- **Status:** Ready (P2)

**Architectural Issue: Dual User ID System (TASK-1507G)**
- **Error:** FK constraint failures when local ID used for Supabase operations
- **Root Cause:** App uses random UUID for local SQLite user ID, but Supabase Auth has its own UUID
- **Impact:** Blocks ALL licensing functionality (licenses, devices use Supabase FK constraints)
- **Solution:** Use Supabase Auth ID as canonical user ID everywhere
- **Status:** Ready (P0 - blocks licensing)

### P2/P3 Polish Bugs (discovered 2026-01-27)

**Bug 9: Contacts Count Mismatch (BACKLOG-537)**
- **Error:** Logs show "Found 27 imported contacts" but UI only displays 2 contacts
- **Root Cause:** Data/filtering discrepancy between backend query and frontend display
- **Impact:** P2 - Core feature showing incomplete data
- **Status:** Deferred (not blocking license flow)

**Bug 10: Email Connection State Not Synced to Dashboard (BACKLOG-538)**
- **Error:** "Complete your account setup" banner shows even when Settings shows email "Connected"
- **Root Cause:** Dashboard checks different state than Settings modal (same root cause as BACKLOG-536)
- **Impact:** P2 - Confusing UX, shows incomplete setup when actually complete
- **Related:** BACKLOG-536 (Settings modal refresh issue) - should be fixed together
- **Status:** Deferred (not blocking license flow)

**Bug 11: Settings Modal Doesn't Refresh After Email Connection (BACKLOG-536)**
- **Error:** After connecting email, Settings modal still shows "Connect" until close/reopen
- **Root Cause:** Email connection state not propagating to components after OAuth success
- **Impact:** P3 - Minor UI polish
- **Status:** Deferred (not blocking license flow)

**Bug 12: Scan Lookback Period Not Persistent (BACKLOG-539)**
- **Error:** Scan Lookback Period setting reverts to previous value after closing Settings modal
- **Root Cause:** Setting value not being saved to user preferences
- **Impact:** P2 - Functional bug, settings don't persist
- **Status:** Deferred (not blocking license flow)

**Bug 13: Settings Modal Needs Save Button (BACKLOG-540)**
- **Error:** Settings modal shows only "Done" button, no indication changes will be saved
- **Root Cause:** UX design - need explicit save button when settings are modified
- **Impact:** P3 - UX enhancement
- **Status:** Deferred (not blocking license flow)

**Bug 14: Scan Lookback Period Default Should Be 3 Months (BACKLOG-541)**
- **Error:** Lookback period defaults to wrong value (not 3 months)
- **Root Cause:** Default value configuration
- **Impact:** P3 - Default value tweak
- **Status:** Deferred (not blocking license flow)

**Settings Bundle Note:** Bugs 12, 13, 14 (BACKLOG-539, 540, 541) all affect the Settings modal and should be fixed together in a future sprint.

**Bug 15: SMS and iMessage Threads Not Merged (BACKLOG-542)**
- **Error:** Same contact appears twice in thread list - once for SMS, once for iMessage
- **Root Cause:** Import logic creates separate thread_ids based on service type (SMS vs iMessage) instead of grouping by phone number/contact
- **Expected:** Match iPhone behavior - one conversation per contact regardless of channel
- **Impact:** P2 - Confusing UX, duplicate contacts in thread list
- **Status:** Deferred (not blocking license flow)

**Bug 16: Audit Period Not Displayed After Transaction Creation (BACKLOG-543)**
- **Error:** Audit period doesn't show in Overview tab after creating a transaction
- **Root Cause:** `started_at` field either not saved on initial creation, or UI not refreshing properly
- **Workaround:** Click Edit, then Save - audit period then appears
- **Expected:** Audit period should display immediately after creation (e.g., "Jan 1, 2026 - Ongoing")
- **Impact:** P3 - Minor UX polish, data is there just needs edit/save to display
- **Status:** Deferred (not blocking license flow)

**Bug 17: Returning Users See T&C Screen Incorrectly (BACKLOG-546)** ✅ FIXED
- **Error:** Returning users see "Welcome... please review and accept our terms" even though they already accepted
- **Root Cause:** `sharedAuthHandlers.ts` uses `!localUser` for `isNewUser` instead of checking `terms_accepted_at` and version
- **Impact:** P1 - Blocks returning user experience
- **Fix:** Sync terms data from cloud when creating local user, use `needsToAcceptTerms(localUser)` for return value
- **SR Review:** APPROVED
- **Status:** Complete (PR #644 merged)

---

## Success Criteria

### Phase 1 Complete When:
- [x] `magicaudit://` deep link registered (macOS + Windows)
- [x] Desktop opens browser for login
- [x] Browser auth page shows Google/Microsoft options
- [x] Successful login redirects back to desktop
- [x] User approves at TASK-1502 gate

**Phase 1 Status: COMPLETE** (2026-01-26)
- Deep link works when app is running
- OAuth flow works end-to-end
- Tokens received successfully
- Note: Cold start only works in production builds (expected Electron dev mode limitation)

### Phase 2 Complete When:
- [ ] user_licenses table in Supabase with RLS
- [ ] device_registrations table with limit trigger
- [ ] License validation service working
- [ ] TypeScript types generated
- [ ] User approves at TASK-1505 gate

### Phase 3 Complete When:
- [ ] License validated on app start
- [ ] License validated at auth callback
- [ ] Expired license blocks access
- [ ] Trial limits enforced
- [ ] Device registration working
- [ ] User approves at TASK-1508 gate

### Sprint Complete When:
- [ ] SR Engineer approves at TASK-1509
- [ ] All PRs merged to project branch
- [ ] Project branch ready for develop merge

---

---

## SR Engineer Review Notes

**Review Date:** 2026-01-26
**Reviewer:** SR Engineer Agent
**Status:** APPROVED WITH MINOR CHANGES

### Issues Identified and Fixed

| ID | Severity | Issue | Resolution |
|----|----------|-------|------------|
| A1 | HIGH | TASK-1500 referenced non-existent `electron-builder.yml` | Updated to use `package.json` build config |
| A2 | MEDIUM | TASK-1503 FK to `organizations` table that may not exist | Made nullable, removed FK constraint |
| A3 | MEDIUM | TASK-1504 referenced non-existent `supabaseAdmin` module | Updated to use existing `supabaseService` |
| A4 | LOW | Dependency graph visual vs text inconsistency | Clarified in visual diagram |
| S1 | INFO | Tokens in URL query params | Documented as known behavior |

### Architecture Validation

- [x] Phase sequencing is correct (Auth -> Licensing -> Integration)
- [x] User gates at appropriate checkpoints
- [x] Service layer follows existing patterns
- [x] IPC channel additions documented

### Security Validation

- [x] RLS policies comprehensive
- [x] Token handling secure (no logging)
- [x] Offline grace period reasonable (24h)
- [ ] Consider fragment (`#`) vs query params for tokens (documented)

### Recommendations for Engineers

1. **TASK-1500:** Add `app.setAsDefaultProtocolClient()` for development mode
2. **TASK-1503:** Use `mcp__supabase__apply_migration` tool, not local files
3. **TASK-1504:** Use existing `supabaseService.ts` patterns
4. **TASK-1506:** Update existing `LicenseContext`, don't replace it
5. **TASK-1507:** Update bridge modules in `electron/preload/`, not `preload.ts` directly

### Missing IPC Channels to Implement

```
licenseBridge: validate, create, incrementTransactionCount, clearCache
deviceBridge: register, list, deactivate, getCurrentId
authBridge: openAuthInBrowser, onAuthSuccess, onAuthError, onLicenseBlocked, onDeviceLimit
```

---

## Next Steps

After SPRINT-062 completes:
1. Merge `project/licensing-and-auth-flow` to `develop`
2. Continue to SPRINT-063 (TBD - possibly telemetry or UI polish)
