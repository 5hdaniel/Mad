# TASK-1003: Auto-Refresh Data Sources on App Load

**Backlog ID:** BACKLOG-156
**Sprint:** SPRINT-028
**Phase:** Phase 2 - UX Enhancement (Sequential, after Phase 1)
**Branch:** `feature/TASK-1003-auto-refresh`
**Estimated Tokens:** ~40K (raw), ~20K with 0.50x service multiplier
**Token Cap:** 100K

---

## Objective

Automatically sync all available data sources when the user opens the application, eliminating the need to manually click "Auto Detect". Users should see their latest emails, texts, and contacts immediately without any manual action.

---

## Context

Currently, users must manually trigger sync/detection after opening the app. This adds unnecessary friction, especially for users who check the app daily. The app already has:
- Incremental sync infrastructure (SPRINT-014, BACKLOG-090)
- State machine coordination (SPRINT-020/021/022, BACKLOG-142)
- Sync services for each data type

This task wires the existing sync infrastructure to trigger automatically on app startup.

---

## Requirements

### Must Do:
1. Trigger sync after authentication AND database initialization complete
2. Sync available sources based on platform:
   - Gmail (all platforms)
   - Outlook (all platforms)
   - Text Messages (macOS only)
   - Contacts (macOS only)
3. Run syncs in parallel (don't block each other)
4. Use incremental sync (only fetch new data since last sync)
5. Run AI transaction detection after sync completes
6. Show subtle progress indicator (don't block UI)
7. Handle errors silently (log but don't alert user)
8. Add brief delay (2-3 seconds) after UI renders to avoid startup slowdown

### Must NOT Do:
- Block the UI during sync
- Show modal or intrusive notifications
- Trigger iPhone backup sync (requires manual device connection)
- Break manual sync triggers
- Make app startup significantly slower

---

## Acceptance Criteria

- [ ] Email sync triggers automatically on app load (Gmail + Outlook if connected)
- [ ] Text message sync triggers automatically on macOS
- [ ] Contact sync triggers automatically on macOS
- [ ] AI auto-detection runs after sync completes
- [ ] User sees latest data without clicking any buttons
- [ ] Sync uses incremental approach (only new data)
- [ ] UI remains responsive during background sync
- [ ] Errors are logged but don't interrupt user
- [ ] Subtle progress indicator visible during sync
- [ ] App startup time not significantly impacted

---

## Platform Matrix

| Data Source | Windows | macOS | Method |
|-------------|---------|-------|--------|
| Gmail | Yes | Yes | API - fetch new emails since last sync |
| Outlook | Yes | Yes | API - fetch new emails since last sync |
| Text Messages | No | Yes | Local iMessage database |
| Contacts | No | Yes | Local Contacts database |
| iPhone Backup | No | No | Requires manual trigger |

---

## Implementation Approach

### 1. Trigger Point

Coordinate with state machine. Trigger when:
- `isAuthenticated === true`
- `isDatabaseReady === true`
- User is on dashboard (not in onboarding)

```typescript
// In useAppStateMachine or Dashboard component
useEffect(() => {
  if (isAuthenticated && isDatabaseReady && currentView === 'dashboard') {
    // Delay to let UI render first
    const timeoutId = setTimeout(() => {
      triggerAutoRefresh();
    }, 2500);
    return () => clearTimeout(timeoutId);
  }
}, [isAuthenticated, isDatabaseReady, currentView]);
```

### 2. Auto-Refresh Orchestration

Create or use existing orchestration:

```typescript
async function triggerAutoRefresh() {
  setIsSyncing(true);

  try {
    // Get connected providers
    const connectedProviders = await window.api.auth.getConnectedProviders();

    // Build sync tasks based on platform and connections
    const syncTasks: Promise<void>[] = [];

    if (connectedProviders.includes('gmail')) {
      syncTasks.push(syncEmails('gmail'));
    }
    if (connectedProviders.includes('outlook')) {
      syncTasks.push(syncEmails('outlook'));
    }
    if (platform === 'macos') {
      syncTasks.push(syncLocalMessages());
      syncTasks.push(syncLocalContacts());
    }

    // Run all syncs in parallel
    await Promise.allSettled(syncTasks);

    // Run AI detection on new items
    await runAIAutoDetection();

  } catch (error) {
    console.error('[AutoRefresh] Error:', error);
    // Don't show user error - this is background operation
  } finally {
    setIsSyncing(false);
  }
}
```

### 3. Progress Indicator

Add subtle indicator to dashboard header or sync status area:

```tsx
{isSyncing && (
  <div className="text-xs text-gray-500 flex items-center gap-1">
    <Spinner size="sm" />
    <span>Refreshing...</span>
  </div>
)}
```

---

## Files to Modify

- `src/appCore/state/useAppStateMachine.ts` or appropriate flow hook - Add auto-refresh trigger
- `src/components/Dashboard.tsx` or `src/components/dashboard/` - Add progress indicator
- Possibly create `src/hooks/useAutoRefresh.ts` - Encapsulate refresh logic

## Files to Read (for context)

- `electron/services/emailSyncService.ts` - Existing email sync
- `electron/services/contactsService.ts` - Existing contact sync
- `src/appCore/state/machine/` - State machine implementation
- `src/hooks/useIPhoneSync.ts` - Existing sync patterns
- SPRINT-014 task files - Incremental sync implementation

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  - Test auto-refresh triggers on correct conditions
  - Test auto-refresh respects platform availability
  - Test auto-refresh handles errors gracefully
  - Test progress indicator shows during sync

### Manual Testing
- [ ] Open app on macOS - emails, texts, contacts refresh automatically
- [ ] Open app on Windows - emails refresh automatically (no texts/contacts)
- [ ] UI remains responsive during background sync
- [ ] Progress indicator appears and disappears correctly
- [ ] New emails/texts appear after sync completes
- [ ] AI detection finds new transactions
- [ ] App startup not noticeably slower
- [ ] Errors don't show user alerts (check console for logging)

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness
- [ ] No TypeScript errors
- [ ] No ESLint errors

---

## PR Preparation

- **Title:** `feat(sync): auto-refresh data sources on app load`
- **Branch:** `feature/TASK-1003-auto-refresh`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | `<from Task tool output>` |
| Total Tokens | `<from tokens.jsonl>` |
| Duration | `<seconds>` |
| API Calls | `<count>` |

**Retrieve metrics:** `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop (AFTER Phase 1 complete)
- [ ] Recorded agent_id: ___
- [ ] Read task file completely
- [ ] Verified Phase 1 tasks are merged

Implementation:
- [ ] Auto-refresh trigger implemented
- [ ] Platform-specific logic correct
- [ ] Progress indicator added
- [ ] Error handling implemented
- [ ] Tests written
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified
```

### Results

- **Before**: User must manually click to refresh data
- **After**: Data refreshes automatically on app load
- **Sync Time**: ~X seconds (average)
- **UI Impact**: [describe any startup time change]
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Sync significantly slows down app startup (>5 seconds delay)
- You find race conditions with existing sync triggers
- The state machine integration is more complex than expected
- You need to modify the preload script or IPC handlers
- Error handling needs user-facing notifications (design decision)
