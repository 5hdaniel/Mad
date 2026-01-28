# Sprint Plan: SPRINT-063 - Onboarding Flow Refactor

**Created**: 2026-01-28
**Status**: Planning
**Goal**: Refactor onboarding flow for reliability, proper DB initialization order, and modular architecture
**Branch**: TBD (will branch from develop after SPRINT-062 merges)

---

## Sprint Goal

Fix the fundamental architecture issues in the onboarding flow:

1. **Reorder Flow** - DB init before email connection (no more "pending" complexity)
2. **Phone Selection to Supabase** - Store phone type in cloud, no local DB needed
3. **Clean Architecture** - Modular UI/State/Service/Platform layers
4. **Remove Pending State** - No more pendingEmailTokens, pendingOAuthData complexity

---

## Background

### Current Problem

The onboarding flow order causes issues for first-time macOS users:

```
Current: Phone → Email → Keychain/DB → FDA → Dashboard
                  ↑
            DB not ready here
            Causes "Database not initialized" errors
            Complex "pending" state management
```

### Root Cause

Email connection step comes BEFORE database initialization. This forces:
- Pending email token storage
- Complex conditional logic throughout handlers
- Error-prone state management
- Grayed out buttons when handlers fail

### Solution

Reorder the flow so DB is initialized before email:

```
New: Phone → Keychain/DB → FDA → Email → Dashboard
       ↓         ↓          ↓      ↓
    Supabase   DB ready   Perms   Clean OAuth
    only       for all    done    flow
```

---

## In Scope

### Phase 1: Flow Reorder (Core Fix)

| Task ID | Title | Est. Tokens | Description |
|---------|-------|-------------|-------------|
| TASK-1600 | Store Phone Type in Supabase | ~15K | Add phone_type to user profile, remove local DB dependency |
| TASK-1601 | Reorder macOS Flow Steps | ~20K | Update macosFlow.ts: phone → secure-storage → permissions → email |
| TASK-1602 | Reorder Windows Flow Steps | ~15K | Update windowsFlow.ts similarly |
| TASK-1603 | Remove Pending Email State | ~25K | Remove pendingEmailTokens, simplify handlers |
| TASK-1604 | Manual Test Reordered Flow (USER GATE) | ~5K | User validates new flow works |

### Phase 2: Architecture Cleanup

| Task ID | Title | Est. Tokens | Description |
|---------|-------|-------------|-------------|
| TASK-1610 | Create Service Layer Interface | ~20K | Define AuthService, StorageService interfaces |
| TASK-1611 | Implement Electron Services | ~30K | Wrap window.api calls in service classes |
| TASK-1612 | Migrate State Hooks to Services | ~25K | useEmailHandlers etc. call services, not window.api |
| TASK-1613 | Remove Dead Onboarding Code | ~15K | Clean up EMAIL_CONNECTED handler, unused pending logic |
| TASK-1614 | Manual Test Architecture (USER GATE) | ~5K | User validates refactored code works |

### Phase 3: Carried Over from SPRINT-062

| Task ID | Title | Est. Tokens | Description |
|---------|-------|-------------|-------------|
| TASK-1508 | Full Flow USER GATE | ~5K | User tests complete auth + licensing flow |
| TASK-1509 | SR Final Review (Sprint 62) | ~20K | Review Sprint 62 implementation |

### Phase 4: Build/Packaging Fixes

| Task ID | Title | Est. Tokens | Description |
|---------|-------|-------------|-------------|
| TASK-1508B | Env Vars for Packaged Builds | ~20K | Fix process.env undefined in production |
| TASK-1508C | Google Maps API Key | ~10K | Embed API key in packaged builds |

### Phase 5: Final Review

| Task ID | Title | Est. Tokens | Description |
|---------|-------|-------------|-------------|
| TASK-1620 | SR Engineer Final Review | ~20K | Architecture and code review for Sprint 63 |

---

## Dependency Graph

