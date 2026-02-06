# TASK-1822: Bundled Cleanup Scripts (Part 1 of BACKLOG-622)

**Status:** In Progress
**Branch:** feature/cleanup-scripts
**Backlog Item:** BACKLOG-622
**Estimated Tokens:** ~15K
**Actual Tokens:** TBD

---

## Objective

Commit the existing macOS cleanup script, create a Windows equivalent, and configure electron-builder to bundle both scripts with the packaged application as extraResources.

---

## Requirements

- [x] Commit existing `scripts/cleanup-macos.sh` to the repository
- [x] Create `scripts/cleanup-windows.ps1` with equivalent Windows functionality
- [x] Update electron-builder `extraResources` config to include both scripts
- [ ] Push branch and create PR targeting develop
- [ ] PR reviewed and merged

---

## What Was Done

### 1. Committed `scripts/cleanup-macos.sh`
The existing macOS cleanup script was already present in the repo as an untracked file. Copied it into the worktree and committed it. The script:
- Kills running MagicAudit processes
- Removes `~/Library/Application Support/magic-audit`, `Magic Audit`, `MagicAudit`
- Removes `~/Library/Caches/Magic Audit`, `magic-audit`
- Removes `/Applications/MagicAudit.app`
- Deletes keychain entry for "magic-audit Safe Storage"
- Prints verification status

### 2. Created `scripts/cleanup-windows.ps1`
Windows PowerShell equivalent that:
- Kills running MagicAudit processes via `Stop-Process`
- Removes AppData directories: `$env:APPDATA\magic-audit`, `$env:APPDATA\Magic Audit`, `$env:APPDATA\MagicAudit`, plus equivalent paths in `$env:LOCALAPPDATA`
- Removes application from `$env:ProgramFiles\MagicAudit` (and x86 variant)
- Clears Windows Credential Manager entries via `cmdkey /delete`
- Includes a secondary credential scan for any remaining magic-audit entries
- Prints verification status with color-coded output

### 3. Updated `package.json` electron-builder config
Added both scripts to the `extraResources` array so they ship with packaged builds:
- `scripts/cleanup-macos.sh` -> `cleanup-macos.sh`
- `scripts/cleanup-windows.ps1` -> `cleanup-windows.ps1`

Scripts will be accessible at:
- macOS: `/Applications/MagicAudit.app/Contents/Resources/cleanup-macos.sh`
- Windows: `C:\Program Files\MagicAudit\resources\cleanup-windows.ps1`

---

## Out of Scope (Part 2)

The DevTools `window.api.resetAppData()` command is a separate task (Part 2 of BACKLOG-622). This task only covers bundling the cleanup scripts.

---

## Implementation Summary

| Metric | Value |
|--------|-------|
| Files Created | 1 (`scripts/cleanup-windows.ps1`) |
| Files Modified | 1 (`package.json`) |
| Files Committed | 1 (`scripts/cleanup-macos.sh` - previously untracked) |
| Tests Added | 0 (scripts are standalone shell/PowerShell) |
| Lines of Code | ~100 (Windows script) |

---

## Issues/Blockers

None. Straightforward implementation matching the existing macOS script pattern.

---

## Engineer Checklist

- [x] Implementation matches requirements
- [x] No broker-portal files modified
- [x] Scripts are idempotent (safe to run multiple times)
- [x] Both scripts include verification output
- [x] extraResources config added for both platforms
- [x] Task file created with Implementation Summary
