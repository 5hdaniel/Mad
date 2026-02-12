# Task TASK-1960: Configure Electron Fuses

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Add `@electron/fuses` to the build pipeline to harden the Electron binary against common attack vectors. This configures compile-time security flags that cannot be changed at runtime.

## Non-Goals

- Do NOT modify runtime CSP (already configured)
- Do NOT change macOS notarization settings
- Do NOT modify the existing `scripts/notarize.js` file
- Do NOT add fuses that would break dev mode (dev mode does not use ASAR)

## Deliverables

1. Update: `package.json` — add `@electron/fuses` as devDependency + `"afterPack": "scripts/afterPack.js"` in build config (around line 195)
2. New: `scripts/afterPack.js` — afterPack hook that flips fuses on the packaged Electron binary

## Acceptance Criteria

- [ ] `@electron/fuses` is listed in devDependencies
- [ ] `scripts/afterPack.js` exists and is referenced in electron-builder config
- [ ] Fuses set: `RunAsNode=false`, `EnableCookieEncryption=true`, `EnableNodeOptionsEnvironmentVariable=false`, `EnableNodeCliInspectArguments=false`, `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`, `GrantFileProtocolExtraPrivileges=false`
- [ ] `npx @electron/fuses read <electron-binary>` shows correct fuse values after `npm run package:dev`
- [ ] All CI checks pass

## Implementation Notes

### Pattern Reference

Follow the existing `scripts/notarize.js` pattern for the afterPack hook structure:

```javascript
// scripts/afterPack.js
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

module.exports = async function afterPack(context) {
  const ext = { darwin: '.app', win32: '.exe', linux: '' }[context.electronPlatformName];
  const electronBinaryPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}${ext}`;

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  });
};
```

### package.json Changes

In the `"build"` section (around line 195), add:
```json
"afterPack": "scripts/afterPack.js"
```

Add to devDependencies:
```json
"@electron/fuses": "^1.8.0"
```

### Important Details

- `OnlyLoadAppFromAsar` requires ASAR to be enabled (it is the electron-builder default, confirmed by TASK-1961)
- The afterPack hook runs AFTER electron-builder packages but BEFORE signing/notarization
- Dev mode (`npm run dev`) is NOT affected — fuses only apply to packaged builds

## Integration Notes

- TASK-1961 (ASAR Integrity) depends on this task completing first
- The `afterPack` hook runs in the build pipeline alongside `afterSign` (notarize.js)
- Verify the hook chain: afterPack (fuses) → afterSign (notarize)

## Do / Don't

### Do:
- Follow the `scripts/notarize.js` file structure for consistency
- Handle all three platforms (darwin, win32, linux) in the binary path
- Log which fuses are being set for build visibility

### Don't:
- Do NOT modify `scripts/notarize.js`
- Do NOT conditionally skip fuses in dev builds (afterPack only runs in packaging)
- Do NOT use experimental/unstable fuse options

## When to Stop and Ask

- If `@electron/fuses` API has changed significantly from the documented pattern
- If the electron-builder config structure differs from what's expected
- If `afterPack` conflicts with existing build hooks

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (build-time script, not runtime code)
- Verify via: `npm run package:dev` + `npx @electron/fuses read`

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(security): configure Electron fuses for production hardening`
- **Labels:** `security`, `electron`
- **Depends on:** None (first in 080A chain)

---

## PM Estimate (PM-Owned)

**Category:** `security`
**Estimated Tokens:** ~30K
**Token Cap:** 120K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files created:
- [ ] scripts/afterPack.js

Files modified:
- [ ] package.json (devDependency + afterPack config)

Features implemented:
- [ ] Electron fuses configured for all 7 security flags
- [ ] afterPack hook integrated into build pipeline

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] npm run package:dev produces working build
- [ ] @electron/fuses read confirms correct fuse values
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>
- Test coverage: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
