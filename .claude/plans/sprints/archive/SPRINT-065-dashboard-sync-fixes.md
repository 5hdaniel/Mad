# Sprint Plan: SPRINT-065 - Dashboard Sync Fixes & Import Settings

**Created**: 2026-01-28
**Updated**: 2026-01-29
**Completed**: 2026-01-29
**Status**: COMPLETE
**Goal**: Fix Dashboard sync progress indicators and add import control settings
**Branch**: `claude/real-estate-archive-app-011CUStmvmVNXPNe4oF321jJ`

---

## Sprint Goal

This sprint has two focuses:

1. **Dashboard Sync Progress Fix:** Fixing a regression where Dashboard sync progress indicators are not displaying properly for sync operations.

2. **Import Settings Enhancements:** Adding user controls for import behavior (disable auto-import, macOS import source selection).

**Bug Summary (from QA):**
- Messages import progress not showing on Dashboard
- Contacts sync progress not showing
- Email sync progress bar regressed (used to work)

---

## In Scope

### Phase 1: Dashboard Sync Progress Fix

| Task ID | Title | Est. Tokens | Status | PR |
|---------|-------|-------------|--------|-----|
| TASK-1740 | Fix Dashboard Sync Progress Indicators | ~30-50K | DONE | #671 |

### Phase 2: Import Settings Enhancements

| Task ID | Title | Est. Tokens | Status | PR | Backlog |
|---------|-------|-------------|--------|-----|---------|
| TASK-1741 | Disable Auto-Import Setting | ~15-25K | DELETED | - | BACKLOG-564 |
| TASK-1742 | macOS Import Source Selector | ~35-50K | MOVED TO BACKLOG | - | BACKLOG-565 |

### Phase 3: Contact Workflow Integration

| Task ID | Title | Est. Tokens | Status | PR | Backlog |
|---------|-------|-------------|--------|-----|---------|
| TASK-1751 | Integrate ContactSelector + RoleAssigner into EditContactsModal | ~30-40K | DEFERRED | - | BACKLOG-418 |

---

## Dependency Graph

```
Phase 1: Sync Progress Fix
  TASK-1740 (Dashboard Sync Progress) [PLANNED]
       |
       v
Phase 2: Import Settings (can run in parallel with Phase 1)
  TASK-1741 (Disable Auto-Import) [PLANNED]
       |
       v
  TASK-1742 (macOS Import Source) [PLANNED]
       |
       (TASK-1742 should run after TASK-1741 due to shared file:
        useMacOSMessagesImport.ts)
```

**Execution Order:**
- TASK-1740: Can start immediately
- TASK-1741: Can start immediately (no dependency on TASK-1740)
- TASK-1742: Should wait for TASK-1741 merge (both modify useMacOSMessagesImport.ts)
- TASK-1751: Can start immediately (no shared files with other tasks)

---

## Task Details

### TASK-1740: Fix Dashboard Sync Progress Indicators

**Problem:**
The Dashboard is not showing progress indicators for sync operations. The Settings modal has its own local state for import progress (TASK-1710), but that state is lost when the modal closes. The Dashboard should show progress for all sync types.

**Suspected Root Cause:**
The `SyncStatusIndicator` component is wrapped in a `LicenseGate requires="ai_addon"` in `Dashboard.tsx`. If the user doesn't have the AI add-on, the progress indicator is hidden entirely.

**Investigation Required:**
1. Verify the LicenseGate is the cause
2. Check if IPC progress events are being received
3. Confirm useAutoRefresh is tracking progress correctly

**Fix Approach:**
1. Move sync progress indicator outside of LicenseGate (progress should show for all users)
2. Keep AI-specific features (pending count, transaction detection) gated

---

### TASK-1741: Disable Auto-Import Setting

**Problem:**
The "Auto-Sync on Login" setting exists but `useMacOSMessagesImport` hook doesn't respect it. Users on slow computers experience freezes because messages import runs regardless.

**Fix Approach:**
1. Add preference loading to `useMacOSMessagesImport` hook (follow pattern from `useAutoRefresh`)
2. Skip auto-import when `sync.autoSyncOnLogin` is false
3. Manual import buttons still work regardless of setting

**Task File:** `.claude/plans/tasks/TASK-1741-disable-auto-import-setting.md`

---

### TASK-1742: macOS Import Source Selector

**Problem:**
macOS users can only import from local Messages database. Some users prefer iPhone sync (like Windows users).

