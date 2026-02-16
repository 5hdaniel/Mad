# Task TASK-1989: Expand Contacts Import Settings to Multi-Source

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Expand the `MacOSContactsImportSettings` component from a macOS-only contacts import section to a unified "Contacts Import" section that shows import controls for all connected contact sources (macOS Contacts, Outlook). The section should adapt based on available sources and platform.

## Non-Goals

- Do NOT add Gmail contacts import (not implemented in backend yet)
- Do NOT modify the SyncOrchestrator logic
- Do NOT add new IPC handlers for Outlook contact import (they already exist via `outlookFetchService.fetchContacts()` triggered through the sync orchestrator)
- Do NOT refactor the entire Settings page layout
- Do NOT add per-source stats (that is TASK-1991)
- Do NOT modify `outlookFetchService.ts`

## Deliverables

1. Rename/Update: `src/components/settings/MacOSContactsImportSettings.tsx`
   - Rename component from `MacOSContactsImportSettings` to `ContactsImportSettings`
   - Show macOS Contacts import section (existing, only on macOS)
   - Show Outlook Contacts import section (new, when Microsoft account connected)
   - Adapt heading and description text
2. Update: `src/components/Settings.tsx`
   - Update import statement to use renamed component
   - Update usage/props if needed

## Acceptance Criteria

- [ ] Component renamed from `MacOSContactsImportSettings` to `ContactsImportSettings`
- [ ] Section heading changed from "macOS Contacts" to "Contacts Import" (or similar)
- [ ] macOS Contacts import section still visible on macOS (unchanged behavior)
- [ ] Outlook Contacts import section visible when user has a Microsoft account connected
- [ ] Outlook section shows "Import Outlook Contacts" button
- [ ] Outlook section handles `reconnectRequired` state (shows message to reconnect mailbox)
- [ ] Outlook section shows syncing state during import
- [ ] Component renders correctly when no sources are available (shows helpful message)
- [ ] File renamed or exports updated so `Settings.tsx` import works
- [ ] All CI checks pass (`npm run type-check`, `npm run lint`, `npm test`)

## Implementation Notes

### Current State

`MacOSContactsImportSettings.tsx` at `src/components/settings/MacOSContactsImportSettings.tsx`:
- Only renders on macOS (`if (!isMacOS) return null`)
- Uses `useSyncOrchestrator` for sync state
- Uses `window.api.contacts.getExternalSyncStatus(userId)` for status
- Has Import Contacts and Force Re-import buttons

### Backend Already Exists

The Outlook contacts import backend is fully implemented:
- `outlookFetchService.fetchContacts()` (lines 742-853) -- fetches from Graph API
- `externalContactDbService.upsertOutlookContact()` -- stores with `source: 'outlook'`
- The sync orchestrator already supports Outlook contact sync

### Changes Required

1. **Rename the component and file export:**
   - Keep the file at the same path but update the component name
   - Update the default export
   - Update `Settings.tsx` to import `ContactsImportSettings`

2. **Remove the platform gate (partially):**
   - Don't return `null` when not macOS
   - Instead, conditionally render macOS section only on macOS
   - Always render Outlook section if Microsoft account is connected

3. **Check for Microsoft account connection:**
   - Use `window.api.contacts.getExternalSyncStatus(userId)` or check OAuth tokens
   - Alternatively, check `window.api.outlook?.isAuthenticated()` (from `outlookBridge`)

4. **Outlook section layout:**
```tsx
{/* Outlook Contacts Section */}
{isOutlookConnected && (
  <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
    <div className="flex items-center gap-2 mb-2">
      {/* Microsoft icon or generic icon */}
      <h5 className="text-sm font-medium text-gray-900">Outlook Contacts</h5>
    </div>
    <p className="text-xs text-gray-600 mb-2">
      Import contacts from your connected Microsoft account.
    </p>
    {reconnectRequired ? (
      <div className="p-2 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200">
        Please disconnect and reconnect your Microsoft mailbox to grant contact access.
      </div>
    ) : (
      <button
        onClick={handleOutlookSync}
        disabled={isSyncing}
        className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-all disabled:opacity-50"
      >
        {isSyncing ? "Syncing..." : "Import Outlook Contacts"}
      </button>
    )}
  </div>
)}
```

5. **Trigger Outlook contact sync:**
   - Use the sync orchestrator: `requestSync(['contacts'], userId)` -- the orchestrator already handles Outlook contacts when the source is configured
   - OR call `window.api.outlook?.fetchContacts?.(userId)` if a direct IPC channel exists
   - Check the contact-handlers.ts and sync-handlers.ts for the correct IPC channel

### Key Files to Reference (READ ONLY)

- `electron/services/outlookFetchService.ts` lines 742-853 (fetchContacts)
- `electron/services/db/externalContactDbService.ts` (upsertOutlookContact)
- `electron/preload/outlookBridge.ts` (outlookBridge exports)
- `electron/contact-handlers.ts` (IPC handlers for contacts)

## Integration Notes

- Imports from: `usePlatform`, `useSyncOrchestrator`, `outlookBridge` (via window.api)
- Exports to: `Settings.tsx`
- Used by: Settings page
- Depends on: TASK-1988 (Outlook filter toggle -- for consistent terminology)

## Do / Don't

### Do:
- Preserve all existing macOS contacts import behavior
- Use indigo color family for Outlook sections (matching SourcePill outlook variant)
- Handle the case where Outlook is connected but lacks Contacts.Read scope
- Show appropriate loading/syncing states
- Keep the component self-contained

### Don't:
- Don't create a new file -- rename/update the existing component
- Don't add Gmail contacts import (no backend exists)
- Don't modify the sync orchestrator logic
- Don't add per-source statistics (that is TASK-1991)
- Don't add new IPC handlers unless absolutely necessary (use existing ones)

## When to Stop and Ask

- If `outlookBridge` does not expose `isAuthenticated()` or similar method
- If there is no IPC channel to trigger Outlook contacts sync independently
- If the sync orchestrator does not support Outlook contacts sync
- If the component exceeds 300 lines -- consider splitting

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test component renders macOS section on macOS
  - Test component renders Outlook section when connected
  - Test component renders nothing when no sources available
  - Test reconnectRequired state shows warning message
- Existing tests to update:
  - Update any existing tests that import `MacOSContactsImportSettings` to use new name

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios: N/A

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(settings): expand contacts import to multi-source (macOS + Outlook)`
- **Labels**: `ui`, `settings`, `outlook`
- **Depends on**: TASK-1988 (for consistent Outlook terminology)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files (component + Settings.tsx) | +8K |
| Code volume | ~100 lines added/modified | +10K |
| Test complexity | Medium (multiple render scenarios) | +5K |
| Investigation | Checking IPC channels for Outlook sync | +2K |

**Confidence:** Medium

**Risk factors:**
- May need to discover/add IPC channel for Outlook-specific contact sync
- Component size could grow beyond expectations

**Similar past tasks:** BACKLOG-660 (ImportContactsModal refresh, actual ~15K)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] src/components/settings/MacOSContactsImportSettings.tsx (renamed to ContactsImportSettings)
- [ ] src/components/Settings.tsx (updated import)

Features implemented:
- [ ] Component renamed
- [ ] Multi-source layout (macOS + Outlook)
- [ ] Outlook connection check
- [ ] Outlook sync trigger
- [ ] Reconnect required handling

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
