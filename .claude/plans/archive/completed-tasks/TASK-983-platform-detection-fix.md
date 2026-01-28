# TASK-983: Fix Platform Detection Returns "unknown"

**Sprint**: SPRINT-026
**Priority**: Medium
**Estimate**: 15,000 tokens
**Status**: Ready
**Dependencies**: TASK-979, TASK-980
**Backlog**: BACKLOG-166

---

## Objective

Fix platform detection returning "unknown" instead of the actual platform (e.g., "darwin" for macOS).

## Context

The platform detection in `src/utils/platform.ts` logs:
```
[Platform] Unknown platform detected: "unknown". Defaulting to Windows.
```

This causes incorrect feature availability (e.g., showing Windows-specific UI on macOS).

## Root Cause Analysis

The code at `src/utils/platform.ts:19`:
```typescript
const platform = window.api?.system?.platform || "unknown";
```

`window.api.system.platform` is exposed via preload (`electron/preload/systemBridge.ts:12`):
```typescript
platform: process.platform,
```

**Likely cause**: PlatformContext renders before `window.api` is populated by contextBridge (timing/race condition).

## Scope

### Must Implement

1. **Add fallback using navigator.platform** in `src/utils/platform.ts`
   - Check Electron API first
   - Fallback to navigator.platform if unavailable
   - Fallback to navigator.userAgent as last resort

2. **Optional: Add retry logic** if initial check fails

### Out of Scope

- Changes to preload timing
- Major architecture changes to context loading

## Files to Modify

| File | Action |
|------|--------|
| `src/utils/platform.ts` | Add fallback detection |
| `src/utils/__tests__/platform.test.ts` | Add tests (if exists) |

## Solution

```typescript
export function getPlatform(): Platform {
  // Try Electron API first
  const electronPlatform = window.api?.system?.platform;

  if (electronPlatform) {
    switch (electronPlatform) {
      case "darwin":
        return "macos";
      case "win32":
        return "windows";
      case "linux":
        return "linux";
    }
  }

  // Fallback to navigator.platform
  const navPlatform = navigator.platform?.toLowerCase() || "";

  if (navPlatform.includes("mac")) return "macos";
  if (navPlatform.includes("win")) return "windows";
  if (navPlatform.includes("linux")) return "linux";

  // Fallback to userAgent
  const userAgent = navigator.userAgent?.toLowerCase() || "";

  if (userAgent.includes("mac")) return "macos";
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("linux")) return "linux";

  // Last resort default
  console.warn(
    `[Platform] Could not detect platform. electronPlatform=${electronPlatform}, ` +
      `navPlatform=${navPlatform}. Defaulting to Windows.`
  );
  return "windows";
}
```

## Acceptance Criteria

- [ ] Platform correctly detected as "macos" on macOS
- [ ] Platform correctly detected as "windows" on Windows
- [ ] No console warnings about unknown platform
- [ ] Feature availability works correctly per platform
- [ ] Works even if window.api is not yet available

## Testing

1. **Manual test**: No "unknown platform" warning in console on macOS
2. **Manual test**: No "unknown platform" warning in console on Windows
3. **Manual test**: Platform-specific features show correctly
4. **Unit test**: Fallback to navigator.platform works
5. **Unit test**: Fallback to userAgent works

## Branch

```
feature/TASK-983-platform-detection-fix
```

## Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | (record when Task tool returns) |
| Total Tokens | (from tokens.jsonl) |
| Duration | (from tokens.jsonl) |
| Variance | (calculated) |
