# TASK-1101: Unified Notification System

**Backlog ID:** BACKLOG-289
**Sprint:** SPRINT-040
**Phase:** 1 (Foundation - Parallel Safe)
**Branch:** `feature/task-1101-notification-system`
**Estimated Tokens:** ~40K (UI + context, apply 1.0x multiplier)
**Token Cap:** 160K (4x estimate)

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-16 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1101-notification-system`

### Execution Classification
- **Parallel Safe:** Yes (with TASK-1100)
- **Depends On:** None
- **Blocks:** TASK-1102, TASK-1103 (Phase 2 tasks may use notifications)

### Shared File Analysis
- **Files Created:**
  - `src/components/ui/Notification/*` (new directory)
  - `src/contexts/NotificationContext.tsx` (follows existing pattern)
  - `src/hooks/useNotification.ts`
- **Files Modified:** `src/App.tsx` (adding provider wrapper)
- **Conflicts With:** None - App.tsx change is isolated

### Technical Considerations

1. **App.tsx Architecture Impact:** VERIFIED SAFE
   - Current App.tsx is 35 lines, purely compositional
   - Adding `<NotificationProvider>` wrapper keeps it under 70-line budget
   - **Recommended placement:** Wrap at the outermost level:
     ```tsx
     return (
       <NotificationProvider>
         <AppShell app={app}>
           ...
         </AppShell>
       </NotificationProvider>
     );
     ```

2. **Context Pattern:** Follow existing patterns from:
   - `src/contexts/AuthContext.tsx`
   - `src/contexts/NetworkContext.tsx`
   - `src/contexts/PlatformContext.tsx`
   - Include proper TypeScript types and error handling for missing provider

3. **Coexistence with useToast:** The task correctly notes NOT to remove existing Toast system:
   - 6 files currently use `useToast`: TransactionDetails, TransactionList, Transactions, plus the hook/test/component
   - New notification system should coexist until explicit migration task

4. **Container Rendering Location:** The `NotificationContainer` should render inside the provider, not in AppShell:
   ```tsx
   // Inside NotificationProvider
   return (
     <NotificationContext.Provider value={...}>
       {children}
       <NotificationContainer notifications={...} onDismiss={...} />
     </NotificationContext.Provider>
   );
   ```

5. **Animation:** Use existing `animate-slide-in` class from Toast.tsx for consistency.

### Recommendations

1. **Z-index Layering:** Use `z-[100]` to match existing ToastContainer placement (line 109 of Toast.tsx).

2. **ID Generation:** Use `useRef` counter pattern (as shown in task) for stable IDs - matches existing useToast implementation.

3. **Timer Cleanup:** Use `useRef` to track timeout IDs and clear them on unmount to prevent memory leaks:
   ```tsx
   const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
   useEffect(() => {
     return () => {
       timeoutRefs.current.forEach(clearTimeout);
     };
   }, []);
   ```

4. **Token Estimate:** 40K is reasonable for:
   - 5 new files + 1 test file
   - Context with proper typing
   - Multiple notification variants
   - App.tsx modification

---

## Objective

Create a unified notification system with a centralized API (`notify.success()`, `notify.error()`, etc.) that can be called from anywhere in the app. This replaces ad-hoc toast/notification implementations with a consistent, accessible notification pattern.

---

## Context

### Current State

The app has an existing toast system:
- `src/components/Toast.tsx` - Toast component with variants (success, error, warning, info)
- `src/hooks/useToast.ts` - Hook for managing toast state

The current implementation requires:
1. Importing useToast hook in each component
2. Calling `addToast()` with message and type
3. Managing toast state locally or passing it down

This works but is inconsistent - some components use it, others don't.

### Goal

Create a unified notification system that:
1. Provides a global `notify` API accessible via hook
2. Centralizes all notification rendering in one place (App root)
3. Supports all notification types with consistent styling
4. Handles auto-dismiss, manual dismiss, and action buttons
5. Is accessible (ARIA live regions, keyboard support)

---

## Requirements

### Must Do:

1. **Create notification structure:**
   ```
   src/components/ui/Notification/
   ├── index.ts
   ├── NotificationToast.tsx
   ├── NotificationContainer.tsx
   ├── types.ts
   └── __tests__/
       └── Notification.test.tsx

   src/contexts/
   └── NotificationContext.tsx

   src/hooks/
   └── useNotification.ts
   ```

2. **Implement NotificationContext:**
   ```typescript
   interface NotificationContextValue {
     notify: {
       success: (message: string, options?: NotificationOptions) => void;
       error: (message: string, options?: NotificationOptions) => void;
       warning: (message: string, options?: NotificationOptions) => void;
       info: (message: string, options?: NotificationOptions) => void;
     };
     dismiss: (id: string) => void;
     dismissAll: () => void;
   }

   interface NotificationOptions {
     duration?: number;       // Auto-dismiss after ms (default: 3000, 0 = persistent)
     persistent?: boolean;    // Equivalent to duration: 0
     action?: {
       label: string;
       onClick: () => void;
     };
   }
   ```

3. **Implement NotificationToast component:**
   - Four variants: success (green), error (red), warning (amber), info (blue)
   - Dismiss button (X)
   - Optional action button
   - Slide-in animation
   - Consistent with existing Toast.tsx styling

4. **Implement NotificationContainer:**
   - Positioned fixed at bottom-right
   - Stacks notifications vertically
   - Maximum 5 visible (older auto-dismiss when exceeded)
   - Proper z-index layering

5. **Implement useNotification hook:**
   ```typescript
   function useNotification(): NotificationContextValue;
   ```

6. **Add NotificationProvider to App.tsx:**
   ```tsx
   <NotificationProvider>
     {/* existing app content */}
   </NotificationProvider>
   ```

### Must NOT Do:

- Do NOT remove the existing `src/components/Toast.tsx` (may still be in use)
- Do NOT modify existing components to use the new system (migration is separate work)
- Do NOT add sound effects or OS-level notifications
- Do NOT persist notifications across page reloads

---

## Acceptance Criteria

- [ ] NotificationContext created at `src/contexts/NotificationContext.tsx`
- [ ] useNotification hook created at `src/hooks/useNotification.ts`
- [ ] NotificationToast component renders all 4 types correctly
- [ ] NotificationContainer positions notifications at bottom-right
- [ ] Auto-dismiss works with configurable duration
- [ ] Manual dismiss (X button) works
- [ ] Action button renders and triggers callback when clicked
- [ ] Persistent notifications don't auto-dismiss
- [ ] Maximum 5 notifications visible (FIFO)
- [ ] NotificationProvider added to App.tsx
- [ ] All props are properly typed (no `any`)
- [ ] Unit tests for context, hook, and components
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] Accessible: ARIA live region for announcements

---

## Files to Create

- `src/components/ui/Notification/index.ts` - Exports
- `src/components/ui/Notification/NotificationToast.tsx` - Single notification component
- `src/components/ui/Notification/NotificationContainer.tsx` - Stacked notifications
- `src/components/ui/Notification/types.ts` - TypeScript interfaces
- `src/components/ui/Notification/__tests__/Notification.test.tsx` - Tests
- `src/contexts/NotificationContext.tsx` - Context and provider
- `src/hooks/useNotification.ts` - Hook for consuming notifications

## Files to Modify

- `src/App.tsx` - Wrap with NotificationProvider

## Files to Read (for context)

- `src/components/Toast.tsx` - Existing toast component (styling reference)
- `src/hooks/useToast.ts` - Existing toast hook (API reference)

---

## Implementation Notes

### API Usage Examples

```typescript
// Simple usage
const { notify } = useNotification();
notify.success("Transaction saved successfully");
notify.error("Failed to connect to email provider");
notify.warning("Sync may take longer than usual");
notify.info("New messages detected");

