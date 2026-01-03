# TASK-924: Add App-Level Database Initialization Gate

**Sprint:** SPRINT-019 (Database Initialization Gate)
**Category:** fix
**Priority:** Critical
**Backlog:** BACKLOG-139

---

## PM Estimate

| Metric | Value |
|--------|-------|
| **Est. Billable Tokens** | ~40K |
| **Token Cap** | 160K |
| **Category Multiplier** | 1.0x (fix - but touches multiple files) |

---

## Goal

Prevent ALL user interaction with database-dependent features until `isDatabaseInitialized === true`. This is a comprehensive fix for a recurring bug that has been patched piecemeal 4+ times.

## Non-Goals

- Do NOT change database initialization logic itself
- Do NOT change OAuth flows (already have guards)
- Do NOT refactor the entire auth flow
- Do NOT add new loading screens beyond the gate

## Context

The "Database is not initialized" error keeps recurring because:
1. Navigation flow guards routing but modals bypass it
2. `AppModals.tsx` checks `currentUser` and `authProvider` but NOT `isDatabaseInitialized`
3. User can open Transactions modal while DB is still initializing

Previous fixes (piecemeal, incomplete):
- Dec 12: EmailOnboardingScreen fallback
- Dec 16: Windows returning user auto-init
- Dec 28: Google OAuth DB check
- Jan 2: Navigation guard

## Deliverables

| File | Action |
|------|--------|
| `src/appCore/AppShell.tsx` | Add primary gate before main content |
| `src/appCore/AppModals.tsx` | Add `isDatabaseInitialized` to modal guards |
| `src/components/TransactionList.tsx` | Add defensive check |
| `src/components/Transactions.tsx` | Add defensive check |
| `src/components/Contacts.tsx` | Add defensive check |
| `src/components/AuditTransactionModal.tsx` | Add defensive check (SR Engineer addition) |

---

## Implementation

### Step 1: AppShell Gate (Primary Defense)

This is the main gate. Find where `AppShell` renders its children and add:

```tsx
// Get isDatabaseInitialized from app state
const { isDatabaseInitialized, isAuthenticated } = useAppStateMachine();

// Gate: Block all content until DB ready for authenticated users
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

### Step 2: AppModals Guard (Secondary Defense)

In `AppModals.tsx`, the `isDatabaseInitialized` needs to be passed or accessed. Add it to the guards:

**Line ~99 (Transactions):**
```tsx
{modalState.showTransactions && currentUser && authProvider && isDatabaseInitialized && (
```

**Line ~110 (Contacts):**
```tsx
{modalState.showContacts && currentUser && isDatabaseInitialized && (
```

### Step 3: Component Guards (Belt-and-Suspenders)

These are defensive - should never trigger if Step 1 works, but prevents the error if something slips through.

**TransactionList.tsx / Transactions.tsx / Contacts.tsx:**
```tsx
// Option A: Access from context
const { isDatabaseInitialized } = useAppStateMachine();

// Option B: Add as prop if context not available
interface Props {
  // ... existing props
  isDatabaseInitialized?: boolean;
}

// Early return
if (!isDatabaseInitialized) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-gray-500 text-sm">Waiting for database...</p>
      </div>
    </div>
  );
}
```

---

## Acceptance Criteria

- [ ] App shows loading state when authenticated but DB not ready
- [ ] Transactions modal cannot render content until DB initialized
- [ ] Contacts modal cannot render content until DB initialized
- [ ] No "Database is not initialized" error in normal usage
- [ ] Works on macOS (keychain flow) and Windows (DPAPI flow)
- [ ] Works for new users (onboarding) and returning users (quick login)
- [ ] No infinite loading (isDatabaseInitialized eventually becomes true)
- [ ] No regression in normal startup time

---

## Testing

| Scenario | Expected |
|----------|----------|
| macOS new user | Loading shown during keychain setup, then app |
| macOS returning user | Brief loading (if any), then app |
| Windows new user | Loading shown during DPAPI setup, then app |
| Windows returning user | Brief loading (if any), then app |
| Rapid "View Transactions" click | Loading or nothing, no error |
| Normal transaction scan | Works after DB initialized |

---

## Stop-and-Ask Triggers

- If `isDatabaseInitialized` is not accessible in AppShell or AppModals
- If adding the gate causes infinite loading on any platform
- If the state flow is unclear or different than expected
- If you need to modify the database initialization logic itself
- If BackgroundServices requires database access during init (verify compatibility)
- If `useAppStateMachine()` cannot be imported in TransactionList/Transactions/Contacts

---

## SR Engineer Review Notes

**Review Date:** 2026-01-03 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-924-database-init-gate

### Execution Classification
- **Parallel Safe:** Yes (single task sprint)
- **Depends On:** None
- **Blocks:** None

### Technical Considerations
- `isDatabaseInitialized` is already exposed via `useAppStateMachine()` (line 269)
- Components can import the hook directly for defensive checks
- Gate in AppShell blocks children including AppModals - this is correct
- Verify BackgroundServices doesn't require DB during init

### Scope Addition
- ADDED `AuditTransactionModal.tsx` to scope (same race condition applies)

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer after implementation*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

- [ ] Read task file completely
- [ ] Understood the state flow (isDatabaseInitialized source)
- [ ] Created branch from develop
- [ ] Implemented AppShell gate
- [ ] Implemented AppModals guards
- [ ] Implemented component defensive checks
- [ ] Tested on simulated scenarios
- [ ] PR created using template

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Billable Tokens** | |
| Total Tokens | |
| Duration | seconds |
| API Calls | |

**Variance:** PM Est ~40K billable vs Actual

### Notes

**Approach taken:**
**Issues encountered:**
**Platform-specific considerations:**
