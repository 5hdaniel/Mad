# Task TASK-1742: macOS Import Source Selector

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

Add a Settings option for macOS users to choose their import source for messages and contacts:

- **Option A (Default):** Import from macOS Messages database + Contacts app (current behavior)
- **Option B:** Sync from connected iPhone (same experience as Windows users)

This gives macOS users the flexibility to use either source, since some users prefer the iPhone sync method.

## Non-Goals

- Do NOT implement the actual iPhone sync logic (use existing infrastructure from Windows)
- Do NOT change the Windows import flow
- Do NOT remove the macOS Messages import capability
- Do NOT change onboarding flow (this is a Settings-only change)
- Do NOT auto-detect which source to use

## Background

Currently:
- **macOS users:** Import from local macOS Messages database (`chat.db`) and Contacts app
- **Windows users:** Sync from connected iPhone via iTunes backup

Some macOS users have expressed preference for the iPhone sync method because:
1. They don't use Messages on Mac (only on iPhone)
2. Messages database may be out of sync with iPhone
3. They want the same experience as their Windows workflow

The iPhone backup sync infrastructure already exists for Windows - this task exposes it to macOS users.

## Deliverables

1. New file: `src/components/settings/ImportSourceSettings.tsx` - New settings component
2. Update: `src/components/Settings.tsx` - Add new ImportSourceSettings component to Messages section
3. Update: `src/services/settingsService.ts` - Add import source preference type
4. Update: `electron/preference-handlers.ts` - Handle new preference (if needed)
5. Update: `src/hooks/useMacOSMessagesImport.ts` - Check import source preference
6. Update: `src/appCore/BackgroundServices.tsx` - Pass import source to hook (if needed)
7. Tests for the new component and preference

## Acceptance Criteria

- [ ] macOS Settings shows "Import Source" option under Messages section
- [ ] Two radio options: "macOS Messages + Contacts" and "iPhone Sync"
- [ ] Default selection is "macOS Messages + Contacts" (preserves current behavior)
- [ ] Selecting "iPhone Sync" shows iPhone connection status/instructions
- [ ] Preference persists across app restarts
- [ ] When "iPhone Sync" is selected, auto-import uses iPhone backup instead of Messages.app
- [ ] Manual import button behavior matches the selected source
- [ ] Setting only appears on macOS platform
- [ ] All CI checks pass
- [ ] Existing tests pass
- [ ] New tests verify preference switching

## Implementation Notes

### Preference Structure

Add to user preferences:
```typescript
interface ImportSourcePreferences {
  messages: {
    source: 'macos-native' | 'iphone-sync';
  };
}
```

### New Component: ImportSourceSettings.tsx

```typescript
/**
 * ImportSourceSettings Component
 *
 * Allows macOS users to choose between importing from:
 * - macOS Messages database + Contacts app (native)
 * - Connected iPhone via iTunes backup (sync)
 */

import React, { useState, useEffect } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';

interface ImportSourceSettingsProps {
  userId: string;
}

export function ImportSourceSettings({ userId }: ImportSourceSettingsProps) {
  const { isMacOS } = usePlatform();
  const [source, setSource] = useState<'macos-native' | 'iphone-sync'>('macos-native');
  const [loading, setLoading] = useState(true);

  // Only render on macOS
  if (!isMacOS) return null;

  // Load preference...
  // Handle change...

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-2">Import Source</h4>
      <p className="text-xs text-gray-600 mb-3">
        Choose where to import your messages and contacts from.
      </p>

      <div className="space-y-2">
        {/* Radio: macOS Messages + Contacts */}
        <label className="flex items-start gap-3 p-3 bg-white rounded border cursor-pointer">
          <input
            type="radio"
            name="importSource"
            value="macos-native"
            checked={source === 'macos-native'}
            onChange={() => handleSourceChange('macos-native')}
          />
          <div>
            <div className="text-sm font-medium">macOS Messages + Contacts</div>
            <div className="text-xs text-gray-500">
              Import from your Mac's Messages app and Contacts
            </div>
          </div>
        </label>

        {/* Radio: iPhone Sync */}
        <label className="flex items-start gap-3 p-3 bg-white rounded border cursor-pointer">
          <input
            type="radio"
            name="importSource"
            value="iphone-sync"
            checked={source === 'iphone-sync'}
            onChange={() => handleSourceChange('iphone-sync')}
          />
          <div>
            <div className="text-sm font-medium">iPhone Sync</div>
            <div className="text-xs text-gray-500">
              Sync from a connected iPhone (same as Windows experience)
            </div>
          </div>
        </label>
      </div>

      {/* Show iPhone instructions when that source is selected */}
      {source === 'iphone-sync' && (
        <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-700">
          <p className="font-medium mb-1">To use iPhone Sync:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Connect your iPhone to this Mac via USB</li>
            <li>Trust this computer on your iPhone if prompted</li>
            <li>Click "Import from iPhone" to sync messages</li>
          </ol>
        </div>
      )}
    </div>
  );
}
```

