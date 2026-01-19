# BACKLOG-166: Platform Detection Returns "unknown" in Renderer

## Problem
The platform detection in `src/utils/platform.ts` returns "unknown" instead of the actual platform (e.g., "darwin" for macOS), causing the warning:

```
[Platform] Unknown platform detected: "unknown". Defaulting to Windows.
```

This affects feature availability checks (e.g., whether to show local Messages access or iPhone USB sync options).

## Impact
- **User Experience**: Users on macOS may see Windows-specific UI/features
- **Functionality**: Platform-specific features may not work correctly
- **Priority**: Medium

## Root Cause Analysis
The code at `src/utils/platform.ts:19`:
```typescript
const platform = window.api?.system?.platform || "unknown";
```

`window.api.system.platform` is exposed via preload (`electron/preload/systemBridge.ts:12`):
```typescript
platform: process.platform,
```

Possible causes:
1. **Timing issue**: PlatformContext renders before `window.api` is populated by contextBridge
2. **Preload not loaded**: The preload script may not have run when the component first renders
3. **contextBridge race condition**: The React app starts before Electron's contextBridge completes

## Potential Fixes

### Option 1: Add null check with retry (Quick Fix)
```typescript
export function getPlatform(): Platform {
  const platform = window.api?.system?.platform;

  if (!platform) {
    // Could be timing issue - check navigator as fallback
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    return 'windows'; // Default
  }
  // ... rest of switch
}
```

### Option 2: Use navigator.platform (More Reliable)
```typescript
export function getPlatform(): Platform {
  // Check Electron API first, fallback to navigator
  const electronPlatform = window.api?.system?.platform;
  const platform = electronPlatform || navigator.platform?.toLowerCase() || 'unknown';

  if (platform.includes('mac') || platform === 'darwin') return 'macos';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';
  return 'windows';
}
```

### Option 3: Defer PlatformContext initialization
Ensure PlatformProvider only renders after window.api is confirmed available.

## Relevant Code
- `src/utils/platform.ts` - Platform detection utility
- `src/contexts/PlatformContext.tsx` - Platform context provider
- `electron/preload/systemBridge.ts` - Exposes platform to renderer

## Acceptance Criteria
- [ ] Platform correctly detected as "macos" on macOS
- [ ] Platform correctly detected as "windows" on Windows
- [ ] No console warnings about unknown platform
- [ ] Feature availability works correctly per platform

## Notes
- Discovered: 2026-01-05
- The CSP warning is expected in dev mode (disappears when packaged)
