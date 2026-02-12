# BACKLOG-622: Bundled Cleanup Scripts + DevTools Reset Command

**Status:** Pending
**Priority:** Medium
**Category:** Support / Tooling
**Created:** 2026-02-06
**Estimate:** ~25K tokens
**Complexity:** Small

---

## Summary

Bundle platform-specific cleanup scripts with the packaged app and expose a `window.api.resetAppData()` command in DevTools for support scenarios where the app is running but in a bad state.

---

## Background

An existing `scripts/cleanup-macos.sh` script handles full app data removal on macOS (kills process, removes Application Support/Caches directories, deletes keychain entries, removes app). However, it was never committed or bundled with builds. This feature formalizes that script, adds a Windows equivalent, bundles both into their respective platform builds, and adds an in-app fallback for cases where support staff can open DevTools during a screen share.

---

## Requirements

### Part 1: Bundled Cleanup Scripts

- Include the existing `scripts/cleanup-macos.sh` in the macOS packaged app via `extraResources` in electron-builder config
- Create `scripts/cleanup-windows.ps1` equivalent for Windows covering:
  - Kill any running MagicAudit processes
  - Delete AppData folders (Local, Roaming) for magic-audit / MagicAudit
  - Remove the application from Program Files
  - Clear Windows Credential Manager entries for magic-audit
  - Verification step confirming cleanup
- Include the Windows script in the Windows packaged app via `extraResources`
- Scripts should be accessible by support staff at known paths:
  - macOS: `/Applications/MagicAudit.app/Contents/Resources/cleanup-macos.sh`
  - Windows: `C:\Program Files\MagicAudit\resources\cleanup-windows.ps1`

### Part 2: DevTools Reset Command

- Expose `window.api.resetAppData()` via the preload/IPC bridge
- When called, the function should:
  1. Show a native confirmation dialog ("This will erase all local data. Continue?")
  2. If confirmed:
     - Clear all local SQLite databases
     - Clear keychain/credential store entries (Electron safeStorage)
     - Clear app caches (session/localStorage, Electron cache directories)
     - Sign out of Supabase (clear auth session)
  3. Restart the app after cleanup (or quit with message to relaunch)
- This is for support scenarios where the app opens but is in a bad state -- support can open DevTools (Cmd+Shift+I / F12) and run the command during a screen share

---

## Technical Considerations

### electron-builder extraResources

```yaml
# electron-builder config
extraResources:
  - from: "scripts/cleanup-macos.sh"
    to: "cleanup-macos.sh"
    filter:
      - "*.sh"
  - from: "scripts/cleanup-windows.ps1"
    to: "cleanup-windows.ps1"
    filter:
      - "*.ps1"
```

Platform filtering may be needed so macOS builds only include the `.sh` and Windows builds only include `.ps1`.

### IPC Bridge for resetAppData

**Preload (`preload.ts`):**
- Expose `resetAppData` on the `window.api` object via `contextBridge.exposeInMainWorld`

**Main process handler:**
- Register `ipc:reset-app-data` handler
- Use `dialog.showMessageBoxSync()` for native confirmation
- Use `app.getPath('userData')` to locate SQLite databases and cache
- Use Electron `safeStorage` or `keytar` for credential cleanup
- Use `fs.rmSync()` or equivalent to delete data directories
- Call `app.relaunch()` + `app.exit(0)` after cleanup

### Windows PowerShell Script

The Windows script should mirror `cleanup-macos.sh` behavior:
- Stop processes: `Stop-Process -Name "MagicAudit" -Force -ErrorAction SilentlyContinue`
- Remove AppData: `Remove-Item -Recurse -Force "$env:APPDATA\magic-audit"` (and variations)
- Remove app: `Remove-Item -Recurse -Force "$env:ProgramFiles\MagicAudit"`
- Clear credentials: `cmdkey /delete:magic-audit` or equivalent
- Verification output

### Safety Considerations

- Both the DevTools command and scripts are destructive -- confirmation is mandatory
- The DevTools command should log the reset action before clearing data (for audit trail if logs survive)
- Scripts should be idempotent (safe to run multiple times)

---

## Acceptance Criteria

- [ ] `scripts/cleanup-macos.sh` is committed to the repository
- [ ] `scripts/cleanup-windows.ps1` is created and committed
- [ ] macOS packaged build includes `cleanup-macos.sh` in Resources
- [ ] Windows packaged build includes `cleanup-windows.ps1` in resources
- [ ] `window.api.resetAppData()` is exposed via preload/IPC bridge
- [ ] Calling `resetAppData()` shows a native confirmation dialog
- [ ] On confirmation, all local SQLite databases are deleted
- [ ] On confirmation, keychain/credential store entries are cleared
- [ ] On confirmation, app caches are cleared
- [ ] On confirmation, Supabase auth session is cleared
- [ ] App restarts (or quits with relaunch message) after reset
- [ ] Both cleanup scripts are idempotent and include verification output
- [ ] Windows script handles all known AppData paths for MagicAudit

---

## Suggested Task Decomposition

This is a small feature that could be done in a single sprint with 2-3 tasks:

### Task A: Commit and Bundle Cleanup Scripts
1. Commit existing `scripts/cleanup-macos.sh`
2. Create `scripts/cleanup-windows.ps1`
3. Configure `extraResources` in electron-builder for both platforms
4. Verify scripts appear at expected paths in packaged builds

### Task B: DevTools Reset Command
1. Add `resetAppData` to preload API surface
2. Implement main process IPC handler with confirmation dialog
3. Implement data cleanup logic (SQLite, keychain, caches, Supabase)
4. Implement app restart after cleanup
5. Test via DevTools console

---

## Dependencies

- Electron main process access to `app.getPath()` paths (existing)
- Electron `safeStorage` or `keytar` for credential management (existing)
- electron-builder configuration (existing `electron-builder.yml` or equivalent)
- Supabase Auth client for session signout (existing)

---

## Related Backlog Items

- BACKLOG-618: IT Admin Setup Flow (admin may need to guide users through cleanup)
- BACKLOG-612: Error Logging Service (could log reset events)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| DevTools command accidentally triggered | High (data loss) | Native confirmation dialog with clear warning text |
| Cleanup script misses a data directory | Low | Verification step in scripts; test on clean installs |
| Windows script blocked by execution policy | Medium | Document `Set-ExecutionPolicy` requirement or use `.bat` wrapper |
| extraResources config differs per platform | Low | Test both macOS and Windows builds in CI |

---

## Questions for Implementation

1. Should `resetAppData()` require any additional authentication (e.g., admin password) beyond the confirmation dialog?
2. Should the cleanup scripts also clear browser-level data (cookies, IndexedDB) or only Electron app data?
3. Should we include a Linux cleanup script as well, or defer until Linux is a supported platform?
4. Should the DevTools command offer partial resets (e.g., "clear cache only" vs "full reset")?
