# BACKLOG-496: Create Generic Banner Component for Consistency

## Type
Enhancement

## Priority
Medium

## Status
Open

## Description
Multiple banners in the app have inline styles with slight variations. They should all use a shared `<AppBanner>` component for visual consistency and easier maintenance.

## Current Banners to Refactor

| Location | Banner | Current Style |
|----------|--------|---------------|
| `Dashboard.tsx` | "Complete your account setup" | Amber gradient, rounded, shadow |
| `SystemHealthMonitor.tsx` | Connection/permission warnings | Amber gradient (just updated) |
| `OfflineBanner.tsx` | "You're offline" | Yellow, border-b |
| `SyncLockBanner.tsx` | Sync lock warning | Yellow |

## Requirements

### 1. Create `<AppBanner>` Component

Location: `src/components/shared/AppBanner.tsx`

```typescript
interface AppBannerProps {
  title: string;
  description?: string;
  variant: 'warning' | 'error' | 'info' | 'success';
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}
```

### 2. Consistent Styling

All variants should use:
- Gradient background (e.g., `from-amber-50 to-orange-50`)
- Rounded corners with shadow for inline banners
- Border-b only for fixed top banners
- Consistent icon sizes (w-5 h-5)
- Consistent text sizing (title: text-sm font-semibold, description: text-xs)

### 3. Refactor All Banners

- [ ] Dashboard "Complete your account setup"
- [ ] SystemHealthMonitor warnings
- [ ] OfflineBanner
- [ ] SyncLockBanner
- [ ] Any other inline banners

## Acceptance Criteria

- [ ] Single `<AppBanner>` component created
- [ ] All existing banners refactored to use it
- [ ] Visual consistency across all banner types
- [ ] No regression in functionality (dismiss, actions, etc.)
- [ ] Unit tests for AppBanner component

## Related Files

- `src/components/Dashboard.tsx`
- `src/components/SystemHealthMonitor.tsx`
- `src/appCore/shell/OfflineBanner.tsx`
- `src/components/sync/SyncLockBanner.tsx`

## Created
2025-01-24