**Fix Approach:**
1. Add new `ImportSourceSettings.tsx` component with radio selector
2. Store preference as `messages.source: 'macos-native' | 'iphone-sync'`
3. Update `useMacOSMessagesImport` to use selected source
4. Reuse existing iPhone backup import infrastructure

**Task File:** `.claude/plans/tasks/TASK-1742-macos-import-source-selector.md`

---

## Files Affected

### TASK-1740: Dashboard Sync Progress
| File | Action | Description |
|------|--------|-------------|
| `src/components/Dashboard.tsx` | Modify | Adjust LicenseGate scope for sync indicator |
| `src/components/dashboard/SyncStatusIndicator.tsx` | Possibly modify | Fix render conditions if needed |
| `src/hooks/useAutoRefresh.ts` | Possibly modify | Fix progress tracking if needed |

### TASK-1741: Disable Auto-Import Setting
| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useMacOSMessagesImport.ts` | Modify | Add preference loading, respect setting |
| Tests | Add | Test preference behavior |

### TASK-1742: macOS Import Source Selector
| File | Action | Description |
|------|--------|-------------|
| `src/components/settings/ImportSourceSettings.tsx` | Create | New radio selector component |
| `src/components/Settings.tsx` | Modify | Add ImportSourceSettings to Messages section |
| `src/services/settingsService.ts` | Modify | Add import source preference type |
| `src/hooks/useMacOSMessagesImport.ts` | Modify | Use selected import source |
| Tests | Add | Test component and preference behavior |

---

## Success Criteria

### Sprint Complete When:

**TASK-1740:**
- [ ] All 3 sync types show progress on Dashboard (messages, contacts, email)
- [ ] Progress shows for both automatic syncs (app open) and manual syncs
- [ ] Progress persists during navigation

**TASK-1741:**
- [ ] "Auto-Sync on Login" OFF prevents all automatic imports
- [ ] Manual import buttons still work with setting OFF
- [ ] Preference persists across app restarts

**TASK-1742:**
- [ ] macOS Settings shows import source selector
- [ ] "macOS Messages + Contacts" and "iPhone Sync" options available
- [ ] Selected source is used for auto-import and manual import
- [ ] Preference persists across app restarts

**All Tasks:**
- [ ] Existing unit tests pass
- [ ] New tests added for each feature

---

## Estimated Effort

| Phase | Tasks | Est. Tokens | Status |
|-------|-------|-------------|--------|
| Phase 1: Sync Progress Fix | 1 task | ~30-50K | PLANNED |
| Phase 2: Import Settings | 2 tasks | ~50-75K | PLANNED |
| Phase 3: Contact Workflow | 1 task | ~30-40K | IN PROGRESS |
| **Total** | **4 tasks** | **~110-165K** | PLANNED |

---

## Technical Review Required

**Before assigning TASK-1740, SR Engineer should review:**

- [ ] Confirm the LicenseGate hypothesis
- [ ] Check for any other blocking conditions
- [ ] Verify IPC event flow is correct
- [ ] Recommend any additional fixes needed

**Before assigning TASK-1741 and TASK-1742, SR Engineer should review:**

- [ ] Verify TASK-1741 and TASK-1742 can run sequentially (shared file conflict)
- [ ] Confirm iPhone backup import works on macOS (for TASK-1742)
- [ ] Review branch strategy (TASK-1742 depends on TASK-1741)
- [ ] Check for any existing iPhone sync infrastructure gaps

---

## Notes

This is a targeted bug fix sprint. The issue was reported by QA and affects user experience during sync operations.

**Related Context:**
- TASK-1710 added async import progress to Settings modal (separate feature, not affected by this fix)
- The Dashboard sync progress uses `useAutoRefresh` hook which tracks all sync operations
- Progress is displayed via `SyncStatusIndicator` component

---

## Sprint Progress

| Date | Update |
|------|--------|
| 2026-01-28 | Sprint created. TASK-1740 planned. Awaiting SR technical review. |
| 2026-01-28 | Added TASK-1741 (Disable Auto-Import) and TASK-1742 (macOS Import Source). Created backlog items BACKLOG-564 and BACKLOG-565. |
| 2026-01-28 | Added TASK-1751 (Integrate ContactSelector + RoleAssigner into EditContactsModal). Assigned to engineer. |
| 2026-01-29 | **SPRINT COMPLETE:** TASK-1740 merged (PR #671). TASK-1741 deleted (already implemented). TASK-1742 moved to backlog (BACKLOG-565). TASK-1751 deferred to SPRINT-066. |
