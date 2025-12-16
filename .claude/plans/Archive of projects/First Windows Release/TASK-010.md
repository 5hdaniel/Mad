# TASK-010: Platform Feature Toggle

## Task Info
- **Task ID:** TASK-010
- **Phase:** 3 - UI/UX
- **Dependencies:** None
- **Can Start:** Immediately
- **Estimated Effort:** 2-3 days

## Goal

Create a platform detection system that shows/hides features based on the operating system. On macOS, show local Messages access. On Windows, show iPhone USB sync.

## Background

The app has different capabilities on different platforms:
- **macOS**: Can access local Messages.app database directly
- **Windows**: Must sync from iPhone via USB

We need to detect the platform and adjust the UI accordingly.

## Deliverables

1. Platform detection utility
2. Platform-aware feature components
3. Updated navigation/UI for platform differences
4. Platform context provider

## Technical Requirements

### 1. Create Platform Detection Utility

Create `src/utils/platform.ts`:

```typescript
export type Platform = 'macos' | 'windows' | 'linux';

export function getPlatform(): Platform {
  // In Electron, we can access process.platform via preload
  const platform = window.electron?.platform || 'unknown';

  switch (platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      return 'windows'; // Default to Windows for safety
  }
}

export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

// Feature availability by platform
export const platformFeatures = {
  localMessagesAccess: ['macos'],
  localContactsAccess: ['macos'],
  iPhoneUSBSync: ['windows', 'linux'],
  emailIntegration: ['macos', 'windows', 'linux'],
} as const;

export function isFeatureAvailable(feature: keyof typeof platformFeatures): boolean {
  const platform = getPlatform();
  return platformFeatures[feature].includes(platform);
}
```

### 2. Create Platform Context

Create `src/contexts/PlatformContext.tsx`:

```typescript
import React, { createContext, useContext, ReactNode } from 'react';
import { Platform, getPlatform, isFeatureAvailable, platformFeatures } from '../utils/platform';

interface PlatformContextType {
  platform: Platform;
  isFeatureAvailable: (feature: keyof typeof platformFeatures) => boolean;
  isMacOS: boolean;
  isWindows: boolean;
}

const PlatformContext = createContext<PlatformContextType | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const platform = getPlatform();

  const value: PlatformContextType = {
    platform,
    isFeatureAvailable,
    isMacOS: platform === 'macos',
    isWindows: platform === 'windows',
  };

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextType {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
}
```

### 3. Create Platform-Aware Component Wrapper

Create `src/components/platform/PlatformOnly.tsx`:

```typescript
import React, { ReactNode } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';
import { Platform } from '../../utils/platform';

interface PlatformOnlyProps {
  platforms: Platform[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const PlatformOnly: React.FC<PlatformOnlyProps> = ({
  platforms,
  children,
  fallback = null
}) => {
  const { platform } = usePlatform();

  if (platforms.includes(platform)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

// Convenience components
export const MacOSOnly: React.FC<{ children: ReactNode; fallback?: ReactNode }> = (props) => (
  <PlatformOnly platforms={['macos']} {...props} />
);

export const WindowsOnly: React.FC<{ children: ReactNode; fallback?: ReactNode }> = (props) => (
  <PlatformOnly platforms={['windows']} {...props} />
);

export const DesktopOnly: React.FC<{ children: ReactNode; fallback?: ReactNode }> = (props) => (
  <PlatformOnly platforms={['macos', 'windows', 'linux']} {...props} />
);
```

### 4. Create Feature-Aware Component Wrapper

Create `src/components/platform/FeatureGate.tsx`:

```typescript
import React, { ReactNode } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';
import { platformFeatures } from '../../utils/platform';

interface FeatureGateProps {
  feature: keyof typeof platformFeatures;
  children: ReactNode;
  fallback?: ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback = null
}) => {
  const { isFeatureAvailable } = usePlatform();

  if (isFeatureAvailable(feature)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
```

### 5. Update Preload to Expose Platform

Add to `electron/preload.ts`:

```typescript
contextBridge.exposeInMainWorld('electron', {
  // ... existing exports
  platform: process.platform,
});
```

### 6. Example Usage in Existing Components