```
Phase 1: Flow Reorder
  TASK-1600 (Phone to Supabase)
       |
       v
  TASK-1601 (macOS Flow Order)
       |
       +---> TASK-1602 (Windows Flow Order) [parallel]
       |
       v
  TASK-1603 (Remove Pending State)
       |
       v
  TASK-1604 [USER GATE]
       |
       v
Phase 2: Architecture
  TASK-1610 (Service Interface)
       |
       v
  TASK-1611 (Implement Services)
       |
       v
  TASK-1612 (Migrate Hooks)
       |
       v
  TASK-1613 (Remove Dead Code)
       |
       v
  TASK-1614 [USER GATE]
       |
       v
Phase 3: Deferred
  TASK-1508B (Env Vars) ---> TASK-1508C (Maps Key)
       |
       v
Phase 4: Review
  TASK-1620 (SR Review)
```

---

## Architecture Target

### Current (Problematic)

```
┌─────────────────────────────────────────┐
│  UI Components                          │
│  - Call window.api directly ❌          │
│  - Have business logic mixed in ❌      │
├─────────────────────────────────────────┤
│  State Hooks (useEmailHandlers, etc.)   │
│  - Call window.api directly ❌          │
│  - Complex pending state logic ❌       │
├─────────────────────────────────────────┤
│  Platform (window.api)                  │
│  - Accessed from everywhere ❌          │
└─────────────────────────────────────────┘
```

### Target (Clean)

```
┌─────────────────────────────────────────┐
│  UI Layer: src/components/              │
│  - Pure React, props only               │
│  - Zero business logic, zero API calls  │
├─────────────────────────────────────────┤
│  State Layer: src/appCore/state/        │
│  - State machine (reducer + selectors)  │
│  - Thin orchestration hooks             │
│  - Calls services, not platform APIs    │
├─────────────────────────────────────────┤
│  Service Layer: src/services/ [NEW]     │
│  - AuthService, StorageService, etc.    │
│  - Abstracts platform layer             │
│  - Swappable implementations            │
├─────────────────────────────────────────┤
│  Platform Layer: src/platform/          │
│  - ElectronPlatform (wraps window.api)  │
│  - Future: WebPlatform for browser      │
└─────────────────────────────────────────┘
```

---

## New Flow Order

### macOS

```typescript
// Before (macosFlow.ts)
export const MACOS_FLOW_STEPS = [
  "phone-type",      // No DB needed
  "email-connect",   // DB NOT READY ❌
  "secure-storage",  // DB init here
  "permissions",     // FDA check
];

// After
export const MACOS_FLOW_STEPS = [
  "phone-type",      // Supabase only
  "secure-storage",  // DB init - keychain explanation
  "permissions",     // FDA check
  "email-connect",   // DB READY ✅
];
```

### Windows

```typescript
// Before (windowsFlow.ts)
export const WINDOWS_FLOW_STEPS = [
  "phone-type",
  "email-connect",   // DB NOT READY ❌
  "apple-driver",    // iPhone only
];

// After
export const WINDOWS_FLOW_STEPS = [
  "phone-type",      // Supabase only
  "apple-driver",    // iPhone only, triggers DB init
  "email-connect",   // DB READY ✅
];
```

---

## Phone Type Storage

### Current
- Stored in local SQLite (requires DB init)
- Blocks onboarding if DB not ready

### New
- Stored in Supabase user profile metadata
- No local DB dependency
- Available immediately after login

```typescript
// New approach
const handleSelectPhone = async (phoneType: 'iphone' | 'android') => {
  await supabase
    .from('user_profiles')  // Or use user metadata
    .update({ phone_type: phoneType })
    .eq('id', userId);

  // Update local state
  dispatch({ type: 'PHONE_TYPE_SELECTED', phoneType });
};
```

---

## Files Affected

### Phase 1: Flow Reorder

| File | Action | Task |
|------|--------|------|
| `src/components/onboarding/flows/macosFlow.ts` | Modify - reorder steps | TASK-1601 |
| `src/components/onboarding/flows/windowsFlow.ts` | Modify - reorder steps | TASK-1602 |
| `src/appCore/state/flows/usePhoneTypeApi.ts` | Modify - use Supabase | TASK-1600 |
| `src/appCore/state/flows/useEmailHandlers.ts` | Modify - remove pending logic | TASK-1603 |
| `src/appCore/state/types.ts` | Modify - remove PendingEmailTokens | TASK-1603 |

### Phase 2: Architecture