// With options
notify.success("Transaction saved", {
  duration: 5000,
  action: {
    label: "View",
    onClick: () => navigate("/transactions/123")
  }
});

// Persistent (no auto-dismiss)
notify.error("Connection lost", { persistent: true });
```

### Context Implementation Pattern

```typescript
// NotificationContext.tsx
const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idRef = useRef(0);

  const addNotification = useCallback((
    type: NotificationType,
    message: string,
    options?: NotificationOptions
  ) => {
    const id = String(++idRef.current);
    const notification: Notification = {
      id,
      type,
      message,
      duration: options?.persistent ? 0 : (options?.duration ?? 3000),
      action: options?.action,
    };

    setNotifications(prev => {
      // Keep max 5 notifications
      const updated = [...prev, notification];
      return updated.slice(-5);
    });

    // Auto-dismiss
    if (notification.duration > 0) {
      setTimeout(() => dismiss(id), notification.duration);
    }
  }, []);

  const notify = useMemo(() => ({
    success: (msg: string, opts?: NotificationOptions) =>
      addNotification('success', msg, opts),
    error: (msg: string, opts?: NotificationOptions) =>
      addNotification('error', msg, opts),
    warning: (msg: string, opts?: NotificationOptions) =>
      addNotification('warning', msg, opts),
    info: (msg: string, opts?: NotificationOptions) =>
      addNotification('info', msg, opts),
  }), [addNotification]);

  // ... dismiss, dismissAll

  return (
    <NotificationContext.Provider value={{ notify, dismiss, dismissAll }}>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}
