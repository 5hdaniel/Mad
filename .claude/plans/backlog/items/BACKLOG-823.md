# BACKLOG-823: Sync Orchestrator Does Not Import macOS Contacts During Sync

**Type:** Bug
**Area:** Electron
**Priority:** High
**Status:** In Progress

## Problem

The SyncOrchestratorService's contacts sync (Phase 1) calls `window.api.contacts.getAll(userId)` which maps to the `contacts:get-all` IPC handler. That handler only reads already-imported contacts from the local SQLite database -- it does NOT populate the `external_contacts` shadow table from macOS Contacts.app.

The actual macOS Contacts import only happens via:
- `contacts:get-available` (when viewing the import screen in Settings)
- `contacts:syncExternal` (from the MacOSContactsImportSettings component)

This means the periodic sync never actually pulls new contacts from macOS Contacts.app into the local database.

## Root Cause

In `src/services/SyncOrchestratorService.ts` line ~135:
```typescript
const result = await window.api.contacts.getAll(userId);
```

This calls `contacts:get-all` which is a read-only DB query. It should call `contacts:syncExternal` which reads from macOS Contacts.app and populates the shadow table.

## Fix

Change the sync orchestrator Phase 1 to call `syncExternal` instead of `getAll`. The `syncExternal` API is already exposed in the preload bridge (`electron/preload/contactBridge.ts:136`) and typed in `window.d.ts:1061`. The `onImportProgress` listener should also be removed since `syncExternal` does not emit progress events.

## Files to Modify

1. `src/services/SyncOrchestratorService.ts` -- Change Phase 1 to call `syncExternal` instead of `getAll`
2. `src/services/__tests__/SyncOrchestratorService.test.ts` -- Update mocks/assertions

## Sprint

SPRINT-105
