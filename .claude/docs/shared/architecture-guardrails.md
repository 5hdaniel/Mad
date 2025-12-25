# Architecture Guardrails

**Status:** Canonical reference for code architecture standards
**Last Updated:** 2024-12-24

---

## Entry File Line Budgets

These limits are enforced in PR reviews.

| File | Target | Trigger | Purpose |
|------|--------|---------|---------|
| `App.tsx` | **70** | >100 | Root composition, providers only |
| `AppShell.tsx` | **150** | >200 | Window chrome, title bar, offline banner |
| `AppRouter.tsx` | **250** | >300 | Screen routing/selection only |
| `AppModals.tsx` | **120** | >150 | Modal rendering only |
| `useAppStateMachine.ts` | **300** | >400 | Orchestrator, delegates to flows |

**How to read this:**
- **Target**: Ideal line count - aim to stay at or below this
- **Trigger**: Hard limit - exceeding this requires mandatory extraction before merge

---

## App.tsx Rules

**App.tsx MUST only contain:**
- Top-level providers (theme, auth, context)
- Main shell/layout composition
- Router/screen selection delegation
- Minimal wiring logic (~70 lines max)

**App.tsx MUST NOT contain:**
- Business logic or feature-specific code
- API calls, IPC usage, or data fetching
- Complex useEffect hooks or state machines
- Onboarding flows, permissions logic, or secure storage setup
- Direct `window.api` or `window.electron` calls

**Example of correct App.tsx:**
```typescript
function App() {
  const app = useAppStateMachine();

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell app={app}>
          <AppRouter app={app} />
          <AppModals app={app} />
          <BackgroundServices />
        </AppShell>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

---

## Electron Layer Responsibilities

### main.ts
- Window lifecycle management
- Process-level concerns and top-level wiring
- IPC handler registration (delegating to services)
- App-level event handling

### preload.ts
- Narrow, typed bridge to renderer
- Expose minimal, well-defined API surface
- NO business logic

### Renderer Code
- Access Electron APIs via service modules/hooks only
- NEVER scatter `window.api`/`window.electron` calls in components
- Use typed service abstractions

---

## State Machine API Patterns

The app state machine exposes a **typed interface with semantic methods**, not raw state + setters.

**DO: Expose semantic transitions**
```typescript
export interface AppStateMachine {
  // State (read-only from consumer perspective)
  currentStep: AppStep;
  isAuthenticated: boolean;
  currentUser: User | null;
  modalState: { showProfile: boolean; showSettings: boolean };

  // Semantic transitions (verbs, not setters)
  openProfile(): void;
  closeProfile(): void;
  goToStep(step: AppStep): void;
  completeExport(result: ExportResult): void;
  handleLoginSuccess(data: LoginData): void;
}
```

**DON'T: Expose raw setters**
```typescript
// BAD - leaks internal state shape
state.setShowProfile(true);
state.setCurrentStep("email-onboarding");
```

**Pass state machine object to child components:**
```tsx
// GOOD - single typed API object
<AppRouter app={app} />
<AppModals app={app} />

// BAD - prop drilling dozens of individual values
<AppRouter
  currentStep={state.currentStep}
  setCurrentStep={state.setCurrentStep}
  isAuthenticated={state.isAuthenticated}
  // ... 40 more props
/>
```

---

## Complex Flow Patterns

Multi-step flows (onboarding, secure storage, permissions) MUST be implemented as:
- Dedicated hooks (`useOnboardingFlow`, `useSecureStorageSetup`)
- Feature modules (`/onboarding`, `/dashboard`, `/settings`)
- State machines for complex state transitions
- Feature-specific routers when needed

These flows MUST NOT be hard-wired into global entry files.

**Target structure:**
```
src/
├── App.tsx                        (~70 lines max)
├── app/
│   ├── AppShell.tsx               (~150 lines)
│   ├── AppRouter.tsx              (~250 lines)
│   ├── AppModals.tsx              (~120 lines)
│   ├── BackgroundServices.tsx     (~50 lines)
│   └── state/
│       ├── types.ts
│       ├── useAppStateMachine.ts  (~300 lines)
│       └── flows/
│           ├── useAuthFlow.ts
│           ├── useSecureStorageFlow.ts
│           ├── usePhoneOnboardingFlow.ts
│           ├── useEmailOnboardingFlow.ts
│           └── usePermissionsFlow.ts
```

---

## PR Review Enforcement

When reviewing PRs, check for:

- [ ] **Entry file changes**: Is new code compositional or adding logic?
- [ ] **Line budget compliance**: Do entry files exceed limits?
- [ ] **New `window.api` usage**: Is it behind a service/hook abstraction?
- [ ] **Feature logic location**: Is it in a feature module or leaking into shared files?
- [ ] **Complex flows**: Are they using established patterns (hooks, state machines)?
- [ ] **Entry file growth**: Does this change push toward extraction/refactor?

**If any check fails**: Request changes with specific guidance on the correct pattern.

---

## DO / DON'T Summary

### DO
- Keep `App.tsx` under tight control: orchestrates, not implements
- Centralize complex flows into dedicated hooks/state machines
- Isolate Electron specifics behind typed services/hooks
- Reject PRs that add business logic to entry files
- Require extraction when entry files grow

### DON'T
- Let `App.tsx` become a 1,000-line mix of UI, logic, IPC, and effects
- Embed onboarding/permissions/storage logic in app shells
- Sprinkle `window.api`/`window.electron` calls across components
- Allow "just this once" hacks without a migration path
- Approve code that increases coupling across layers
