# TASK-2120: Persistent Sync Status Bar (Replaces Modal)

**Backlog ID:** BACKLOG-847
**Sprint:** SPRINT-114
**Phase:** Phase 2 - Persistent Status Bar
**Status:** Deferred (waiting for TASK-2119 orchestrator integration first)
**Branch:** `feature/TASK-2120-sync-status-bar`
**Branch From:** `develop`
**Branch Into:** `develop`
**Priority:** High
**Estimated Tokens:** ~25K (ui category x 1.0)
**Token Cap:** 100K (4x estimate)

---

## Objective

Enhance the existing SyncStatusBanner to show meaningful progress data (bytes transferred, file count) during iPhone sync, and ensure it works reliably as a persistent indicator across all screens. This replaces the user's reliance on the IPhoneSyncFlow modal for progress visibility.

---

## Context

Sprint 110 created `SyncStatusBanner` as a persistent banner in AppShell that shows during iPhone sync on all non-dashboard screens. The dashboard has its own `SyncStatusIndicator` with iPhone pill support. However:

1. The banner only shows **phase labels** ("Preparing import...", "Importing iPhone data...") -- NOT bytes transferred or file count
2. The iPhone progress data (`BackupProgress`) contains `bytesProcessed`, `totalBytes`, `processedFiles`, `totalFiles` but these are not displayed
3. The banner disappears when navigating to the dashboard (deferred to dashboard's SyncStatusIndicator)

**Important:** Phase 3 (TASK-2119) will replace SyncStatusBanner with orchestrator-integrated progress. This task should make minimal changes -- just wire up the progress data that already exists in `BackupProgress` type.

---

## Requirements

### Must Do:
1. Display bytes transferred (current only, NOT total) in SyncStatusBanner during `backing_up` and `extracting` phases
2. Display files processed count (current only, NOT total) when available
3. Keep the existing phase label but append progress numbers (e.g., "Importing iPhone data... 245 MB — 3 files"). Do NOT show totals (no "X / Y" format) because total capture is unreliable.
4. Ensure SyncStatusIndicator iPhone pill on dashboard also shows condensed progress (e.g., "iPhone - 245 MB")
5. Format bytes human-readably (KB, MB, GB as appropriate)

### Must NOT Do:
- Do NOT restructure SyncStatusBanner architecture (Phase 3 will replace it)
- Do NOT touch SyncOrchestratorService (Phase 3 scope)
- Do NOT modify IPhoneSyncFlow modal or IPhoneSyncContext
- Do NOT add new IPC channels -- all data already flows through `BackupProgress`

---

## Files to Modify

| File | Change |
|------|--------|
| `src/appCore/shell/SyncStatusBanner.tsx` | Add bytes/files display to the syncing state rendering |
| `src/components/dashboard/SyncStatusIndicator.tsx` | Add condensed progress to iPhone pill label |

## Files to Read (for context)

| File | Why |
|------|-----|
| `src/types/iphone.ts` | `BackupProgress` type definition -- check available fields |
| `src/hooks/useIPhoneSync.ts` | How progress data flows from IPC to state |
| `src/contexts/IPhoneSyncContext.tsx` | How progress is provided to consumers |
| `src/appCore/AppShell.tsx` | How SyncStatusBanner receives its props |
| `src/components/Dashboard.tsx` | How SyncStatusIndicator receives iPhone props |

---

## Implementation Notes

### Byte Formatting Utility

Create a simple `formatBytes` helper (or use existing if one exists):

```typescript
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
```

### SyncStatusBanner Enhancement

In the syncing state render, after the phase label, conditionally append progress:

```typescript
const progressText = (() => {
  if (!iPhoneProgress) return '';
  const { bytesProcessed, totalBytes, processedFiles, totalFiles } = iPhoneProgress;
  const parts: string[] = [];
  if (bytesProcessed != null && totalBytes) {
    parts.push(`${formatBytes(bytesProcessed)} / ${formatBytes(totalBytes)}`);
  }
  if (processedFiles != null && totalFiles) {
    parts.push(`${processedFiles} / ${totalFiles} files`);
  }
  return parts.length > 0 ? ` (${parts.join(' - ')})` : '';
})();
```

**Actual field names from `BackupProgress` in `src/types/iphone.ts`:**
- `bytesProcessed` (NOT bytesTransferred)
- `totalBytes`
- `processedFiles` (NOT filesProcessed)
- `totalFiles`
- `estimatedTotalBytes` (fallback when `totalBytes` unavailable)

### SyncStatusIndicator iPhone Pill

In the `renderIPhonePill()` function, show condensed progress in the syncing state:

```typescript
// Instead of just "iPhone - Importing"
// Show "iPhone - 245 MB" when bytes data is available
```

---

## Acceptance Criteria

- [ ] SyncStatusBanner shows bytes transferred / total bytes during active sync phases
- [ ] SyncStatusBanner shows file count when available (e.g., "3 / 15 files")
- [ ] Byte values are human-readable (KB/MB/GB)
- [ ] SyncStatusIndicator iPhone pill shows condensed byte progress
- [ ] No layout shift or overflow when progress numbers are long
- [ ] Existing phase labels still display correctly
- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] No changes to IPC, orchestrator, or context layers

---

## Testing Expectations

### Unit Tests
- **Required:** Yes (minimal)
- **New tests:** Add test for `formatBytes` utility if created as standalone function
- **Existing tests to update:** `SyncStatusIndicator.test.tsx` -- verify iPhone pill renders progress data when provided

### Manual Testing
- Start an iPhone sync and verify banner shows bytes/files on non-dashboard screens
- Verify dashboard SyncStatusIndicator shows condensed progress in iPhone pill
- Navigate between screens during sync -- banner should persist

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## Integration Notes

- **Depends on:** Phase 1 tasks (TASK-2114, TASK-2115) -- already merged
- **Depended on by:** TASK-2119 (Phase 3, orchestrator integration) -- will replace SyncStatusBanner but benefits from the progress display pattern established here

---

## PR Preparation

- **Title:** `feat(sync): display bytes and file count in sync status bar`
- **Branch:** `feature/TASK-2120-sync-status-bar`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: 25K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- `BackupProgress` fields `bytesProcessed` / `totalBytes` / `processedFiles` / `totalFiles` are always null/undefined in practice (would need IPC investigation to verify main process sends them)
- The progress data stops updating or jumps erratically (known IPC flushing issue per BACKLOG-824)
- Any change touches more than 3 files
- You feel the need to refactor SyncStatusBanner structure (defer to Phase 3)
