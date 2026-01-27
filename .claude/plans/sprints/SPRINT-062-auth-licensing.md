# Sprint Plan: SPRINT-062 - Auth Flow + Licensing System

**Created**: 2026-01-26
**Updated**: 2026-01-26
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

## In Scope (9 Implementation Tasks + 1 SR Review)

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
      tasks: [TASK-1506, TASK-1507]
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

    # Phase 3 -> User Gate
    - from: TASK-1507
      to: TASK-1508
      reason: "User validates full flow"

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
  TASK-1508 [USER GATE] <---- User tests full flow
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
| Phase 3: Gate | TASK-1508 | ~5K | User testing |
| Phase 4: Review | TASK-1509 | ~20K | SR Engineer |
| **Total** | **11 tasks** | **~185K** | - |

---

## Task Execution Status

| Phase | Task | Backlog | Status | Engineer | PR | Actual Tokens |
|-------|------|---------|--------|----------|-----|---------------|
| 1 | TASK-1500 | BACKLOG-482 | Complete | a1c8591 | #622 | ~53K |
| 1 | TASK-1501 | BACKLOG-483 | Complete | PM direct | #627 | ~37K |
| 1 | TASK-1502 | - | **PASSED** | USER | - | - |
| 2 | TASK-1503 | BACKLOG-477 | **Complete** | PM direct | - | ~28K |
| 2 | TASK-1503B | - | **Complete** | PM direct | - | ~3K |
| 2 | TASK-1504 | BACKLOG-478 | **Ready** | - | - | - |
| 2 | TASK-1505 | - | Blocked | USER | - | - |
| 3 | TASK-1506 | BACKLOG-480 | Blocked | - | - | - |
| 3 | TASK-1507 | BACKLOG-484 | Blocked | - | - | - |
| 3 | TASK-1508 | - | Blocked | USER | - | - |
| 4 | TASK-1509 | - | Blocked | - | - | - |

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