```

### Styling (from existing Toast.tsx)

```tsx
// Success
"bg-green-50 border-green-200 text-green-900"

// Error
"bg-red-50 border-red-200 text-red-900"

// Warning
"bg-amber-50 border-amber-200 text-amber-900"

// Info
"bg-blue-50 border-blue-200 text-blue-900"
```

### Accessibility

```tsx
// Container with live region
<div
  role="region"
  aria-live="polite"
  aria-label="Notifications"
>
  {/* notifications */}
</div>
```

---

## Testing Expectations

### Unit Tests

**Required:** Yes

**New tests to write:**
1. `NotificationProvider renders children`
2. `useNotification returns notify methods`
3. `notify.success adds success notification`
4. `notify.error adds error notification`
5. `notify.warning adds warning notification`
6. `notify.info adds info notification`
7. `auto-dismiss removes notification after duration`
8. `persistent notification does not auto-dismiss`
9. `manual dismiss removes notification`
10. `action button triggers callback`
11. `max 5 notifications maintained`
12. `NotificationToast renders correct styling for each type`

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `feat(ui): add unified notification system with context API`
- **Branch:** `feature/task-1101-notification-system`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-01-16*

### Agent ID

**Record this immediately when starting:**
```
Engineer Agent ID: 011CWc7f14JRQTbQAZqCBbGS
```

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: 2026-01-16
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test) - 26 tests passing
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint) - new files pass, pre-existing issue in ContactSelectModal.tsx unrelated

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

- **Before**: Ad-hoc toast usage via useToast hook in individual components
- **After**: Unified `notify.success/error/warning/info` API via NotificationContext
- **Actual Tokens**: ~15K (Est: 40K)
- **PR**: https://github.com/5hdaniel/Mad/pull/439

### Notes

**Deviations from plan:**
None - implementation followed the task requirements exactly.

**Issues encountered:**
- Pre-existing lint error in `src/components/ContactSelectModal.tsx` (line 65) related to ESLint plugin configuration for `react-hooks/exhaustive-deps`. This is unrelated to notification system changes.

---

## Guardrails

**STOP and ask PM if:**
- You're unsure whether to migrate existing useToast usages (answer: no, not in this task)
- The App.tsx modification conflicts with other work
- You need to add dependencies (libraries like react-hot-toast)
- You encounter blockers not covered in the task file
