# BACKLOG-292: Preload Script Build Conflict - __DEV__ Undefined

## Category
Build, Infrastructure

## Priority
Critical

## Status
In Progress

## Description

The app crashes on startup with `ReferenceError: __DEV__ is not defined` in the preload script. This prevents the app from loading entirely.

## Error Details

```
Unable to load preload script: /Users/daniel/Documents/Mad/dist-electron/preload.js

ReferenceError: __DEV__ is not defined
    at Object.<anonymous> (systemBridge.js:10:24)
```

This causes a cascade failure:
1. Preload script fails to load
2. `window.api` is undefined
3. `LoadingOrchestrator.tsx:68` tries to access `window.api.system` → crash

## Root Cause

**Build process conflict between tsc and esbuild:**

1. `npm run dev` executes:
   - `build:electron` (tsc) - compiles ALL electron files including preload
   - `build:preload:dev` (esbuild) - bundles preload with `--define:__DEV__=true`
   - `concurrently` runs `watch:electron` (tsc --watch)

2. `watch:electron` (tsc) continuously overwrites `dist-electron/preload.js` with non-bundled TypeScript output

3. The tsc output doesn't have `__DEV__` defined (esbuild defines it at bundle time)

4. Result: preload.js alternates between working (esbuild) and broken (tsc) versions

## Evidence

**Broken preload.js (tsc output - 2.4kb):**
```javascript
"use strict";
const index_1 = require("./preload/index");  // Uses relative imports
```

**Working preload.js (esbuild output - 61.6kb):**
```javascript
"use strict";
// electron/preload.ts
var import_electron12 = require("electron");
// All modules bundled inline, __DEV__ replaced with true
```

## Solution

1. **Exclude preload from tsc** - Add to `tsconfig.electron.json`:
   ```json
   "exclude": [
     "electron/preload.ts",
     "electron/preload/**/*"
   ]
   ```

2. **Add watch:preload to dev script** - Update `package.json`:
   ```json
   "dev": "... concurrently ... \"npm run watch:preload\""
   ```

This ensures:
- tsc handles main process files only
- esbuild handles preload bundling exclusively
- Both can watch for changes without conflict

## Acceptance Criteria

- [ ] `npm run dev` starts without __DEV__ errors
- [ ] Preload script properly bundled (60kb+, not 2kb)
- [ ] `window.api` available in renderer
- [ ] App loads to login/dashboard screen
- [ ] Changes to preload files trigger esbuild rebuild

## Files to Modify

| File | Change |
|------|--------|
| `tsconfig.electron.json` | Exclude preload files from compilation |
| `package.json` | Add `watch:preload` to dev/start scripts |

## Related

- BACKLOG-291 (Enhanced Error Diagnostics) - Would help debug issues like this

## Created
2026-01-16

## Reported By
User (startup crash)
