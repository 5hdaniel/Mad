# TASK-513: Fix Toast Notification Persistence

**Sprint:** SPRINT-008-transactionlist-refactoring
**Priority:** HIGH (Blocking)
**Type:** Bug Fix
**Branch:** `refactor/TASK-513-toast-fix` from `feature/transaction-list-ui-refinements`

---

## Estimates

| Metric | Estimate | Confidence |
|--------|----------|------------|
| Turns | 4-6 | High |
| Tokens | ~20K | High |
| Time | 30-45 min | High |

**Basis:** Simple prop drilling pattern, well-defined scope, existing useToast hook.

---

## Metrics Tracking (REQUIRED)

Track and report at task completion:

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |

---

## Problem Statement

Toast notifications are not visible when users approve, reject, or restore transactions. The root cause is that `ToastContainer` is rendered inside `TransactionDetails.tsx`, which is a modal. When actions complete, the modal closes via `onClose()`, unmounting the `ToastContainer` before the toast can be displayed.

**User Impact:** Users don't see confirmation that their action succeeded or failed.

---

## Solution

Lift `useToast` and `ToastContainer` from `TransactionDetails.tsx` to `TransactionList.tsx`. Pass toast handler functions as props to `TransactionDetails`.

---

## Acceptance Criteria

- [ ] `ToastContainer` renders in `TransactionList.tsx` (persists after modal close)
- [ ] Toast appears and stays visible for ~3 seconds after approve action
- [ ] Toast appears and stays visible for ~3 seconds after reject action
- [ ] Toast appears and stays visible for ~3 seconds after restore action
- [ ] Error toasts display when actions fail
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Manual verification: toasts visible in all scenarios

---

## Implementation Steps

### Step 1: Add toast hook to TransactionList.tsx

```typescript
// In TransactionList.tsx, add import and hook
import { useToast, ToastContainer } from "@/hooks/useToast";

// Inside TransactionList component
const { toasts, showSuccess, showError, removeToast } = useToast();
```

### Step 2: Add ToastContainer to TransactionList render

```tsx
// At the end of TransactionList's return, before final closing tag
<ToastContainer toasts={toasts} onRemove={removeToast} />
```

### Step 3: Update TransactionDetails props interface

```typescript
// Add to TransactionDetailsProps
interface TransactionDetailsProps {
  // ... existing props
  onShowSuccess?: (message: string) => void;
  onShowError?: (message: string) => void;
}
```

### Step 4: Pass toast handlers to TransactionDetails

```tsx
// When rendering TransactionDetails
<TransactionDetails
  // ... existing props
  onShowSuccess={showSuccess}
  onShowError={showError}
/>
```

### Step 5: Update TransactionDetails to use prop handlers

```typescript
// In TransactionDetails.tsx
// Replace local useToast with prop handlers
// Before:
const { showSuccess, showError } = useToast();

// After:
// Use props.onShowSuccess and props.onShowError
// Remove local useToast import and ToastContainer render
```

### Step 6: Remove ToastContainer from TransactionDetails

Remove the `<ToastContainer>` component from `TransactionDetails.tsx` render.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/TransactionList.tsx` | Add useToast, ToastContainer, pass handlers |
| `src/components/TransactionDetails.tsx` | Accept toast props, remove local toast |

---

## Testing Checklist

- [ ] Approve a pending transaction → success toast visible for 3s
- [ ] Reject a pending transaction → success toast visible for 3s
- [ ] Restore a rejected transaction → success toast visible for 3s
- [ ] Simulate API error → error toast visible
- [ ] Multiple actions in sequence → toasts stack correctly

---

## Guardrails

- DO NOT modify TransactionDetails business logic
- DO NOT change toast message content
- DO NOT modify other components
- ONLY touch toast-related code

---

## Definition of Done

1. All acceptance criteria checked
2. Metrics recorded above
3. PR created targeting `feature/transaction-list-ui-refinements`
4. Ready for SR Engineer review
