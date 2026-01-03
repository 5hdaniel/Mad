# SPRINT-019: Database Initialization Gate

**Status:** READY TO START
**Created:** 2026-01-03
**Target:** develop

---

## Executive Summary

Fix the recurring "Database is not initialized" error by implementing a comprehensive app-level gate. This bug has been fixed piecemeal 4+ times - this sprint implements the user's request: "the app won't even start without the database initialized."

### Sprint Goals

1. Add app-level gate blocking UI until database is ready
2. Add defensive guards to transaction-related modals
3. Ensure error cannot occur in normal usage

### Background

From BACKLOG-139 analysis:
- Navigation flow guards routing but modals bypass it
- `AppModals.tsx` checks `currentUser` and `authProvider` but NOT `isDatabaseInitialized`
- User can open Transactions modal while DB is still initializing

---

## Task List

| ID | Title | Category | Est Tokens | Token Cap |
|----|-------|----------|------------|-----------|
| TASK-924 | Add app-level database initialization gate | fix | ~40K | 160K |

---

## TASK-924: Add App-Level Database Initialization Gate

### Goal

Prevent ALL user interaction with database-dependent features until `isDatabaseInitialized === true`.

### Non-Goals

- Do NOT change database initialization logic itself
- Do NOT change OAuth flows (already have guards)
- Do NOT refactor the entire auth flow

### Files to Modify

| File | Change |
|------|--------|
| `src/appCore/AppShell.tsx` | Add primary gate before main content |
| `src/appCore/AppModals.tsx` | Add `isDatabaseInitialized` to modal guards |
| `src/components/TransactionList.tsx` | Add defensive check (belt-and-suspenders) |
| `src/components/Transactions.tsx` | Add defensive check |
| `src/components/Contacts.tsx` | Add defensive check |

### Implementation

#### Step 1: AppShell Gate (Primary Defense)

In `AppShell.tsx`, add gate before rendering content:

```tsx
// After getting isDatabaseInitialized from app state
if (isAuthenticated && !isDatabaseInitialized) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Initializing secure storage...</p>
      </div>
    </div>
  );
}
```

#### Step 2: AppModals Guard (Secondary Defense)

In `AppModals.tsx`, add `isDatabaseInitialized` to all DB-dependent modals:

```tsx
// Line ~99 - Transactions
{modalState.showTransactions && currentUser && authProvider && isDatabaseInitialized && (

// Line ~110 - Contacts
{modalState.showContacts && currentUser && isDatabaseInitialized && (
```

#### Step 3: Component Guards (Belt-and-Suspenders)

In `TransactionList.tsx`, `Transactions.tsx`, `Contacts.tsx`, add early return:

```tsx
// At top of component, get isDatabaseInitialized from context or prop
const { isDatabaseInitialized } = useAppStateMachine();

// Early return if not ready
if (!isDatabaseInitialized) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">Waiting for database...</p>
    </div>
  );
}
```

### Acceptance Criteria

- [ ] App shows loading state when authenticated but DB not ready
- [ ] Transactions modal cannot open until DB initialized
- [ ] Contacts modal cannot open until DB initialized
- [ ] No "Database is not initialized" error in normal usage
- [ ] Works on macOS and Windows
- [ ] Works for new and returning users
- [ ] No regression in startup time

### Testing

| Test | Method |
|------|--------|
| macOS new user | Create new account, verify loading state during DB init |
| macOS returning user | Login, verify no error on quick action |
| Windows new user | Create new account, verify loading state |
| Windows returning user | Login, click Auto Detect quickly |
| Race condition | Click "View Transactions" rapidly during startup |

### Stop-and-Ask Triggers

- If `isDatabaseInitialized` is not accessible in AppShell/AppModals
- If adding the gate causes infinite loading
- If platform-specific logic is unclear

---

## Dependency Graph

```
TASK-924 (single task - comprehensive fix)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gate causes infinite loading | Low | High | Test on both platforms, verify isDatabaseInitialized becomes true |
| State not accessible in components | Low | Medium | Trace state flow, may need prop drilling or context |
| Breaks existing flows | Low | Medium | Test all login scenarios |

---

## End-of-Sprint Validation

- [ ] Cannot trigger "Database is not initialized" error
- [ ] App shows loading during DB initialization
- [ ] No regression in normal startup flow
- [ ] PR merged to develop