### Settings.tsx Integration

Add the new component to the Messages section:

```typescript
{/* Messages section - around line 760 */}
<div className="mb-8">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">
    Messages
  </h3>
  <div className="space-y-4">
    {/* New: Import Source Selector (macOS only) */}
    <ImportSourceSettings userId={userId} />

    {/* Existing: MacOSMessagesImportSettings */}
    <MacOSMessagesImportSettings userId={userId} />
  </div>
</div>
```

### useMacOSMessagesImport Hook Changes

The hook needs to:
1. Load the `messages.source` preference
2. If `'iphone-sync'`, use iPhone backup import instead of Messages.app
3. Default to `'macos-native'` if not set

```typescript
// Add to hook
const [importSource, setImportSource] = useState<'macos-native' | 'iphone-sync'>('macos-native');

// Load preference
useEffect(() => {
  if (!userId) return;

  const loadSource = async () => {
    const result = await window.api.preferences.get(userId);
    if (result.success && result.preferences?.messages?.source) {
      setImportSource(result.preferences.messages.source);
    }
  };

  loadSource();
}, [userId]);

// In import logic, check importSource
if (importSource === 'iphone-sync') {
  // Use existing iPhone backup import logic
  await window.api.messages.importFromiPhoneBackup(userId);
} else {
  // Use existing macOS Messages import
  await window.api.messages.importMacOSMessages(userId);
}
```

### Reference: iPhone Backup Import

Check these files for existing iPhone sync infrastructure:
- `electron/imessage/` - Contains iPhoneBackupReader
- `electron/message-handlers.ts` - IPC handlers for message import
- Look for `importFromiPhoneBackup` or similar

## Integration Notes

- Imports from: PlatformContext, settingsService
- Used by: Settings.tsx (parent)
- Related: MacOSMessagesImportSettings.tsx (existing component, may need coordination)
- Depends on: iPhone backup import infrastructure (should already exist for Windows)

## Do / Don't

### Do:

- Follow existing Settings component patterns
- Use the same styling as other Settings sections
- Persist the preference via the existing preferences API
- Default to current behavior (macOS native)
- Show helpful instructions when iPhone sync is selected
- Reuse existing iPhone backup import code

### Don't:

- Create a completely new import system
- Remove the macOS native import option
- Change the default behavior for existing users
- Show this option on Windows (they only have iPhone sync)
- Implement iPhone backup reading from scratch

## When to Stop and Ask

- If iPhone backup import infrastructure doesn't exist for macOS
- If the existing iPhone sync code is Windows-only and needs significant porting
- If the Settings.tsx file structure has changed significantly
- If there are conflicts with the MacOSMessagesImportSettings component

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `ImportSourceSettings` renders only on macOS
  - `ImportSourceSettings` loads and displays saved preference
  - `ImportSourceSettings` saves preference when changed
  - `useMacOSMessagesImport` uses correct import method based on preference
- Existing tests to update:
  - `useMacOSMessagesImport` tests may need to mock source preference

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Select "macOS Messages", verify Messages.app import runs
  - Select "iPhone Sync", verify iPhone backup import runs
  - Preference persists after Settings modal closes
  - Preference persists after app restart

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(settings): add macOS import source selector (Messages vs iPhone)`
- **Labels**: `settings`, `feature`, `macos`
- **Depends on**: TASK-1741 (if doing both in same sprint, to avoid merge conflicts)

---

## PM Estimate (PM-Owned)

**Category:** `ui` + `service`

**Estimated Tokens:** ~35-50K

**Token Cap:** 200K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 new component | +15K |
| Files to modify | 3-4 files | +15K |
| Code volume | ~150-200 lines | +10K |
| Test complexity | Medium-High (mocking, integration) | +15K |
| iPhone infra reuse | May need investigation | +10K |

**Confidence:** Medium

**Risk factors:**
- iPhone backup import may not be available on macOS
- May need to port Windows iPhone sync code
- Hook coordination between components

**Similar past tasks:** TASK-1710 (MacOSMessagesImportSettings, ~40K tokens)

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
Files created:
- [ ] src/components/settings/ImportSourceSettings.tsx

Files modified:
- [ ] src/components/Settings.tsx
- [ ] src/services/settingsService.ts
- [ ] src/hooks/useMacOSMessagesImport.ts
- [ ] Tests added

Features implemented:
- [ ] Import source radio selector (macOS only)
- [ ] Preference persistence
- [ ] Hook uses correct import method
- [ ] iPhone sync instructions shown

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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any, explain what and why>

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
**Merged To:** develop / claude/xxx

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