| File | Action | Task |
|------|--------|------|
| `src/services/index.ts` | Create | TASK-1610 |
| `src/services/AuthService.ts` | Create | TASK-1610, 1611 |
| `src/services/StorageService.ts` | Create | TASK-1610, 1611 |
| `src/platform/ElectronPlatform.ts` | Create | TASK-1611 |
| `src/appCore/state/flows/*.ts` | Modify - use services | TASK-1612 |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Phone type stored in Supabase (no local DB needed)
- [ ] macOS flow: phone → keychain → FDA → email
- [ ] Windows flow: phone → driver → email
- [ ] No more "Database not initialized" errors during onboarding
- [ ] No pendingEmailTokens state
- [ ] User approves at TASK-1604 gate

### Phase 2 Complete When:
- [ ] Service layer exists with clean interfaces
- [ ] State hooks don't call window.api directly
- [ ] Dead onboarding code removed
- [ ] User approves at TASK-1614 gate

### Sprint Complete When:
- [ ] All user gates passed
- [ ] SR Engineer approves at TASK-1620
- [ ] Env vars fix merged (TASK-1508B)
- [ ] All PRs merged to develop

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Supabase schema change needed | Medium | Medium | Plan migration carefully |
| Existing users affected by flow change | Low | High | Only affects new onboarding, not returning users |
| Service layer adds complexity | Low | Medium | Keep interfaces simple, don't over-engineer |
| Windows flow has different DB init timing | Medium | Medium | Test Windows specifically |

---

## Prerequisites

Before starting:
- [ ] SPRINT-062 merged to develop
- [ ] Branch from develop
- [ ] Verify Supabase user_profiles table exists or create it

---

## Estimated Effort

| Phase | Tasks | Est. Tokens |
|-------|-------|-------------|
| Phase 1: Flow Reorder | 5 tasks | ~80K |
| Phase 2: Architecture | 5 tasks | ~95K |
| Phase 3: Carried from 62 | 2 tasks | ~25K |
| Phase 4: Build Fixes | 2 tasks | ~30K |
| Phase 5: Review | 1 task | ~20K |
| **Total** | **15 tasks** | **~250K** |

---

## Notes

This sprint addresses the root cause of the onboarding bugs discovered in SPRINT-062. Rather than adding more guards and conditional logic, we fix the fundamental flow order so the database is always initialized before email connection.

The architecture cleanup (Phase 2) is optional but recommended - it sets up the codebase for better maintainability and future platform support (e.g., web-only version).

---

## Carried Over from SPRINT-062

### TASK-1508: Full Flow USER GATE

**What to test:**
1. Login via browser → license validated → app opens
2. Expired trial blocks access with upgrade prompt
3. Transaction limit shows warning when approaching
4. Device registration works

**Pass criteria:**
- [ ] New user: login → trial created → app opens
- [ ] Expired user: login → blocked with upgrade screen
- [ ] Transaction limit warning shown at limit
- [ ] Device registered on first login
- [ ] Offline grace period works (24 hours)

### Key Bugs Fixed in Sprint 62 (Reference)

| Bug | Task | Fix |
|-----|------|-----|
| Deep link auth not wired | TASK-1507B | Wired handler to frontend |
| currentUser not set after auth | TASK-1507C | Call login() after deep link |
| Local SQLite user not created | TASK-1507D | Create user on deep link auth |
| Existing users missing local user | TASK-1507E | Sync on session restore |
| User ID mismatch | TASK-1507F | Send local ID to renderer |
| Unified user IDs | TASK-1507G | Use Supabase ID everywhere |
| URL fragment parsing | TASK-1508A | Parse # params not just ? |
| Returning users T&C | TASK-1509A | Sync terms from cloud |
| Deferred DB init stuck | TASK-1512 | Wait for DB before advancing |
| Onboarding loop | TASK-1513 | ID-based step tracking |

### Architecture Insights from Investigation

**Current Architecture Problems:**
1. No service layer in renderer - components call `window.api` directly
2. State hooks have business logic mixed in
3. "Pending" state complexity spreads across layers
4. Tight coupling between state and platform APIs

**Target Architecture:**
```
UI Layer → State Layer → Service Layer → Platform Layer
(pure)     (coordinator)   (abstraction)  (window.api)
```

### Onboarding Bug Root Cause

The EMAIL_CONNECTED handler in OnboardingFlow.tsx calls `handleEmailOnboardingComplete()` which tries to write to DB. But for first-time macOS users, DB isn't initialized until the keychain step which comes AFTER the email step.

**Fix:** Reorder flow so DB init happens before email connection.
