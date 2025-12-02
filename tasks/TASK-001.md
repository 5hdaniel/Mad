# TASK-001: Windows Build Configuration

## Task Info
- **Task ID:** TASK-001
- **Phase:** 1 - Foundation
- **Dependencies:** None
- **Can Start:** Immediately
- **Estimated Effort:** 2-3 days

## Goal

Configure the Electron build system to produce Windows installers (NSIS) alongside the existing macOS builds.

## Background

The app currently builds for macOS only. We need to add Windows build targets to `electron-builder` configuration and update the CI/CD pipeline.

## Deliverables

1. Updated `package.json` with Windows build configuration
2. Windows app icon (`icon.ico`) in the `build/` folder
3. Updated `.github/workflows/ci.yml` to package for Windows
4. Working Windows installer (NSIS) that installs the app

## Technical Requirements

### 1. Update package.json build config

Add Windows targets to the existing `electron-builder` configuration:

```json
{
  "build": {
    "win": {
      "target": ["nsis"],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### 2. Create Windows Icon

- Convert existing macOS icon to `.ico` format
- Place in `build/icon.ico`
- Must include multiple sizes: 16x16, 32x32, 48x48, 256x256

### 3. Update CI/CD Pipeline

Modify `.github/workflows/ci.yml`:
- Add Windows to the package matrix
- Ensure Windows artifacts are uploaded
- Keep macOS code signing intact (don't break existing flow)

## Files to Modify

- `package.json` - Add Windows build config
- `.github/workflows/ci.yml` - Add Windows packaging job
- `build/icon.ico` - Create new file

## Dos

- ✅ Keep all existing macOS build configuration intact
- ✅ Test that macOS builds still work after changes
- ✅ Use NSIS installer (industry standard for Windows)
- ✅ Follow existing code style and patterns
- ✅ Add appropriate Windows-specific metadata (publisher, app name)

## Don'ts

- ❌ Don't remove or modify macOS entitlements
- ❌ Don't change the app version number
- ❌ Don't add Windows code signing yet (separate task if needed)
- ❌ Don't modify any source code (this is build config only)

## Testing Instructions

1. Run `npm run build` on Windows - should complete without errors
2. Run `npm run package` on Windows - should produce `.exe` installer
3. Install the app using the generated installer
4. Verify app launches and shows the main window

## PR Preparation Checklist

Before completing, ensure:

- [ ] No console.log statements added for debugging
- [ ] Error logging uses electron-log (if any logging added)
- [ ] Type check passes: `npm run type-check`
- [ ] Lint check passes: `npm run lint`
- [ ] Merged latest from main branch
- [ ] All CI checks pass
- [ ] Created pull request with summary

## Work Summary

> **Instructions:** Update this section when your work is complete.

### Branch Name
```
[FILL IN YOUR BRANCH NAME HERE]
```

### Changes Made
```
[LIST THE FILES YOU MODIFIED AND WHAT YOU CHANGED]
```

### Testing Done
```
[DESCRIBE WHAT TESTING YOU PERFORMED]
```

### Notes/Issues Encountered
```
[ANY ISSUES OR NOTES FOR THE REVIEWER]
```

### PR Link
```
[LINK TO YOUR PULL REQUEST]
```
