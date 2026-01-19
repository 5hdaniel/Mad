# TASK-903: Reduce AppShell.tsx to <150 Lines

**Sprint:** SPRINT-013
**Backlog:** BACKLOG-110
**Priority:** HIGH
**Category:** refactor
**Status:** Pending

---

## Metrics Tracking (REQUIRED)

Track and report at PR submission:

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | - | - | - |
| Implementation (Impl) | - | - | - |
| Debugging (Debug) | - | - | - |
| **Engineer Total** | - | - | - |

**Estimated:** 3-4 turns, ~15K tokens, 10-15 min

---

## Goal

Reduce `AppShell.tsx` from 190 lines to under 150 lines by extracting layout sub-components.

## Non-Goals

- Do NOT change any visual appearance
- Do NOT change component behavior
- Do NOT modify the `AppStateMachine` interface
- Do NOT add new features

---

## Current State

- **Current lines:** 190
- **Target:** < 150 lines
- **Over by:** 40 lines

The file contains:
- Title bar with user menu button
- Offline banner
- Version info button and popup
- Main content area with scrolling

---

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `src/appCore/shell/TitleBar.tsx` | Title bar with user menu |
| `src/appCore/shell/OfflineBanner.tsx` | Offline status banner |
| `src/appCore/shell/VersionPopup.tsx` | Version info popup (if inline) |
| `src/appCore/shell/index.ts` | Barrel export |

### Files to Modify

| File | Change |
|------|--------|
| `src/appCore/AppShell.tsx` | Import from shell/, reduce to < 150 lines |

---

## Implementation Notes

### TitleBar Extraction

```typescript
// src/appCore/shell/TitleBar.tsx
interface TitleBarProps {
  pageTitle: string;
  isAuthenticated: boolean;
  currentUser: User | null;
  onProfileClick: () => void;
}

export function TitleBar({ pageTitle, isAuthenticated, currentUser, onProfileClick }: TitleBarProps) {
  return (
    <div className="flex-shrink-0 bg-gradient-to-b from-gray-100 to-gray-50 ...">
      {/* Title bar content */}
    </div>
  );
}
```

### OfflineBanner Extraction

```typescript
// src/appCore/shell/OfflineBanner.tsx
interface OfflineBannerProps {
  isOnline: boolean;
  isChecking: boolean;
  onRetry: () => void;
}

export function OfflineBanner({ isOnline, isChecking, onRetry }: OfflineBannerProps) {
  if (isOnline) return null;
  return (
    <div className="...">
      {/* Offline banner content */}
    </div>
  );
}
```

---

## Acceptance Criteria

- [ ] `AppShell.tsx` is < 150 lines
- [ ] At least 2 components extracted to `shell/` directory
- [ ] Visual appearance unchanged
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] All existing tests pass

---

## Do / Don't

### Do
- Keep exact same styling and layout
- Pass only necessary props to extracted components
- Use barrel exports for clean imports
- Follow existing code patterns

### Don't
- Change any CSS classes or styling
- Modify component behavior
- Add new props or functionality
- Change the responsive behavior

---

## Stop-and-Ask Triggers

Stop and ask PM if:
- Line count target requires behavior changes
- Component extraction would require prop drilling > 2 levels
- Tests need modification

---

## Testing Expectations

- **No new tests required** - this is pure refactoring
- All existing tests must pass unchanged
- Manual verification: app shell looks identical, user menu works, offline banner works

---

## PR Preparation

**Branch:** `feature/TASK-903-reduce-app-shell`
**Title:** `refactor(shell): reduce AppShell.tsx to <150 lines`
**Labels:** `refactor`, `SPRINT-013`

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** feature/TASK-903-reduce-app-shell

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Technical Considerations
1. **OfflineBanner extraction**: Primary target - saves ~51 lines, gets under 150 alone
2. **VersionPopup**: Optional secondary extraction for additional reduction
3. **TitleBar**: Lower priority - more tightly coupled to app state
4. **Create `shell/index.ts`** barrel export

### Risk Areas
- Preserve exact Tailwind classes and styling
- Pass only necessary props (avoid over-passing AppStateMachine)
- Test offline banner retry button functionality after extraction

---

## Implementation Summary

*To be filled by engineer after completion*
