# BACKLOG-110: Reduce AppShell.tsx to <150 Lines

## Priority: High

## Category: refactor

## Summary

Reduce `AppShell.tsx` from 190 lines to under 150 lines by extracting the version popup and offline banner components.

## Problem

`AppShell.tsx` at 190 lines exceeds the 150-line target defined in `.claude/docs/shared/architecture-guardrails.md`. The file contains inline JSX for UI elements that should be separate components.

**Specific issues:**
1. Version popup logic and JSX inline
2. Offline banner logic and JSX inline
3. Main layout wrapper mixed with feature components

## Solution

### 1. Extract Version Popup Component

```typescript
// src/components/shell/VersionPopup.tsx
interface VersionPopupProps {
  version: string;
  onClose: () => void;
  isOpen: boolean;
}

export const VersionPopup: React.FC<VersionPopupProps> = ({
  version,
  onClose,
  isOpen
}) => {
  if (!isOpen) return null;

  return (
    <div className="version-popup">
      <div className="version-popup-content">
        <h3>Version {version}</h3>
        {/* version details */}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

### 2. Extract Offline Banner Component

```typescript
// src/components/shell/OfflineBanner.tsx
interface OfflineBannerProps {
  isOffline: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline }) => {
  if (!isOffline) return null;

  return (
    <div className="offline-banner">
      <span>You are currently offline</span>
    </div>
  );
};
```

### 3. Update AppShell.tsx

```typescript
// After extraction
import { VersionPopup } from './shell/VersionPopup';
import { OfflineBanner } from './shell/OfflineBanner';

export const AppShell: React.FC = ({ children }) => {
  const { isOffline } = useNetworkStatus();
  const { showVersion, version, closeVersionPopup } = useVersionPopup();

  return (
    <div className="app-shell">
      <OfflineBanner isOffline={isOffline} />
      <Header />
      <main>{children}</main>
      <VersionPopup
        isOpen={showVersion}
        version={version}
        onClose={closeVersionPopup}
      />
    </div>
  );
};
```

## Implementation Steps

1. Create `src/components/shell/` directory
2. Extract `VersionPopup.tsx` with its props interface
3. Extract `OfflineBanner.tsx` with its props interface
4. Update `AppShell.tsx` to import and use extracted components
5. Create barrel export for shell components
6. Run tests

## Acceptance Criteria

- [ ] `AppShell.tsx` reduced to <150 lines
- [ ] `VersionPopup` component extracted with proper types
- [ ] `OfflineBanner` component extracted with proper types
- [ ] All functionality preserved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## Estimated Effort

| Metric | Raw Estimate | Notes |
|--------|--------------|-------|
| Turns | 6-8 | Clean extraction |
| Tokens | ~30K | |
| Time | 45-60 minutes | |

**Calibrated (0.5x refactor multiplier):**
| Metric | Calibrated Estimate |
|--------|---------------------|
| Turns | 3-4 |
| Tokens | ~15K |
| Time | 20-30 minutes |

## Dependencies

- None

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking shell functionality | Test app shell behavior after changes |
| Missing context dependencies | Ensure hooks are properly passed |

## Notes

**This item is SR Engineer sourced from architecture review.**

This is a straightforward extraction task. The components are likely self-contained, making this a clean refactor.

**Files to modify:**
- `src/AppShell.tsx` - Main changes
- `src/components/shell/VersionPopup.tsx` (new)
- `src/components/shell/OfflineBanner.tsx` (new)
- `src/components/shell/index.ts` (new) - Barrel export