```typescript
// In a component that shows message sources
import { FeatureGate } from './platform/FeatureGate';
import { MacOSOnly, WindowsOnly } from './platform/PlatformOnly';

const MessageSourceSelector: React.FC = () => {
  return (
    <div>
      {/* macOS: Show local Messages option */}
      <FeatureGate feature="localMessagesAccess">
        <button onClick={openLocalMessages}>
          <AppleIcon /> Messages App
        </button>
      </FeatureGate>

      {/* Windows: Show iPhone sync option */}
      <FeatureGate feature="iPhoneUSBSync">
        <button onClick={openIPhoneSync}>
          <PhoneIcon /> Sync from iPhone
        </button>
      </FeatureGate>

      {/* Both platforms: Email integration */}
      <FeatureGate feature="emailIntegration">
        <button onClick={openEmailSetup}>
          <MailIcon /> Email
        </button>
      </FeatureGate>
    </div>
  );
};
```

## Files to Create

- `src/utils/platform.ts`
- `src/contexts/PlatformContext.tsx`
- `src/components/platform/PlatformOnly.tsx`
- `src/components/platform/FeatureGate.tsx`
- `src/components/platform/index.ts` (exports)

## Files to Modify

- `electron/preload.ts` - Expose platform
- `src/types/electron.d.ts` - Add platform type
- `src/App.tsx` - Wrap with PlatformProvider
- Any existing components that need platform-specific behavior

## Dos

- ✅ Use context for platform state (avoid prop drilling)
- ✅ Make feature gates declarative and easy to use
- ✅ Default to safest option if platform unknown
- ✅ Keep platform checks centralized in utilities
- ✅ Document which features are available on which platforms

## Don'ts

- ❌ Don't scatter `process.platform` checks throughout codebase
- ❌ Don't assume platform without checking
- ❌ Don't show broken/unavailable features to users
- ❌ Don't make platform detection async if not necessary

## Testing Instructions

1. Test on macOS - verify local Messages option shows
2. Test on Windows - verify iPhone sync option shows
3. Test feature gates with mock platform values
4. Test fallback rendering
5. Verify email integration shows on both platforms

## Mock Platform for Testing

```typescript
// In tests, mock the platform
jest.mock('../utils/platform', () => ({
  ...jest.requireActual('../utils/platform'),
  getPlatform: () => 'windows', // or 'macos'
}));
```

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Platform detection works correctly
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Tests added for platform utilities
- [ ] Merged latest from main branch
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
claude/complete-task-010-011ivUXXXCeZd47JvYE5JEiF
```

### Changes Made
```
Files Created:
- src/utils/platform.ts - Platform detection utility with getPlatform(), isMacOS(), isWindows(), isLinux(), isFeatureAvailable() functions and platformFeatures config
- src/contexts/PlatformContext.tsx - React context provider for platform state with usePlatform() hook
- src/components/platform/PlatformOnly.tsx - PlatformOnly, MacOSOnly, WindowsOnly, LinuxOnly, DesktopOnly components
- src/components/platform/FeatureGate.tsx - FeatureGate component for feature-based conditional rendering
- src/components/platform/index.ts - Exports for all platform components
- src/utils/__tests__/platform.test.ts - Unit tests for platform utility functions
- src/contexts/__tests__/PlatformContext.test.tsx - Unit tests for PlatformContext
- src/components/platform/__tests__/PlatformComponents.test.tsx - Unit tests for platform components

Files Modified:
- electron/preload.ts - Added platform: process.platform to electron namespace
- src/window.d.ts - Added platform type to ElectronAPI interface
- src/contexts/index.ts - Added PlatformProvider and usePlatform exports
- src/main.tsx - Wrapped App with PlatformProvider
```

### Testing Done
```
- Created comprehensive unit tests for:
  - Platform detection utility (getPlatform, isMacOS, isWindows, isLinux)
  - Feature availability checks (isFeatureAvailable for all features)
  - PlatformContext provider and usePlatform hook
  - All platform components (PlatformOnly, MacOSOnly, WindowsOnly, LinuxOnly, DesktopOnly, FeatureGate)
- Tests cover all three platforms (darwin/macos, win32/windows, linux)
- Tests verify fallback rendering and feature gates
- Note: npm install had network issues; tests written but couldn't run in CI environment
```

### Notes/Issues Encountered
```
- npm install failed with ECONNRESET when downloading Electron binary
- eslint-plugin-react not found (pre-existing environment issue)
- Type-check shows pre-existing errors in electron/ folder (module resolution)
- All new code follows task requirements and TypeScript best practices
- Platform defaults to 'windows' when detection fails (safest option as per task requirements)
```

### PR Link
```
[Will be created after push]
```
